# לוגיקת הפרויקט — מערכת מבחנים ובית יעקב

מסמך זה הוא **מקור האמת** ללוגיקה עסקית, סכימת DB, וזרימות עבודה.
**לפני כל שינוי במסד נתונים** — קרא מסמך זה במלואו ואת קבצי ה-PATCH הרלוונטיים.

---

## 1. עקרונות כלליים

- כל הנתונים התפעוליים **מבודדים לפי שנת לימודים** (`academic_year_id`).
- בתוך שנה: **מחצית א / מחצית ב** (`term`) מבודדת רק מבחנים, מעקב מבחנים, השלמות ומעקב השלמות. תלמידות, מורות, שיבוצים ולוקאפים **משותפים** לשתי המחציות.
- שנה **פעילה** — עריכה מותרת. שנה **בארכיון** — צפייה בלבד (`readOnly: true`, 403 על מוטציות). מעבר בין מחציות **אינו** משנה `readOnly`.
- רוב הטבלאות משתמשות ב-**מחיקה רכה** (`deleted_at`). שאילתות חייבות לסנן `deleted_at IS NULL` (`notDeleted()`).
- מבחנים ושיבוצים משתמשים ב-**יעד מרובה** (כיתות / מסלולים / פסיכולוגיה / כל השכבה) — לא יעד יחיד.

---

## 2. ישויות עיקריות

### שנת לימודים (`academic_years`)
שנה אחת פעילה בכל זמן. כל תלמידה, מורה, מבחן ושיבוץ שייכים לשנה.
- `active_term` — מחצית ברירת מחדל לצפייה (`א` / `ב`). שנה חדשה מתחילה ב־`א`. אחרי מיגרציה: שנה פעילה קיימת = `ב` (כל הנתונים הישנים).

### מחצית (`term` על exams / exam_tracking / makeup_exams / makeup_tracking)
- ערכים: `א` | `ב` (עמודה מפורשת — לא לפי תאריכים).
- יצירת מבחן נעשית לפי המחצית הנצפית (`?term=` / `viewingTerm`).
- `exam_students` נגזר מ־`exam_id` (בלי עמודת מחצית נפרדת).
- מיגרציה: `PATCH_TERM_HALVES.sql` — ADD COLUMN + backfill ל־`ב` בלבד; אין מחיקה.

### תלמידות (`students`)
- שכבה: `א` | `ב` | `ג`
- כיתה, מסלול, התמחות ראשית/שנייה
- `is_psychology` — סימון פסיכולוגיה ידני
- `teaching_track_type`: `full` | `short` | `null` — רק במסלול «הוראה»
- `status`: `active` | `left` | `graduated`

### מורים (`teachers`) — לפי שנה

### שיבוצים (`teacher_assignments`)
שורה אחת = מורה + מקצוע + טביעת אצבע יעדים (לא שורה לכל שכבה).

| שדה | משמעות |
|-----|--------|
| `assignment_category` | `חובה` או `התמחות` |
| `grade_levels[]` | שכבות |
| `class_ids[]`, `track_ids[]`, `specialization_ids[]` | יעדים |
| `psychology_enabled` | מסנן פסיכולוגיה |
| `applies_to_all_in_grade` | כל השכבה (בלי כיתה/מסלול/פסיכולוגיה) |
| `teaching_mode` | `full` / `short` / `both` / `null` — רק במסלול «הוראה» |
| `targets_fingerprint` | ייחודיות לייבוא |

### מבחנים (`exams`)
נוצרים משיבוץ. אותם שדות יעד + `exam_date`, `teaching_track_type`, `makeup_locked_at`.
- `makeup_locked_at` — נעילה אחרי סיום/השלמות; חוסם שינויי סטטוס תלמידה (למעט כרטיס תלמידה).

### שורות מבחן (`exam_students`)
חיבור תלמידה↔מבחן + **snapshots** (קפואים ביצירה) + `status`.

