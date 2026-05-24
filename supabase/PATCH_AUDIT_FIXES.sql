-- PATCH_AUDIT_FIXES.sql
-- חיזוק CHECK של exams + 3 אינדקסים לביצועים
-- בטוח להרצה מספר פעמים (idempotent)

-- ===== 1) חיזוק CHECK של exams =====
alter table public.exams drop constraint if exists exams_multi_target_check;
alter table public.exams add constraint exams_multi_target_check
  check (
    (
      assignment_category = 'התמחות'
      and cardinality(specialization_ids) >= 1
      and cardinality(class_ids) = 0
      and cardinality(track_ids) = 0
      and not psychology_enabled
      and not applies_to_all_in_grade
    )
    or (
      assignment_category = 'חובה'
      and cardinality(specialization_ids) = 0
      and (
        applies_to_all_in_grade
        or psychology_enabled
        or cardinality(class_ids) >= 1
        or cardinality(track_ids) >= 1
      )
      and (
        not applies_to_all_in_grade
        or (
          cardinality(class_ids) = 0
          and cardinality(track_ids) = 0
          and not psychology_enabled
        )
      )
    )
  );

-- ===== 2) אינדקסים לביצועים =====
create index if not exists idx_exam_tracking_exam_id
  on public.exam_tracking (exam_id);

create index if not exists idx_teacher_assignments_year
  on public.teacher_assignments (academic_year_id);

create index if not exists idx_exams_grade_levels_gin
  on public.exams using gin (grade_levels);
