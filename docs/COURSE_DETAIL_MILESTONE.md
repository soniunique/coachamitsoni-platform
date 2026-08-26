# Course Detail Milestone

This feature branch replaces the representative Courses cards with published course data from Supabase and adds `/learn/courses/$slug`.

The course detail page loads published course metadata, ordered modules, and lessons. Preview lessons are shown as available; non-preview lessons are shown as locked unless the signed-in user has an active/completed enrollment. Existing lesson progress is displayed when present.

Production is intentionally unchanged until Vercel Preview validation passes.
