# Feature Specification: Timer Fixes & 4 AM Day Rollover

**Feature Branch**: `001-timer-fixes-day-rollover`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Fix timer label selection bug and day rollover crash; shift day boundary to 4:00 AM with auto-close and timer restart; remove tags; add task editing; add remaining tasks list; optimistic local timer start before server sync; track untracked time as wasted within a configurable window; good morning screen on first login after 4 AM; strike through completed/passed tasks; consolidate labels into a single expandable dropdown and include label-based time analysis."

## Clarifications

### Session 2026-06-02

- Q: What does the silent 4 AM auto-close do with the existing end-of-day review (mood/notes/plan, task resolution, credits)? → A: Auto-close computes metrics/score and rolls incomplete tasks forward silently; the reflective review (mood/notes/plan) becomes optional and is offered later (e.g., on the good morning screen), never blocking.
- Q: When a user adds a brand-new label inline from the expandable picker, what scoring attributes does it get? → A: Neutral defaults (standard credit rate, auto-assigned color, no daily goal), fully editable later in Label management.
- Q: How is wasted time represented, and does it affect the productivity score? → A: Derived metric from in-window gaps; counts against the day's productivity score as uncredited time; no blocks created, so logging a block later auto-reduces wasted time.
- Q: What is the state of a "passed" task, given incomplete tasks roll forward at 4 AM? → A: The "passed" strikethrough applies only to tasks/items sourced from Google Calendar whose day/week has elapsed. System-defined tasks keep their current behavior (e.g., roll forward) and are not subject to the new passed-strikethrough rule. Completion strikethrough still applies to any completed task.
- Q: What date range does the "remaining tasks" list span? → A: All open tasks regardless of date (backlog + scheduled + in-progress), sorted overdue/today first, then upcoming, then undated backlog.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Timer never locks the app (Priority: P1)

A user starts a timer and, at any point, needs to label the time and stop it. Today, once a timer is running the user can become unable to interact with the labeling/stop controls — particularly when the timer has been left running past midnight — and the entire app becomes unusable until the stuck block is resolved. The user needs the running-timer experience to always remain fully interactive so they can label and stop a block reliably regardless of how long it has run or whether a date boundary has passed.

**Why this priority**: This is a blocking defect that makes the core function of the app (tracking and ending time) impossible. Without it the product is unusable, so it must be fixed first.

**Independent Test**: Start a timer, leave it running across a day boundary (simulated clock change), then attempt to label and stop it. The control to enter a label and stop the timer must remain selectable and functional, and the app must remain usable throughout.

**Acceptance Scenarios**:

1. **Given** a timer is running, **When** the user interacts with the labeling control, **Then** the field accepts input and is not blocked by any overlay or non-interactive layer.
2. **Given** a timer has been running continuously past the day boundary, **When** the user opens the app, **Then** the app loads in a usable state and the user can stop and label the active time without errors.
3. **Given** a timer is running, **When** the user stops it, **Then** the block is finalized with the entered label and the app returns to a normal, fully interactive state.

---

### User Story 2 - Day ends at 4:00 AM with silent auto-close (Priority: P1)

The user wants the "day" to run from 4:00 AM to 4:00 AM rather than midnight to midnight, so that late-night activity is attributed to the correct day. At 4:00 AM the previous day is automatically and silently closed (no manual "Close all days" step), and a new day begins. If a timer is running when the boundary is reached, the running time is ended at the boundary and a new equivalent timer is automatically restarted under the new day so no time is lost and the user does not have to intervene.

**Why this priority**: The day-boundary behavior is the root cause of the rollover crash and is foundational to every other day-scoped feature (tasks, scores, stats, wasted time). It must be correct before dependent features behave correctly.

**Independent Test**: With a timer running, advance the clock to 4:00 AM. The running block is closed at 4:00 AM, the previous day is marked closed without user action, and a new running block resumes for the new day with the same attributes.

**Acceptance Scenarios**:

