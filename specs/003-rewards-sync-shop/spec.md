# Feature Specification: Rewards, Sync & Shop

**Feature Branch**: `003-rewards-sync-shop`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "Correct multi-device sync for good morning and day close (PDT 4 AM boundary); allocate tracked time to project/habit/task via dual dropdowns; rename label field; fix countdown timer direction across devices; complete tasks from home; sync day-closed state; apply 2x/2x/3x credit bonuses for task/habit/project allocation; simplify categories; add points shop with food coupon and PS5 rewards."

## Clarifications

### Session 2026-06-21

- Q: Shop fulfillment model for v1? → A: Symbolic only — in-app confirmation and redemption history; no real-world delivery.
- Q: Keep Sleep and Free time (earned) alongside the four activity categories? → A: No — only the four activity categories (Deep Work, Admin / Shallow, Cooking / Cleaning, Exercise); hide/remove Sleep and Free time from the active set.
- Q: How do allocation bonuses combine with quality and day-close multipliers? → A: Multiply together (allocation × quality × day-close).
- Q: Shop point costs for Food Coupon and PS5? → A: **850 points** (Food Coupon) and **16,500 points** (PS5). Rationale: at ~7–8 useful hours/day × 6 days with project/task allocation and day-close bonuses, typical weekly earnings are ~2,000–2,400 points — enough to redeem food weekly (~850) while banking ~1,200–1,500/week toward PS5 (~11 weeks at normal pace; ~6–7 weeks when pushing 10+ hour days with strong allocation).
- Q: Does habit time allocation count toward daily habit completion? → A: Yes — allocating tracked time to a habit auto-completes that habit for the day.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One greeting and one day-close state everywhere (Priority: P1)

A user opens the app on phone, laptop, or tablet throughout the day. After the 4:00 AM business-day boundary (in their configured timezone, default Pacific), they should see the morning rundown or unclosed-day prompt at most once per account per business day — not once per device. When they close a day on any device, every other device must immediately reflect that day as closed without asking them to close it again.

**Why this priority**: Duplicate prompts and double day-closes erode trust in the product and create incorrect scores and credits. Sync correctness is foundational.

**Independent Test**: Close a day on device A, then open device B — device B shows no unclosed-day prompt for that date. Dismiss good morning on device A, open device B after 4 AM — device B does not show good morning again for the same business day.

**Acceptance Scenarios**:

1. **Given** the current time is after 4:00 AM on business day D and the user has not yet seen the morning rundown for D, **When** they open the app on any device, **Then** the morning rundown or unclosed-day flow appears once.
2. **Given** the user dismissed the morning rundown on one device for business day D, **When** they open the app on another device the same day, **Then** the good-morning rundown does not appear again.
3. **Given** the user fully closed business day D on one device, **When** they open another device, **Then** day D is shown as closed and they are not prompted to close it again.
4. **Given** unclosed days exist before today, **When** the user opens the app after 4:00 AM, **Then** the unclosed-day prompt appears (not the good-morning greeting) until those days are resolved.

---

### User Story 2 - Allocate time to project, habit, or task (Priority: P1)

When starting, stopping, or editing a time block, the user selects what the time is for using two linked dropdowns: first the type (Project, Habit, or Task), then the specific item from that type's list. Only one allocation target is active at a time.

**Why this priority**: Accurate attribution drives bonuses, reporting, and task progress. This is core to how the user understands where their time went.

**Independent Test**: Stop a running timer, choose Task → a specific open task, save. The block shows that task and earns the task bonus multiplier.

**Acceptance Scenarios**:

1. **Given** the user is logging or editing a time block, **When** they open the allocation controls, **Then** they see a type selector (Project / Habit / Task) and a second selector listing all available items of the chosen type.
2. **Given** the user selects Habit as the type, **When** the second dropdown opens, **Then** it lists all active habits for the user.
3. **Given** the user selects Task as the type, **When** the second dropdown opens, **Then** it lists all available (non-completed, non-dropped) tasks.
4. **Given** the user changes the type from Project to Task, **When** they save, **Then** only the task link is stored and any prior project link is cleared.
5. **Given** a block is allocated to a task, **When** the user views task detail or stats, **Then** the block's minutes count toward that task's tracked time.

