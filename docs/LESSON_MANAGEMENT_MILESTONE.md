# Admin Lesson Management Milestone

## Scope

The admin Course Content page now manages lessons directly inside each module. This keeps lesson creation discoverable through the existing Course Manager → Content flow and avoids requiring admins to remember a separate URL.

## Supported in this milestone

- Open **Add lesson** from an existing module.
- Enter lesson title and optional description.
- Choose Video, Article, PDF, or External link content type.
- Optionally provide a content URL.
- Mark a lesson as available for student preview.
- Save lessons to `public.course_lessons`.
- Display saved lessons under their module.
- Delete lessons from the module.
- Preserve the existing admin-only database policies for course lessons.

## Verification target

After the branch Preview deploys, verify:

1. Admin can open Course Manager → Content.
2. Existing modules remain visible.
3. **Add lesson** is visible inside a module.
4. A lesson can be created and remains visible after reload.
5. Student course detail shows the lesson according to preview/enrolment access.

Do not merge until Preview verification passes.
