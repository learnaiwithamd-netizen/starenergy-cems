# How to Import into Notion (for Abhishek)

This folder contains 12 markdown files:
- `00-overview.md` — the landing page for Star Energy
- `epic-00-*.md` through `epic-10-*.md` — one file per epic

## Recommended Notion structure

```
📘 Star Energy CEMS – Review (top-level page)
 └── 00 Overview                          ← 00-overview.md
 └── Epic 0: Platform Foundation           ← epic-00-*.md
 └── Epic 1: Authentication                ← epic-01-*.md
 └── Epic 2: Store Selection & Session     ← epic-02-*.md
 └── Epic 3: Refrigeration Data Collection ← epic-03-*.md
 └── Epic 4: Photo Capture                 ← epic-04-*.md
 └── Epic 5: Remaining Sections & Submit   ← epic-05-*.md
 └── Epic 6: Reference Data & Config       ← epic-06-*.md
 └── Epic 7: Admin Queue & State Machine   ← epic-07-*.md
 └── Epic 8: Calculation Engine            ← epic-08-*.md
 └── Epic 9: Report Generation             ← epic-09-*.md
 └── Epic 10: Client Portal                ← epic-10-*.md
```

## Import options

### Option A: Bulk import (fastest)
1. Zip this folder: `zip -r star-energy-review.zip star-energy-review/`
2. In Notion: **Settings & members → Settings → Import → Markdown & CSV**
3. Upload the zip — Notion creates one page per file.
4. Drag the pages under a single top-level "Star Energy CEMS – Review" page.
5. Rename each imported page from its filename to a clean title (e.g., `epic-03-...` → `Epic 3: Refrigeration Data Collection`).

### Option B: One page at a time (more control)
1. Create a top-level Notion page: **Star Energy CEMS – Review**
2. For each `.md` file, create a sub-page and copy/paste the markdown content.
   - Notion parses markdown on paste (headers, tables, bold, code blocks all work).
3. This is slower but lets you adjust formatting as you go.

### Option C: Single consolidated page (simplest for a short review)
1. Concatenate all files into one: `cat 00-overview.md epic-*.md > all.md`
2. Paste into a single Notion page.
3. Downside: comments are harder to thread by epic.

## Sharing with Star Energy

1. On the top-level "Star Energy CEMS – Review" page, click **Share**.
2. Add reviewer emails with **Can comment** access (not Edit).
3. Optionally toggle **Allow comments** on the page settings.
4. Send them the link with a short note — point them to `00 Overview` as the starting point.

## After review closes

- Export comment threads as a discussion log (Notion → ⋯ → Export).
- Triage actionable items back into `_bmad-output/planning-artifacts/epics.md`.
- Keep the Notion workspace as the canonical review record.

---

**Note:** The source of truth remains `_bmad-output/planning-artifacts/epics.md` in this repository. Any changes agreed during review should be made there first, then reflected back in Notion.