---

### User Story 3 - Countdown timer behaves consistently on every device (Priority: P1)

A user starts a focus countdown on one device, then opens the app on another. Both devices show the same countdown direction and remaining time, counting down toward zero — not counting up or showing elapsed time instead.

**Why this priority**: Inconsistent timer display across devices is confusing and breaks the focus workflow.

**Independent Test**: Start a 25-minute focus countdown on device A, open device B within a minute — both show countdown with matching remaining time.

**Acceptance Scenarios**:

1. **Given** a running block has a focus countdown target, **When** the user views it on any device, **Then** the primary clock counts down (not up) to the target duration.
2. **Given** a countdown was started on device A, **When** the user opens device B, **Then** device B reads the same countdown target and direction from the user's account data (not device-local storage alone).
3. **Given** no focus target is set, **When** the user views a running block, **Then** the clock shows elapsed time counting up.
4. **Given** the countdown reaches zero, **When** the user is on any device, **Then** they receive the same focus-complete prompt to log the block.

---

### User Story 4 - Earn bonus credits for allocated time (Priority: P2)

When the user allocates tracked time to a task, habit, or project, they earn multiplied credits on top of the base category rate: 2× for tasks, 2× for habits, 3× for projects. The bonus applies only when a specific item is linked, not when the type is left unselected.

**Why this priority**: Incentivizes linking time to meaningful goals and makes the points economy meaningful for the shop.

**Independent Test**: Log one hour of Deep Work linked to a project; credits earned reflect base rate × quality multiplier × 3× project bonus.

**Acceptance Scenarios**:

1. **Given** a completed block allocated to a task, **When** credits are computed, **Then** the task allocation bonus of 2× is applied.
2. **Given** a completed block allocated to a habit, **When** credits are computed, **Then** the habit allocation bonus of 2× is applied.
3. **Given** a completed block allocated to a project, **When** credits are computed, **Then** the project allocation bonus of 3× is applied.
4. **Given** a completed block with no allocation target, **When** credits are computed, **Then** only the base category and quality multipliers apply (no allocation bonus).
5. **Given** a completed block allocated to a habit, **When** the block is saved, **Then** that habit is marked complete for the current business day.
6. **Given** the user views stats or end-of-day summary, **When** allocation bonuses contributed to earnings, **Then** the bonus is visible in the breakdown.

---

### User Story 5 - Simplified activity categories (Priority: P2)

The user works with exactly four activity categories: Deep Work, Admin / Shallow, Cooking / Cleaning, and Exercise. All other categories (including Sleep, Free time, Learning, Regular work, etc.) are archived and hidden from new-block selection but remain editable in category management for historical records.

**Why this priority**: Reduces decision fatigue when logging time and aligns categories with how the user actually thinks about their day.

**Independent Test**: A new user (or migrated account) sees only the four activity categories when starting a timer. Historical blocks on old categories still display correctly.

**Acceptance Scenarios**:

1. **Given** a user starts a new time block, **When** they choose a category, **Then** the picker shows only Deep Work, Admin / Shallow, Cooking / Cleaning, and Exercise.
2. **Given** a user has historical blocks on removed categories (e.g., Learning, Sleep), **When** they view past days, **Then** those blocks still display with their original category.
3. **Given** a user opens category management, **When** they edit a category, **Then** they can change name, color, and credit rate for any category including archived ones.
4. **Given** a new account is created, **When** default categories are seeded, **Then** only the four approved activity categories are created as active.

---

### User Story 6 - Complete tasks from the home page (Priority: P2)

From the main Today/home view, the user can mark a task as done without navigating to the Tasks page — including tasks in the pinned top-3 and other visible today tasks.

**Why this priority**: Reduces friction for the most common daily action after tracking time.

**Independent Test**: On Today, tap complete on a visible task; it moves to completed state and updates score/credits feedback.

**Acceptance Scenarios**:

