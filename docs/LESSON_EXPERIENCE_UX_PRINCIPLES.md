# Lesson Experience UX Principles

**Status:** Design baseline for the 27-Aug-2026 Lesson Experience workstream

## Purpose

Define the navigation and learner-experience rules that the LMS must follow before new lesson-player/navigation UI is promoted.

## Evidence reviewed

- Canvas student Course Navigation and Modules guidance: course areas should have a clear active navigation state; modules organize content; module progression uses Previous/Next navigation; unnecessary/empty navigation links should be hidden.
- Moodle Activity Completion guidance: completion should be visible to learners as a checklist/progress signal and can contribute to course completion reporting.
- 1EdTech accessibility guidance: provide clear labels, complete keyboard access, context/orientation information, consistent layouts, and equivalent access for learning resources.
- WCAG 2.2: visible keyboard focus, logical focus order, focus not obscured, and minimum target sizing.
- GOV.UK Design System tabs guidance: use clear labels, order by user need, avoid excessive/wrapping tabs, and keep the active section understandable.

## Product decisions for CoachAmitSoni LMS

### 1. Navigation hierarchy

Global learner navigation remains limited to the major LMS areas. Inside a course, navigation becomes contextual:

`Courses → Course → Module → Lesson`

The lesson screen must not force the learner to return to the course index for every lesson.

### 2. Lesson screen anatomy

The learner-facing lesson view should use a stable structure:

1. Course breadcrumb/context
2. Course/module/lesson title and current location
3. Compact progress indicator
4. Primary content area
5. Lesson completion action/status
6. Previous / Next lesson controls
7. Optional course/module lesson list in a responsive side panel or drawer

The primary content area must remain the visual focus.

### 3. Navigation visibility

- Do not create a tab for every action.
- Use tabs only for genuinely parallel sections of the same destination.
- Keep primary navigation visible on desktop.
- On smaller screens, collapse secondary navigation into a clearly labelled menu/drawer rather than allowing tabs to wrap.
- Never allow important navigation/action controls to overflow outside the viewport.
- The active navigation item must be visually distinct.
- Every interactive control must have a text/accessible name.

### 4. Course/module progression

Modules are the structural units; lessons are ordered within modules.

Learners should see:

- current module
- current lesson position
- completed lessons
- current lesson
- available next lesson

Previous/Next controls should appear in a stable location near the bottom of the lesson content and should identify the destination where practical.

### 5. Completion

Completion is learner-visible and persistent.

For the current Phase 1 architecture:

- completion is per lesson
- completion is stored in `lesson_progress`
- completion does not introduce module-level enrolment
- completion does not block access to another lesson unless a future course rule explicitly requires prerequisites

### 6. Content-type experience

- **Article:** readable typography, clear heading hierarchy, comfortable line length, no unnecessary chrome.
- **Video:** responsive player, clear title/context, controls accessible, no horizontal overflow.
- **PDF:** responsive viewer with an explicit fallback/open control if browser embedding is unavailable.
- **External link:** clearly identify that the learner is leaving the LMS before opening a new window/tab.

### 7. Accessibility and interaction

Target baseline: WCAG 2.2 AA-oriented implementation.

- Keyboard navigation must work through navigation, lesson list, content controls, completion, Previous and Next.
- Focus must remain visible and must not be hidden behind sticky UI.
- Interactive targets should meet at least 24×24 CSS px or equivalent spacing; primary controls should preferably be larger.
- Focus order must follow the visual/semantic order.
- Do not rely on colour alone to communicate completion or active state.
- Use labels rather than icon-only controls for critical navigation.

### 8. Responsive behavior

Desktop:
- global navigation visible
- course/lesson context visible
- optional lesson outline can remain visible as a compact panel

Tablet/mobile:
- no wrapped navigation tabs
- secondary lesson outline collapses to a labelled control/drawer
- Previous/Next controls remain reachable without horizontal scrolling
- content width and media scale to viewport

### 9. State handling

The learner should always know which state applies:

- loading
- accessible
- completed
- in progress
- locked because not enrolled
- content unavailable/error

Access must remain server-authorized through Supabase RLS. Frontend state is not an authorization boundary.

### 10. Avoiding navigation clutter

Do not add separate tabs for:

- every content type
- every module
- every lesson
- completion
- resources
- previous/next

Those belong to the lesson context and content layout, not the global navigation.

## Acceptance checklist

Before promotion, verify:

- [ ] Navigation fits in the viewport at desktop and mobile widths.
- [ ] No primary/secondary navigation wraps awkwardly.
- [ ] Active location is obvious.
- [ ] Course → module → lesson context is clear.
- [ ] Previous/Next works across module boundaries.
- [ ] Completion persists after refresh.
- [ ] Completion is visible without relying only on colour.
- [ ] Video/PDF/article/external content render appropriately.
- [ ] Enrolment access is enforced server-side.
- [ ] Un-enrolled users cannot open protected lessons/resources.
- [ ] Keyboard focus is visible and not obscured.
- [ ] Interactive targets are comfortably clickable.
- [ ] Mobile layout does not require horizontal scrolling.