1. **Given** the current time crosses 4:00 AM, **When** the boundary is reached, **Then** the previous day is automatically closed without prompting the user, and a new day begins.
2. **Given** a timer is running at 4:00 AM, **When** the boundary is reached, **Then** the running block is ended at 4:00 AM and a new running block is automatically started for the new day carrying forward the same context (e.g., category/label/intent).
3. **Given** activity recorded at 1:00 AM, **When** the day is computed, **Then** that activity is attributed to the prior calendar day (the day that began at the previous 4:00 AM), not the new date.
4. **Given** the previous "Close all days" / manual batch-close action existed, **When** this feature is in place, **Then** that manual step is no longer required for normal daily rollover.

---

### User Story 3 - Instant timer start (Priority: P1)

When the user starts a timer (count-up or countdown), the timer and the screen transition must happen immediately based on local logic, without waiting for a server round-trip. The server synchronization happens in the background after the timer has already started and the screen has changed, so the start interaction feels instantaneous and never blocks the UI.

**Why this priority**: A laggy start is a high-frequency UX pain point that undermines trust in the core action. It is tightly coupled to the timer reliability work in US1/US2.

**Independent Test**: Start a timer under simulated network latency. The timer visibly starts and the focus screen appears with no perceptible delay; the server record is created/confirmed afterward without changing the user-visible state on success.

**Acceptance Scenarios**:

1. **Given** the user taps start, **When** the action is invoked, **Then** the timer begins counting and the screen transitions immediately, before any server confirmation.
2. **Given** the timer has started locally, **When** the background sync completes successfully, **Then** the user sees no disruptive change or reload.
3. **Given** the background sync fails, **When** the failure is detected, **Then** the user is informed and offered a clear recovery path without silently losing the started time.

---

### User Story 4 - Edit a task after it is added (Priority: P2)

After creating a task, the user can edit its details (such as title, estimate, category, project, due/scheduled date) instead of only being able to complete, drop, or reschedule it.

**Why this priority**: A common, expected capability; its absence forces delete-and-recreate workflows. Valuable but not blocking core time tracking.

**Independent Test**: Create a task, open it for editing, change its details, save, and confirm the updated values persist and display correctly.

**Acceptance Scenarios**:

1. **Given** an existing task, **When** the user opens it for editing and changes one or more fields, **Then** the changes are saved and reflected wherever the task appears.
2. **Given** a task is being edited, **When** the user cancels, **Then** no changes are persisted.

---

### User Story 5 - Remaining tasks list (Priority: P2)

The user can see a clear list of remaining (not yet completed and not dropped) tasks, so they always know what is still outstanding.

**Why this priority**: Improves daily planning and visibility; complements existing task views without being a prerequisite for core tracking.

**Independent Test**: With a mix of completed, dropped, and open tasks, open the remaining-tasks list and confirm it shows only outstanding tasks and updates as tasks are completed.

**Acceptance Scenarios**:

1. **Given** several tasks in different states and dates, **When** the user views the remaining tasks list, **Then** all open (not completed, not dropped) tasks appear regardless of date, sorted overdue/today first, then upcoming, then undated backlog.
2. **Given** a task in the remaining list, **When** it is completed or dropped, **Then** it leaves the remaining list.

---

### User Story 6 - Completed and passed items are struck through (Priority: P2)

When a task is completed it is visually struck through (marked as done) rather than simply disappearing. Additionally, items sourced from Google Calendar whose day/week has passed without completion are struck through to indicate the window has closed. System-defined tasks keep their current behavior (e.g., rolling forward) and are not struck through merely for a passed date.

**Why this priority**: A satisfying, low-risk visual improvement that reinforces progress; not core to tracking.

**Independent Test**: Complete a task and confirm it shows struck through; let the day/week of a Google Calendar-sourced item pass without completion and confirm it is shown struck through as "closed".

**Acceptance Scenarios**:

1. **Given** any task is marked complete, **When** it is displayed, **Then** it appears with a strikethrough treatment indicating completion.
2. **Given** a Google Calendar-sourced item whose scheduled day or week has passed without completion, **When** it is displayed, **Then** it appears struck through to indicate the window has closed.
3. **Given** a system-defined task whose scheduled day has passed, **When** it is displayed, **Then** it follows current behavior (e.g., rolls forward) and is NOT struck through solely due to the passed date.

