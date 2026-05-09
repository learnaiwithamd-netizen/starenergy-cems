# Story 2.4: Section Overview & Navigation Shell

Status: review

<!-- Spec authored from epic-02 ACs (no separate create-story run). Lines 99–133 of
docs/bmad/_bmad-output/planning-artifacts/star-energy-review/epic-02-audit-app-store-selection-session-foundation.md
are the canonical AC source. -->

## Story

As an Auditor,
I want a clear overview of all five audit sections showing completion status,
so that I always know exactly where I am in the audit, what's done, and what's left.

**Source:** [epic-02 lines 99–133](../planning-artifacts/star-energy-review/epic-02-audit-app-store-selection-session-foundation.md). Covers FR2 (section navigation), FR8 (session state visibility). Builds directly on 2.3's `SectionOverviewPage` (Not Started + In Progress states).

**Scope clarification.** 2.4 completes the Section Overview shell:

- The **Complete** state for SectionCards: green ✓ checkmark + animation on transition. 2.3 rendered Not Started and In Progress; 2.4 adds the third state.
- **SectionProgressBar**: a visual `Progress` bar (from `@cems/ui`) at the top of the section list showing "X of 5 sections complete". The text counter already exists from 2.3; 2.4 adds the visual bar.
- **Navigation from Complete cards**: Complete cards remain tappable (navigate to the section — auditor can review/edit already-completed sections). Same route as Not Started / In Progress: `/audit/:auditId/section/:sectionId`.

**Out of scope (explicitly deferred):**
- The mechanism to *mark* a section complete (no "Complete" button) — Story 5.4 / 3.5 ship section-completion triggers. 2.4 only renders the Complete state when `completedAt` is already set server-side.
- Section sub-screen routing ("first incomplete screen within a section") beyond the section root — that logic belongs to each section's own story (3.x / 5.x).
- New API changes — all data comes from the existing `GET /api/v1/audits/:id` endpoint delivered in 2.3.

## Acceptance Criteria

1. **AC1 — Five SectionCards displayed.** General, Refrigeration, HVAC, Lighting, Building Envelope — each showing current status. *(Infrastructure from 2.3; verified by existing tests.)*

2. **AC2 — "Not Started" state** (gray border, no checkmark); `aria-label="[Section name]: Not Started"`. *(From 2.3; verified by existing tests.)*

3. **AC3 — "In Progress" state** (blue border); `aria-label="[Section name]: In Progress"`. *(From 2.3; verified by existing tests.)*

4. **AC4 — "Complete" state.** Green border + ✓ checkmark rendered in the card; `aria-label="[Section name]: Complete"`. The card applies `transition-colors duration-200` so the border animates from In Progress (blue) to Complete (green) when `completedAt` becomes set.

5. **AC5 — Navigation from any card.** Tapping a Not Started, In Progress, or Complete card navigates to `/audit/:auditId/section/:sectionId`. *(From 2.3; verified by existing link rendering.)*

6. **AC6 — SectionProgressBar.** A visual `Progress` bar (from `@cems/ui`) renders above the section list with `value` = `(completeCount / total) * 100`. Accompanied by the existing "X of 5 sections complete" text. `aria-label="Audit completion"` on the bar.

## Tasks / Subtasks

- [x] **Task 1 — Mark sprint-status 2.4 in-progress (prerequisite)**
  - [x] Edit `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`: `2-4-section-overview-and-navigation-shell: backlog` → `in-progress`. Bump `last_updated`.

- [x] **Task 2 — SectionCard: Complete state with checkmark + transition animation (AC4)**
  - [x] Edit `apps/audit-app/src/features/audit/SectionOverviewPage.tsx`:
    - Add `transition-colors duration-200` to SectionCard link classes.
    - When `status === 'complete'`: render a `✓` span with `aria-hidden="true"` and `text-success` colour replacing the plain status text; use `text-success text-xs font-medium` styling.
    - Keep `aria-label` unchanged (`"${label}: ${STATUS_LABEL[status]}"`) — the checkmark is presentational.

