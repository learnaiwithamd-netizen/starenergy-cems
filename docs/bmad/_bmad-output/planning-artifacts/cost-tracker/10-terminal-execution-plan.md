# 2-Terminal Execution Plan — Star Energy CEMS MVP

**Goal:** Ship refrigeration-only MVP in 6 weeks build + 2 weeks buffer = 2 months total.

**Pace assumption:** 40 hrs/week of your effective time, split across 2 Claude Code terminals running in parallel on Claude Max 20x.

---

## Terminal split — file-system boundaries

To avoid merge conflicts and architectural drift, each terminal owns specific paths. **Never have both terminals write to the same file in a session.**

### Terminal A — Backend, API, DB, Calc
**Owns these paths:**
- `apps/api/**` — Fastify server, routes, middleware
- `apps/calc/**` — Calculation engine (Node, not Python for MVP)
- `packages/shared/**` — Types, schemas, contracts (single source of truth)
- `packages/db/**` — Prisma schema, migrations, RLS policies
- `infrastructure/**` — Bicep/Terraform, Azure config
- `.github/workflows/**` — CI/CD

**Typical work:** schema changes, API endpoints, calc logic, auth, BullMQ jobs, Puppeteer PDF rendering, blob uploads, email delivery.

### Terminal B — Frontend, UI
**Owns these paths:**
- `apps/audit/**` — Field auditor React app
- `apps/admin/**` — Admin dashboard React app
- `packages/ui/**` — Shared component library (minimal — Tailwind defaults)
- `packages/hooks/**` — React hooks (auto-save, form state)

**Typical work:** screens, components, forms, camera integration, routing, state management, styling.

### What both terminals read but only A writes
- `packages/shared/types.ts` — A defines, B imports
- `packages/shared/api-contract.ts` — A defines, B consumes

**Rule:** If Terminal B needs a new type or endpoint, Terminal A creates it first. Then B pulls and consumes. No exceptions — this prevents 90% of integration bugs.

---

## Week-by-week plan

### Week 1 — Foundation (partly sequential)

**Sequential phase (Days 1–2, Terminal A alone):**
- Finish 0-3 (DB schema + RLS foundation)
- 0-4 (Node.js API foundation + BullMQ)
- Spike resolution: RLS + Puppeteer + Redis fallback

**Parallel phase (Days 3–5):**
| Terminal A | Terminal B |
|---|---|
| 0-6 CI/CD pipeline | 0-7 minimal design tokens + Tailwind setup |
| 1-1 Login API + JWT | 1-1b Login UI screen |
| 1-2 RBAC API guards | 1-2b Route guards frontend |

**End of Week 1:** Auth works end-to-end. Foundation locked.

---

### Week 2 — Store selection + navigation

| Terminal A | Terminal B |
|---|---|
| 2-1 Store reference API | 2-1b Store selector screen |
| 2-2 Draft creation API | 2-2b Auto-fill UI |
| 2-3 Auto-save API endpoints | 2-3b Auto-save frontend hook |
| 1-3 Admin user management API | 2-4 Section overview + nav shell |

**End of Week 2:** Auditor can log in, pick a store, start a draft, resume later. Nav shell ready for audit screens.

---

### Week 3 — Refrigeration core (heaviest week)

| Terminal A | Terminal B |
|---|---|
| 3-3a Compressor + regression DB lookup API | 3-1 Audit breadcrumb + machine room screen |
| 4-2 Azure Blob upload API + auto-tag | 3-3b Compressor screens UI |
| 6-1 Store seed script (SQL) | 3-4 Condenser + display case screens |
| 6-2 Compressor regression seed script | |

**End of Week 3:** Field auditor can enter compressor + condenser + display case data. Photos upload.

---

### Week 4 — Photos + remaining sections + calc start

| Terminal A | Terminal B |
|---|---|
| 8-1 ECM refrigeration calc (start) | 4-1 Camera + PhotoCaptureField component |
| 1-3 Admin user mgmt finishing | 4-3 Additional photos + comments |
| | 5-1 General section screens |
| | 3-4 Condenser/case finishing |

**End of Week 4:** Audit fully capturable. Calc engine running on test data.

---

### Week 5 — Submission + reports