---

### User Story 7 - Good morning screen on first login after 4 AM (Priority: P2)

The "good morning" / start-of-day screen is shown on the user's first login after 4:00 AM each day, aligning the morning rundown with the new 4 AM day boundary instead of the calendar midnight.

**Why this priority**: Aligns an existing morning experience with the new day boundary; depends on US2 being in place.

**Independent Test**: After 4:00 AM, open the app for the first time that day and confirm the good morning screen appears; open it again later the same day and confirm it does not reappear.

**Acceptance Scenarios**:

1. **Given** it is after 4:00 AM and the user has not yet opened the app today (4 AM-based day), **When** they open the app, **Then** the good morning screen is shown.
2. **Given** the user has already seen the good morning screen for the current 4 AM day, **When** they reopen the app, **Then** it is not shown again until the next day's 4:00 AM boundary.

---

### User Story 8 - Single consolidated, expandable label dimension with label-based analysis (Priority: P3)

The user wants to stop maintaining two parallel classification mechanisms. Tags are removed entirely. A single labeling dimension is kept (rather than having both free-text labels and category dropdowns), presented as an expandable dropdown that lets the user pick an existing label or add a new one. Time analysis then reports how much time was spent per label (e.g., total time per label over a period).

**Why this priority**: A simplification and analytics improvement. Valuable but not blocking; sequenced after the core fixes.

**Independent Test**: Confirm tags no longer appear anywhere; record time under several labels via the single expandable picker; open analysis and confirm time is aggregated per label.

**Acceptance Scenarios**:

1. **Given** the app previously supported tags, **When** this feature is in place, **Then** tag creation, selection, settings, and tag-based reporting are removed and no longer shown.
2. **Given** the user is classifying a time block (or task), **When** they open the label control, **Then** they can select a previously used label or add a new one from a single expandable picker.
3. **Given** time has been recorded across multiple labels, **When** the user opens analysis, **Then** they can see total time spent per label for the selected period.

---

### User Story 9 - Untracked time within active hours counts as wasted (Priority: P3)

The user defines an active window in settings (for example, 10:00 AM to 10:00 PM). Any stretch of time inside that window with no recorded time block is treated as "wasted" time, so gaps are accounted for rather than ignored.

**Why this priority**: A meaningful accountability feature that depends on the day model and labeling being settled first.

**Independent Test**: Set an active window, record blocks covering only part of it, and confirm the uncovered portions inside the window are reported as wasted time, while time outside the window is not.

**Acceptance Scenarios**:

1. **Given** an active window is configured, **When** part of that window has no recorded block, **Then** the uncovered portion is counted as wasted time for the day.
2. **Given** time outside the active window, **When** it is uncovered, **Then** it is not counted as wasted time.
3. **Given** the active window is changed in settings, **When** the day is recomputed, **Then** wasted time reflects the new window.

### Edge Cases

- A timer running for an unusually long time (e.g., user forgot to stop it for multiple days) — how is each day's portion attributed and how many auto-restarts occur across multiple 4 AM boundaries?
- The user opens the app for the first time in several days — multiple prior days need silent closing; how is this surfaced without overwhelming the user, and does the good morning screen still appear for the current day?
- Daylight saving time transitions around the 4:00 AM boundary in the user's timezone — the boundary must remain well-defined.
- The active window for wasted time spans or sits near the 4:00 AM boundary — wasted-time computation must use the 4 AM day definition consistently.
- Optimistic timer start when a block is already running on the server (e.g., started on another device) — conflict must be detected and resolved without losing data.
- A Google Calendar-sourced item's day/week passes without completion — it is struck through, while a system-defined task in the same situation follows current roll-forward behavior.

## Requirements *(mandatory)*

### Functional Requirements

**Timer reliability (US1)**

- **FR-001**: The running-timer screen MUST keep the label entry and stop controls fully interactive at all times, with no overlay or non-interactive layer blocking them.
- **FR-002**: The system MUST allow a user to stop and label any running block regardless of how long it has been running or whether a day boundary has passed since it started.
- **FR-003**: The app MUST remain usable (load and respond) when a timer has been left running across one or more day boundaries.