### השלמות (`makeup_exams`)
| שדה | משמעות |
|-----|--------|
| `status` | `open` / `completed` |
| `auto_registered` | נרשמה להשלמה |
| `completed_at` | תאריך השלמה (בעת רישום או סיום) |
| `starting_grade`, `is_paid` | מרישום להשלמה |
| `grade`, `notes` | ציון סופי והערה |

### מעקב השלמות (`makeup_tracking`)
שורה לכל `(exam_id, student_id)` — נוצרת עם השלמה.
- `sent_to_teacher_at` — נשלח למורה
- `grade`, `grade_received_at` — ציון (מסתנכרן ל-`makeup_exams`)
- סיום סופי: `POST .../complete` (דורש ציון)

### מעקב מבחנים (`exam_tracking`)
שורה לכל `(exam_id, teacher_id)` — נוצרת עם מבחן.
- `submitted_exam` — תאריך+שעה הגשת מבחן (חובה אם מסומן «הוגש»)
- `student_submission_date` — הגשת מטלה ע"י תלמידות
- `reminder_1_hindi`, `reminder_2_biller` — תזכורות (אופציונלי)
- בוליאנים: `approved_by_coordinator`, `sent_for_review`, `grades_submitted`, `grades_approved`, `transferred_to_system`

---

## 3. כללי יעד ושיבוץ (`lib/assignments/multiTarget.ts`)

### חובה
- חובה: `grade_levels` + לפחות יעד אחד: כיתות / מסלולים / פסיכולוגיה / «כל השכבה»
- **אין** `specialization_ids`

### התמחות
- רק `specialization_ids` + `grade_levels`
- **אין** כיתות, מסלולים, פסיכולוגיה, «כל השכבה»

### מסלול הוראה — חיתוך (AND), לא איחוד
כשנבחר מסלול «הוראה» + סוג הוראה:
- תלמידה חייבת להיות על מסלול הוראה + סוג מתאים
- אם נבחרה גם כיתה — חייבת להיות באותה כיתה

### פסיכולוגיה (`lib/students/psychologyEligibility.ts`)
כש-`psychology_enabled` על יעד, נכללות תלמידות ש:
1. `is_psychology = true`, **או**
2. `track_id` במסלול «הוראה» או «הוראת מדעי המחשב» (או שם עם «מדעי המחשב» + «הורא»)

**לא** לפי התמחות — רק לפי מסלול.

---

## 4. זרימות סטטוס

### `exam_students.status`
```
pending → took        (מוחק השלמות)
pending → makeup      (יוצר makeup_exams + makeup_tracking)
makeup  → completed   (סיום השלמה)
*       → pending/took (undo — מוחק השלמות)
```
- ה-UI שולח `missing`; ה-API שומר `makeup` (`applyStatusChange.ts`).

### השלמות — רישום וסיום
1. **סימון «לא נבחנה»** → `makeup` + `makeup_exams` (open) + tracking
2. **«נרשמה להשלמה»** (`PATCH makeups`) — דורש `completed_at`; אופציונלי `starting_grade`, `is_paid`
3. **«הושלם»** (`POST complete`) — `makeup_exams.status=completed`, `exam_students.status=completed`
4. **רשימת השלמות** — מציגה גם `completed` (ברירת מחדל: הכל) לעקוב אחרי תשלום וכו'

### מעקב השלמות
```
נוצר → נשלח למורה → הזנת ציון (גם אחרי «הושלם») → הושלם סופית (דורש ציון)
```

### מעקב מבחנים
```
הוגש מבחן (תאריך חובה) → אישור רכזת → נשלח לבדיקה →
ציונים הוגשו → ציונים אושרו → הועבר למערכת
```

---

## 5. שינויים במסד נתונים — חובה

### שלוש שכבות
| סוג | נתיב | מתי |
|-----|------|-----|
| איפוס מלא | `supabase/RUN_FULL_DATABASE_RESET.sql` | DB חדש בלבד |
| PATCH מרוכז | `supabase/PATCH_ALL_FOR_EXISTING_DB.sql` | DB קיים חסר עמודות בסיס |
| PATCH נקודתי | `supabase/PATCH_<FEATURE>.sql` | עמודה/טבלה חדשה |

