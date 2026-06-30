<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent instructions

**Project business logic & database rules:** read `docs/PROJECT_LOGIC.md` before any schema change, SQL patch, or feature that touches exams, makeups, tracking, assignments, or students.

**Database changes:** always use idempotent `supabase/PATCH_*.sql` files; never destructive migrations on production data without explicit user request.