1. **Given** a task appears on the Today home view, **When** the user taps complete/done, **Then** the task is marked completed with the same outcome as completing it on the Tasks page.
2. **Given** a task is completed from home, **When** the user opens the Tasks page, **Then** the task shows as completed there too.
3. **Given** completion affects the daily productivity score, **When** the user completes from home, **Then** they receive the same score feedback (e.g., toast) as on the Tasks page.

---

### User Story 7 - Spend earned points in a shop (Priority: P3)

The user accumulates credit points from tracked time and bonuses. A Shop area lets them browse rewards and redeem points symbolically (in-app confirmation and history only — no real-world fulfillment in v1). Initial catalog: Food Coupon (850 points) and PlayStation 5 (16,500 points). Balance updates immediately on redemption; insufficient balance blocks purchase.

**Why this priority**: Closes the motivation loop — points earned from disciplined time tracking can be "spent" on meaningful rewards.

**Independent Test**: User with ≥850 points redeems Food Coupon; balance decreases by 850 and redemption is recorded.

**Acceptance Scenarios**:

1. **Given** the user has a credit balance, **When** they open Shop, **Then** they see their current balance and available items with point costs.
2. **Given** the user has at least 850 points, **When** they redeem a Food Coupon, **Then** 850 points are deducted and the redemption is saved to their history with an in-app confirmation (no external fulfillment).
3. **Given** the user has fewer than 16,500 points, **When** they attempt to redeem a PS5, **Then** the action is blocked with a clear insufficient-balance message.
4. **Given** a successful redemption, **When** the user views Shop or Stats, **Then** the updated balance is consistent everywhere.

---

### User Story 8 - Clearer intent field when tracking time (Priority: P3)

The free-text field previously labeled "Label" is renamed to communicate purpose: a one-line explanation of what the user will be doing (or did). Placeholder and help text reinforce this.

**Why this priority**: Small UX fix that reduces confusion when starting timers.

**Independent Test**: Start or stop a block — the field reads as an intent/description prompt, not a generic "label."

**Acceptance Scenarios**:

1. **Given** the user starts or stops a timer, **When** they see the text field, **Then** it is labeled to ask what they will be doing in one line (not "Label").
2. **Given** the user enters intent text, **When** the block is saved, **Then** the text is stored and displayed on the block row and in focus mode.

---

### Edge Cases

- User opens app exactly at 4:00 AM boundary — greeting/unclosed logic uses the business-day rules consistently (activity before 4 AM belongs to prior day).
- User dismisses good morning while offline on device A, then opens device B online — server `amSeenAt` prevents re-show once synced.
- User has two devices open simultaneously at day close — only one close succeeds; the other refreshes to closed state without duplicate credit awards.
- Allocation dropdown lists empty (no tasks/habits/projects) — second dropdown shows empty state with guidance to create one.
- User allocates to a task that is later completed or dropped — historical blocks retain the link; new blocks cannot select dropped tasks.
- Countdown started without network — once synced, all devices converge on server-stored target.
- Category migration: blocks on archived categories remain readable; user cannot pick archived categories for new blocks unless un-archived in settings.
- Shop redemption with exact balance — allowed; zero balance after redemption displays correctly.
- Concurrent shop redemption attempts — only one succeeds if balance covers a single item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat the business day as starting at 4:00 AM in the user's configured timezone (default America/Los_Angeles / Pacific).
- **FR-002**: System MUST show the good-morning rundown at most once per user account per business day, tracked server-side (not per device or browser storage).
- **FR-003**: System MUST show the unclosed-day prompt when prior business days lack a close record, regardless of device, until those days are closed.
- **FR-004**: System MUST persist day-closed state (`endedAt`) server-side so all devices reflect the same closed days without duplicate close prompts.
- **FR-005**: System MUST provide a two-step allocation control: (1) type = Project | Habit | Task, (2) specific item from that type's active list.
- **FR-006**: System MUST store at most one allocation target per time block (project OR habit OR task).
- **FR-007**: System MUST list all available tasks, active habits, and active projects in the respective second dropdown.
- **FR-008**: System MUST rename the user-facing "Label" field to communicate one-line intent ("what you will be doing").
- **FR-009**: System MUST persist focus countdown target and mode (countdown vs count-up) on the running block server-side so all devices display consistent countdown behavior.
- **FR-010**: System MUST allow marking tasks complete from the Today/home page with parity to the Tasks page.
- **FR-011**: System MUST apply allocation credit bonuses multiplicatively with quality and day-close bonuses: 2× for task-linked blocks, 2× for habit-linked blocks, 3× for project-linked blocks, on top of base category rate.
- **FR-011a**: System MUST auto-complete the linked habit for the current business day when time is allocated to that habit.
- **FR-012**: System MUST limit active categories to exactly four: Deep Work, Admin / Shallow, Cooking / Cleaning, and Exercise (all other categories archived and hidden from new-block selection).
- **FR-013**: System MUST archive (not delete) removed legacy categories and preserve historical block display.
- **FR-014**: System MUST retain category edit capability (name, color, credit rate) for all categories including archived.
- **FR-015**: System MUST provide a Shop view showing credit balance, catalog items, and redemption actions.
- **FR-016**: System MUST offer Food Coupon at 850 points and PlayStation 5 at 16,500 points as initial catalog items.
- **FR-017**: System MUST deduct points atomically on redemption, record redemption history, and show in-app confirmation only (symbolic fulfillment — no real-world delivery in v1).
- **FR-018**: System MUST block redemption when balance is insufficient and show a clear message.