**4 AM day boundary (US2)**

- **FR-004**: The system MUST define the daily boundary at 4:00 AM in the user's local timezone, such that a "day" runs from 4:00 AM to the following 4:00 AM.
- **FR-005**: All day-scoped computations (activity attribution, daily scores, task day association, stats, wasted time) MUST use the 4:00 AM day definition.
- **FR-006**: At the 4:00 AM boundary, the system MUST automatically and silently close the day that is ending — finalizing its day metrics/productivity score and rolling incomplete tasks forward — without requiring any manual confirmation or batch action.
- **FR-006a**: The reflective end-of-day review (mood, notes, tomorrow's plan) MUST become optional and non-blocking. It MUST NOT be required to close a day; instead it MAY be offered later (e.g., on the good morning screen) for the most recently closed day.
- **FR-007**: When a timer is running at the 4:00 AM boundary, the system MUST end the running block at 4:00 AM and automatically start a new running block for the new day that carries forward the prior block's context (at minimum its classification/label and intent).
- **FR-008**: The system MUST remove the need for a manual "Close all days" step in the normal daily flow. (Whether a manual catch-up remains available for long absences is an implementation choice; normal rollover MUST be automatic.)

**Instant timer start (US3)**

- **FR-009**: Starting a timer (count-up or countdown) MUST update the timer state and transition the screen immediately based on local logic, before any server confirmation.
- **FR-010**: The system MUST perform server synchronization of a started timer in the background after the local start, without a disruptive UI change on success.
- **FR-011**: If background synchronization of a started timer fails, the system MUST notify the user and provide a recovery path without silently discarding the elapsed time.

**Task editing (US4)**

- **FR-012**: Users MUST be able to edit an existing task's details after creation, including at least title, estimate, category, project, and due/scheduled dates.
- **FR-013**: Edited task values MUST persist and be reflected everywhere the task is displayed.

**Remaining tasks list (US5)**

- **FR-014**: The system MUST provide a list of remaining tasks that includes all open tasks (neither completed nor dropped) regardless of date — covering backlog, scheduled, and in-progress tasks.
- **FR-014a**: The remaining tasks list MUST be sorted with overdue/today items first, then upcoming (future-dated) items, then undated backlog items.
- **FR-015**: The remaining tasks list MUST update so that completing or dropping a task removes it from the list.

**Completed/passed strikethrough (US6)**

- **FR-016**: Completed tasks MUST be displayed with a strikethrough/"done" visual treatment, regardless of source.
- **FR-017**: The "passed"/window-elapsed strikethrough MUST apply only to tasks/items sourced from Google Calendar whose scheduled day or week has elapsed without completion. System-defined tasks MUST retain their current behavior (e.g., rolling forward) and MUST NOT receive the passed-strikethrough treatment.

**Good morning screen (US7)**

- **FR-018**: The good morning / start-of-day screen MUST be shown on the user's first app open after 4:00 AM for the current 4 AM-based day.
- **FR-019**: The good morning screen MUST NOT reappear for the remainder of the same 4 AM-based day once it has been seen.

**Labels & analysis (US8)**

- **FR-020**: The system MUST remove tags entirely, including tag creation, selection, the tags setting, and any tag-based reporting.
- **FR-021**: The system MUST provide a single labeling dimension for classifying time by merging the existing free-text block label into the existing Category concept and renaming "Category" to "Label". The merged Label MUST retain the categories' existing attributes (colors, credit rates, daily schedule goals). The separate free-text block label MUST no longer exist as an independent field.
- **FR-022**: The single Label control MUST be an expandable picker that lets the user choose an existing label or add a new one inline.
- **FR-022a**: A label created inline MUST be assigned neutral defaults (standard/neutral credit rate, an auto-assigned color, and no daily goal) and MUST be fully editable later in Label management.
- **FR-023**: Time analysis MUST report total time spent per label over a selected period.

**Wasted time (US9)**

- **FR-024**: Users MUST be able to configure an active window (start and end time of day) in settings within which untracked time is evaluated.
- **FR-025**: The system MUST count any time inside the active window that has no recorded time block as "wasted" time for that day.
- **FR-026**: The system MUST NOT count time outside the active window as wasted time.
- **FR-026a**: Wasted time MUST be a derived metric computed from in-window gaps (no "wasted" blocks are materialized). Retroactively recording a block over a gap MUST automatically reduce that day's wasted time.
- **FR-026b**: Wasted time MUST count against the day's productivity score as uncredited time.
- **FR-027**: When the user has not configured an active window, the system MUST apply a default active window of 9:00 AM–9:00 PM (user's timezone) until the user changes it.

### Key Entities *(include if feature involves data)*

- **Time Block**: A recorded interval of time with a start, an end (empty while running), a classification/label, and an intent. Central to timer reliability, the 4 AM split/restart, label analysis, and wasted-time gap detection.
- **Day**: A logical day running 4:00 AM → 4:00 AM in the user's timezone, with a closed/open state and associated daily metrics. Auto-closed at the boundary.
- **Task**: A unit of planned work with title, estimate, category, project, due/scheduled dates, and a lifecycle state (open, completed, dropped, passed). Now editable and shown with completion/passed strikethrough.
- **Label**: The single retained classification dimension for time, formed by renaming "Category" and absorbing the former free-text block label. Retains category attributes (color, credit rate, daily goal), is selectable from existing values or newly added inline, and is the unit of time aggregation in analysis. Replaces the prior labels + categories + tags arrangement.
- **Active Window**: A user-configured start/end time of day defining when untracked gaps are considered wasted.
- **Good Morning State**: A per-day (4 AM-based) flag indicating whether the start-of-day screen has been shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempts to stop and label a running timer succeed, including when the timer has run across one or more day boundaries (zero "app unusable" incidents from running timers).
- **SC-002**: After 4:00 AM, the prior day is closed automatically with no manual action in 100% of normal daily rollovers, and any running timer continues with no lost time across the boundary.
- **SC-003**: Starting a timer transitions the screen in under 200 ms as perceived by the user, independent of server response time.
- **SC-004**: Users can edit any field of an existing task and see the change reflected without recreating the task, in 100% of edit attempts.
- **SC-005**: The remaining tasks list shows exactly the set of not-completed, not-dropped tasks, verified across all task states.
- **SC-006**: Completed tasks and tasks whose day/week has passed are visually struck through 100% of the time they are displayed.
- **SC-007**: The good morning screen appears exactly once per 4 AM-based day, on first open after 4:00 AM.
- **SC-008**: No tag-related UI or reporting remains anywhere in the app after release.
- **SC-009**: Time analysis correctly attributes recorded time to labels such that the sum of per-label time equals total recorded time for the period (within rounding).
- **SC-010**: For a configured active window, reported wasted time equals the total in-window time minus recorded in-window block time, for every day evaluated.

## Assumptions

- The 4:00 AM boundary is evaluated in the user's existing per-account timezone (default `America/Los_Angeles`), consistent with current day-range logic.
- "Passed" for a task means its scheduled date (for daily items) or scheduled week (for weekly items) is earlier than the current 4 AM-based day/week.
- Removing tags includes removing historical tag associations from active views; whether historical tag data is purged or merely hidden is an implementation decision, but tags MUST NOT be user-visible after release.
- The optimistic timer start assumes a single running block per user; conflicts (e.g., a block already running from another device) are resolved by surfacing the conflict to the user rather than silently overwriting.
- Categories are renamed to Labels and absorb the former free-text block label (FR-021); projects, quality ratings, and intent remain available as separate concepts.
- "Carry forward context" on the 4 AM auto-restart includes at minimum the classification/label and stated intent of the block that was running.
- Wasted-time evaluation applies only to the active (non-off, non-vacation) days where the user is expected to be tracking time.

## Dependencies

- User Story 7 (good morning screen) and User Story 9 (wasted time) depend on User Story 2 (4 AM day boundary) being implemented first.
- User Story 8 merges categories and the free-text label into a single "Label" (FR-021); downstream day-scoped features (goals, scores) that referenced categories now reference labels.