| Terminal A | Terminal B |
|---|---|
| 8-1 ECM calc finish | 5-4 Review + submit screen |
| 9-1 Puppeteer PDF renderer | 5-5 Submission confirmation |
| 9-2a Admin approve + publish API | 7-1b Admin audit queue UI |
| 9-4 Client email on publish | 9-2b Admin approve UI |
| 5-5 Email notification (SendGrid) | 8-5 Calc I/O view (read-only) |

**End of Week 5:** End-to-end flow works. Admin can approve, PDF generates, client gets email.

---

### Week 6 — Integration, polish, launch

Both terminals converge on:
- End-to-end integration tests
- Bug fixes from self-test
- Prod deployment via CI/CD
- Smoke tests against production
- Auditor onboarding doc + short Loom walkthrough
- First real audit (you or a trusted tester runs one end-to-end)

**End of Week 6:** MVP deployed. First audit completed end-to-end.

---

### Weeks 7–8 — Buffer + real-world feedback

- Real auditor (Marcus persona) uses it for 2–3 real audits
- Bug fixes from field usage
- Azure tier adjustments based on observed load
- Documentation gaps closed

---

## Daily rhythm (recommended)

**Morning (9–12):** 
- Terminal A: backend/calc work
- Terminal B: UI work  
- You: split attention ~70/30 between them based on which needs more review

**Afternoon (1–4):**
- Integration test yesterday's output
- Merge Terminal A's shared types → pull into Terminal B
- Review PRs / commits from both

**End of day (4–5):**
- Stand-up with yourself: what shipped, what's blocked, what's next
- Update `08-actuals-log.csv` with hours spent

**Weekly:**
- Friday afternoon: retrospective. Update `07-assumptions.csv` if reality diverged.
- Sunday: plan next week's terminal assignments

---

## Guardrails — when to slow down

Stop adding to Terminal B if:
- You haven't reviewed Terminal A's last 3 commits
- `packages/shared/types.ts` has diverged between terminals
- You're feeling scattered — quality drops fast with split attention

**Fallback:** drop to 1 terminal for a day, let one catch up, then re-fork.

---

## Rate limit management

Max 20x gives you roughly:
- Comfortable: 2 concurrent Sonnet sessions
- Tight: 3 concurrent sessions
- Expect throttling: Opus on any parallel session

**Rule:** Keep at most one terminal on Opus (use it for architecture/design sessions). Both terminals on Sonnet for implementation.

If you hit rate limits:
- Pause the less-critical terminal
- Switch that terminal to manual coding mode (no Claude)
- Wait out the 5-hour rolling window

---

## Exit criteria for MVP launch

- [ ] An auditor can log in, pick a store, complete a refrigeration audit end-to-end
- [ ] All photos upload and display in admin view
- [ ] Admin can see the audit, run calc, approve, publish
- [ ] Client receives email with PDF attached
- [ ] PDF renders consistently (no memory leaks on Puppeteer)
- [ ] RLS verified — different auditor accounts see only their data
- [ ] One real end-to-end audit completed in production
- [ ] Cost-to-date tracked on `08-actuals-log.csv`

---

## What's explicitly out of scope for MVP

| Feature | Why deferred | When to add |
|---|---|---|
| Client portal (Epic 10) | Email PDF delivery sufficient for MVP | V2 when multiple clients |
| LLM anomaly flagging (8-3) | Manual admin review works at low volume | V2 at >50 audits/mo |
| HVAC / Lighting / Envelope sections | Refrigeration is core value | V2 quarter |
| Energy baseline regression (8-2) | Needs weather API + more history | V2 after 6 months data |
| Multi-auditor locking (3-6) | Single auditor per audit for MVP | V3 when team scales |
| Admin reference data UIs (Epic 6 UI) | SQL seed scripts work | V2 when data changes often |
| Full state machine (Epic 7) | Simple SUBMITTED → PUBLISHED works | V2 when QA loop matures |
| Photo upload retry queue (4-4) | Fail-loud + manual re-upload fine | V2 at scale |
| Report versioning / regeneration (9-3/9-5) | Immutable-after-publish OK for MVP | V2 when corrections common |
| SLA timer (7-2) | Not needed for internal beta | V2 with real SLAs |