### Key Entities

- **Day Status**: Per-user, per-business-date record of whether the day is closed (`endedAt`), credits earned, and related metadata.
- **Daily Review**: Per-user, per-business-date morning dismissal timestamp (`amSeenAt`) driving once-per-day greeting.
- **Time Block**: Tracked interval with category, optional intent text, optional allocation (project, habit, or task), optional focus countdown target and mode.
- **Category**: Named activity type with credit rate, color, archived flag; simplified default set for new users.
- **Shop Item**: Redeemable reward with name, description, and point cost.
- **Redemption**: Record of user, item, points spent, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users who close a day on one device see that day as closed on a second device within one page load (no duplicate close prompt).
- **SC-002**: Good-morning rundown appears at most once per account per business day across all devices in user testing (0 duplicate greetings reported in a 5-device test).
- **SC-003**: Countdown timers opened on a second device match the first device's remaining time within 2 seconds.
- **SC-004**: Users can allocate a stopped block to a task, habit, or project in under 10 seconds using the dual dropdowns.
- **SC-005**: Allocation bonuses are reflected correctly in credit calculations for 100% of test cases (task 2×, habit 2×, project 3×).
- **SC-006**: Users can complete a task from the home page in one tap with the same outcome as the Tasks page.
- **SC-007**: Shop redemption completes in under 5 seconds with immediate balance update visible on Stats and Shop.
- **SC-008**: At 7–8 useful hours/day × 6 days/week with typical allocation bonuses, a user earns ~2,000–2,400 points/week — enough to redeem Food Coupon weekly (~850) while banking ~1,200–1,500/week; PS5 (~16,500) is reachable in ~11 weeks at normal pace or ~6–7 weeks when consistently exceeding 8 hours/day.

## Assumptions

- User timezone defaults to Pacific (PDT/PST) but remains user-configurable; all 4 AM boundaries use that setting.
- `amSeenAt` and `endedAt` are already stored server-side; this feature fixes any client-side or cache gaps causing per-device duplication.
- Focus countdown is currently device-local; migration stores target minutes on the block record.
- "Cooking / Cleaning" maps to daily upkeep activities (formerly "Chores"); one combined category.
- Only four activity categories are active; Sleep, Free time (earned), and all legacy categories are archived (hidden from new blocks, preserved for history).
- Legacy categories (Regular work, Learning, etc.) are archived, not deleted; historical data is untouched.
- Allocation bonuses multiply with existing quality and day-close bonuses (not replace them).
- Shop redemptions are symbolic only in v1 — in-app confirmation and history; no physical fulfillment.
- Shop pricing: Food Coupon 850 points (affordable weekly at normal pace), PS5 16,500 points (aspirational; ~11 weeks normal stacking or ~6–7 weeks when pushing beyond 8 h/day).
- Allocating time to a habit auto-completes that habit for the business day.