### כללי בטיחות
1. **`ADD COLUMN IF NOT EXISTS`** / **`CREATE TABLE IF NOT EXISTS`** — אידמפוטנטי
2. **לא למחוק נתונים** ב-PATCH (רק הוספה)
3. הרצה ב-Supabase SQL Editor
4. בסוף: `notify pgrst, 'reload schema';` (אם רלוונטי)
5. עדכן **גם** `RUN_FULL_DATABASE_RESET.sql` לעתיד
6. עדכן `src/lib/types/db.ts`
7. API: **graceful fallback** אם עמודה חסרה (ראה `tracking/route.ts`, `makeups/route.ts`)

### קטלוג PATCH נפוץ
| קובץ | תוכן |
|------|------|
| `PATCH_TRACKING_STUDENT_SUBMISSION_DATE.sql` | `student_submission_date` |
| `PATCH_TRACKING_REMINDERS.sql` | `reminder_1_hindi`, `reminder_2_biller` |
| `PATCH_MAKEUP_TRACKING.sql` | טבלת `makeup_tracking` |
| `PATCH_MAKEUP_AUTO_REGISTERED.sql` | `auto_registered` |
| `PATCH_MAKEUP_REGISTRATION_FIELDS.sql` | `starting_grade`, `is_paid` |
| `PATCH_ASSIGNMENT_MULTI_TARGET.sql` | יעדים מרובים |
| `PATCH_EXAM_STUDENTS_NOTES.sql` | `exam_students.notes` |
| `PATCH_FIX_MISSING_CORE_COLUMNS.sql` | `grade_level` / שמות מורות / `deleted_at` חסרים |
| `PATCH_TERM_HALVES.sql` | `active_term` + `term` (מחציות א/ב) — backfill ל־ב |

### צ'קליסט לסוכן לפני שינוי DB
- [ ] קרא מסמך זה
- [ ] בדוק `RUN_FULL_DATABASE_RESET.sql` לסכימה עדכנית
- [ ] צור `PATCH_*.sql` עם הערות בעברית (מה עושה / מה לא)
- [ ] עדכן `RUN_FULL` + types + API fallback
- [ ] אל תשבור CHECK constraints על `exams` / `teacher_assignments`

---

## 6. API — דפוסים

- Scope: `?academic_year_id=` + `?term=` → `resolveScopeFromUrl()` / `resolveAcademicYearScope(..., term)`
- מבחנים / מעקב / השלמות / יומן / סטטיסטיקות מבחנים: `.eq('term', scope.term)` בנוסף לשנה
- תלמידות / מורות / שיבוצים / לוקאפים: **בלי** פילטר `term`
- מוטציה בשנה בארכיון → 403
- בדיקת `academic_year_id` על הרשומה לפני עדכון
- ייצוא: `GET /api/export/[kind]` (exams/tracking/makeups/exam-lines לפי מחצית)

---

## 7. נתיבי קוד מרכזיים

| תחום | לוגיקה | API | UI |
|------|--------|-----|-----|
| שיבוצים | `lib/assignments/multiTarget.ts` | `api/teacher-assignments/` | `assignments/` |
| מבחנים | `lib/exams/createOneExam.ts`, `studentMatch.ts`, `applyStatusChange.ts` | `api/exams/` | `exams/` |
| השלמות | `lib/makeups/` | `api/makeups/` | `makeups/MakeupsClient.tsx` |
| מעקב מבחנים | `lib/tracking/dates.ts` | `api/tracking/` | `tracking/TrackingClient.tsx` |
| מעקב השלמות | `lib/makeupTracking/sync.ts` | `api/makeup-tracking/` | `tracking/MakeupTrackingTab.tsx` |
| פסיכולוגיה | `lib/students/psychologyEligibility.ts` | — | — |
| שנת לימודים | `lib/academicYears/scope.ts` | `api/academic-years/` | `AcademicYearProvider` |

---

## 8. Next.js

גרסה עם שינויים breaking — לפני קוד Next.js קרא `node_modules/next/dist/docs/`.
