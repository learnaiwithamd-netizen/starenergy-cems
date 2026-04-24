# Star Energy CEMS — MVP Cost Tracker (2-Terminal Parallel Build)

**Baseline plan as of 2026-04-25.** Refrigeration-only MVP, 2-terminal parallel execution on Claude Max 20x, rate $20/hr, target 6-week build (2 months calendar including buffer + launch).

---

## Headline numbers

| | USD |
|---|---:|
| **Your effective hours** | **~230 hrs** |
| **Labor cost** (230 × $20) | **$4,600** |
| **Cash out-of-pocket** | **~$716** |
| **Contingency (15%)** | **~$797** |
| **TOTAL TO LAUNCH MVP** | **~$6,113** |
| Year 1 production run-rate (post-launch) | ~$1,920 |
| **GRAND TOTAL Year 1 (build + run)** | **~$8,033** |

**Cash breakdown (the actual money you'll spend):**
- Claude Max 20x × 2 months: **$400**
- Azure dev (2 mo, minimum tiers): **$80**
- Azure prod (launch month): **$119**
- Third-party services (SendGrid free, SSL free, weather API deferred): **$2**
- Domain registration: **$15**
- Legal templates (Termly) + training docs (Loom): **$100**
- **Cash total: ~$716**

Your labor ($4,600) is sweat equity — not cash out-of-pocket, but real value of your time.

---

## How to import into Google Sheets

1. Open a new Google Sheet
2. For each CSV in this folder: `File → Import → Upload`
3. Choose **"Insert new sheet(s)"** on import
4. Rename each tab to match the filename prefix: `01-dashboard`, `02-labor`, etc.
5. Dashboard formulas reference other tabs by these exact names — don't rename

---

## Files in this folder

| File | Purpose |
|---|---|
| `01-dashboard.csv` | Executive summary with totals, variance, scenarios |
| `02-labor.csv` | Every MVP story with Terminal A/B assignment + deferred features |
| `03-subscriptions-tools.csv` | Claude Max + dev tools (mostly free tiers) |
| `04-infrastructure.csv` | Azure dev + prod launch month + third-party |
| `05-one-time.csv` | Domain, legal templates, training docs |
| `06-production-runrate.csv` | Post-launch monthly ops + V2 future delta |
| `07-assumptions.csv` | Every assumption — tune to see impact |
| `08-actuals-log.csv` | Transaction log for live tracking |
| `09-token-estimates.csv` | Claude dev tokens + production LLM cost (0 in MVP) |
| `10-terminal-execution-plan.md` | **Week-by-week execution plan + file-system split** |

---

## The 2-terminal strategy

**Terminal A** owns backend / API / DB / calc / infrastructure.
**Terminal B** owns frontend (audit app + admin dashboard) / shared UI components.

With clean file-system boundaries, **1.4× speedup** is realistic — meaning 320 hours of Claude work compresses into ~230 hours of your attention across both terminals.

See `10-terminal-execution-plan.md` for:
- Exact file-path ownership rules
- Week-by-week epic/story assignment
- Daily rhythm
- Rate limit management
- Exit criteria

---

## What's in MVP vs. deferred

### IN (21 stories across 6 weeks)
- Epic 0: Foundation (trimmed — skip Python service, full a11y infra)
- Epic 1: Login + 2 roles (auditor, admin)
- Epic 2: Store selection + auto-save + nav
- Epic 3: Refrigeration only (compressor, condenser, display case)
- Epic 4: Camera + Blob upload + additional photos
- Epic 5: Review + submit + email confirmation + general section
- Epic 6: SQL seed scripts (no admin UI)
- Epic 7: Simple audit list (no state machine, no SLA)
- Epic 8: ECM refrigeration calc in Node (no LLM, no baseline)
- Epic 9: Puppeteer PDF + admin approve + client email

### OUT (deferred to V2+)
- Client portal (Epic 10) — email PDF replaces it
- LLM anomaly flagging (8-3)
- HVAC / Lighting / Building Envelope sections
- Energy baseline regression (8-2)
- Multi-auditor concurrent locking (3-6)
- Admin reference data UIs
- Full state machine + SLA timer + photo lock
- Report versioning + regeneration
- Python calc service (consolidated into Node)
- Weather API integration

---

## Scenarios on the dashboard

| Scenario | Cost | When this is reality |
|---|---:|---|
| Lean (scope held, no buffer burned) | ~$5,316 | Everything goes right |
| **Realistic** | **~$6,113** | Expected path |
| Slow (part-time 25 hr/wk, 10 weeks) | ~$9,400 | If you can't go full-time |
| Scope creep (HVAC/Lighting added back) | ~$8,700 | Resist this |

---

## Cost drivers — what actually moves the number

1. **Your hours** (70% of budget) — every 40-hour week saved = $800. Don't slip.
2. **Project duration** (carry costs: $200 Claude + $40 infra = $240/month) — every extra month = $240 pure carry.
3. **Scope creep** — adding HVAC/Lighting/Portal back adds ~150 hours ($3,000). Say no.
4. **Parallelism efficiency** — if 2-terminal speedup is 1.2× instead of 1.4×, add ~$660 to labor.

---

## Live tracking

1. Each day you work, log hours on `08-actuals-log.csv`
2. Weekly, update actual hours per story on `02-labor.csv`
3. Dashboard `Variance` columns auto-compute `(Actual − Estimate)`
4. At each week's end, review `07-assumptions.csv` — update values that have diverged
5. If you burn through 50% of contingency before Week 4, it's a signal to cut more scope, not overrun

---

## Not included (yet — flag for later)

- **Hired developer** — If quality or speed forces bringing in a contractor at $60/hr for ~50 hours polish work, add $3,000. Reflected in `02-labor.csv` by changing Rate per row.
- **Real client onboarding** — First paying client may want security audit ($4k), SOC2 scan ($2k+), lawyer review ($800+). Add when that conversation starts.
- **Go-to-market** — This is delivery cost only. No marketing, no sales, no customer success.