- [x] **Task 3 — SectionProgressBar (AC6)**
  - [x] Edit `apps/audit-app/src/features/audit/SectionOverviewPage.tsx`:
    - Import `Progress` from `@cems/ui`.
    - Added `<Progress value={(completeCount / SECTION_IDS.length) * 100} aria-label="Audit completion" className="mt-2" />` below the text counter.
    - Also fixed a bug in `packages/ui/src/components/Progress.tsx`: `value` was destructured but not forwarded to `ProgressPrimitive.Root`, so `aria-valuenow` was never set. Fixed by adding `value={value}` to the Root props.

- [x] **Task 4 — Tests: Complete state + SectionProgressBar (AC4, AC6)**
  - [x] Edit `apps/audit-app/src/features/audit/SectionOverviewPage.test.tsx`:
    - Added test: Complete state renders ✓ for a section with `completedAt` set; aria-label = `"General: Complete"`.
    - Added test: `completeCount = 1` → progressbar `aria-valuenow = "20"` (1/5 × 100).
    - Added test: `completeCount = 2` → progressbar `aria-valuenow = "40"` (2/5 × 100).
    - Added test: axe scan passes with a mix of Not Started / In Progress / Complete states.

## Dev Notes

- **Existing foundation:** `SectionOverviewPage.tsx` already has `deriveStatus` (returns `'complete'` when `completedAt` is set), the section cards, and the "X of 5 sections complete" counter — all from Story 2.3. Task 2 and 3 layer on top without touching 2.3's logic.
- **Animation approach:** CSS transitions via Tailwind (`transition-colors duration-200`) on the Link element satisfy "animation on transition" without custom keyframes. The ✓ checkmark is rendered as a `<span aria-hidden="true">` so screen readers rely on the `aria-label` (which already says "Complete") rather than the symbol.
- **Progress bar:** Use `@cems/ui` `Progress` component directly. `value` is a 0–100 number. Radix Progress already sets `role="progressbar"` and `aria-valuenow`/`aria-valuemax` internally — no extra ARIA needed beyond `aria-label`.
- **Test pattern:** Mock `fetch` to return an `AuditDetail` with `completedAt` set on one section. Verify `aria-label` on the card and the ✓ symbol. For the progress bar, query the `[role="progressbar"]` element and check its `aria-valuenow`.
- **No API changes:** All data comes from the existing `GET /api/v1/audits/:id` endpoint.

## Dev Agent Record

### Implementation Plan

1. Create story file (this file) and mark sprint-status in-progress.
2. Update `SectionOverviewPage.tsx`: add `transition-colors duration-200`, add ✓ checkmark for complete, add Progress bar.
3. Update `SectionOverviewPage.test.tsx`: add Complete state test, progress bar test, mixed-state axe scan.
4. Run `pnpm test` — all tests green.
5. Mark tasks complete and update story to "review".

### Debug Log

*(empty)*

### Completion Notes

- **Task 2 (Complete state):** Added `transition-colors duration-200` to `SectionCard` link. When `status === 'complete'`, renders `<span aria-hidden="true">✓</span>` alongside green `text-success` label. `aria-label` unchanged — screen readers read "Complete" from the label, not the symbol.
- **Task 3 (SectionProgressBar):** Imported `Progress` from `@cems/ui` and added `<Progress value={(completeCount / SECTION_IDS.length) * 100} aria-label="Audit completion" className="mt-2" />`. Also fixed a pre-existing bug in `packages/ui/src/components/Progress.tsx` where `value` was destructured out but not forwarded to `ProgressPrimitive.Root`, preventing `aria-valuenow` from being set.
- **Task 4 (Tests):** 4 new tests in `SectionOverviewPage.test.tsx` — Complete state checkmark, progress bar at 20%, progress bar at 40%, mixed-state axe scan. All 12 tests pass.
- Full monorepo: 12/12 tasks, 375+ tests, zero regressions.

## File List

- `docs/bmad/_bmad-output/implementation-artifacts/2-4-section-overview-and-navigation-shell.md` (this file — new)
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)
- `apps/audit-app/src/features/audit/SectionOverviewPage.tsx` (modified)
- `apps/audit-app/src/features/audit/SectionOverviewPage.test.tsx` (modified)
- `packages/ui/src/components/Progress.tsx` (bug fix — `value` now forwarded to Radix root)

## Change Log

| Date       | Change                                   |
|------------|------------------------------------------|
| 2026-05-09 | Story created and implementation started |
