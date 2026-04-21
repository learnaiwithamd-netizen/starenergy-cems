# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is a **BMAD Method** (v6.3.0) workspace — an AI-assisted product development framework installed for Claude Code. It is not a traditional software project. There is no build system, test runner, or source code to compile. The "code" here is a system of skills, agents, and structured workflows that Claude Code executes as slash commands.

**User:** Abhishek  
**Skill level:** Intermediate

## Directory Structure

```
_bmad/              # BMAD framework internals (do not modify)
  _config/          # Manifests: agent-manifest.csv, skill-manifest.csv, files-manifest.csv
  core/             # Core skills (brainstorming, distillation, review, etc.)
  bmm/              # BMM module: agents and product development workflow skills
_bmad-output/       # All generated artifacts land here
  planning-artifacts/    # PRDs, architecture docs, epics, UX specs
  implementation-artifacts/  # Story files, sprint plans, test suites
docs/               # Project knowledge base (user-maintained)
```

## How BMAD Works

Skills are invoked via slash commands (e.g., `/bmad-create-prd`). Each skill reads from and writes to specific folders defined in config:

- **Planning artifacts** → `_bmad-output/planning-artifacts/`
- **Implementation artifacts** → `_bmad-output/implementation-artifacts/`
- **Project knowledge** → `docs/`

Configuration lives in:
- `_bmad/core/config.yaml` — user name, language, output folder
- `_bmad/bmm/config.yaml` — project name, skill level, artifact paths

## The BMM Workflow Phases

Skills are organized into sequential phases:

1. **Analysis** (`1-analysis`) — Domain research, market research, brainstorming, product brief
2. **Planning** (`2-planning`) — Create/edit/validate PRD, UX design
3. **Solutioning** (`3-solutioning`) — Architecture, epics & stories, implementation readiness check
4. **Implementation** (`4-implementation`) — Sprint planning → create story → dev story → code review → QA → retrospective

## Key Agents (invoke by name or skill)

| Agent | Persona | Invoke via |
|-------|---------|------------|
| Mary | Business Analyst | `/bmad-agent-analyst` |
| John | Product Manager | `/bmad-agent-pm` |
| Winston | Architect | `/bmad-agent-architect` |
| Amelia | Developer | `/bmad-agent-dev` |
| Sally | UX Designer | `/bmad-agent-ux-designer` |
| Paige | Tech Writer | `/bmad-agent-tech-writer` |

## Frequently Used Skills

| Goal | Skill |
|------|-------|
| Get oriented / what to do next | `/bmad-help` |
| Create a PRD | `/bmad-create-prd` |
| Create architecture | `/bmad-create-architecture` |
| Break into epics & stories | `/bmad-create-epics-and-stories` |
| Run sprint planning | `/bmad-sprint-planning` |
| Implement a story | `/bmad-dev-story [story-file]` |
| Quick code change without full workflow | `/bmad-quick-dev` |
| Review code | `/bmad-code-review` |
| Multi-agent discussion | `/bmad-party-mode` |
| Check if ready to implement | `/bmad-check-implementation-readiness` |

## Active Project

The current project is **Star Energy CEMS** (Carbon/Energy Management System). Reference documents uploaded by the user live directly in `_bmad-output/`:
- `CEMS_PRD_1.0 (1).docx` — initial PRD draft
- `Scope of Work_CEMS.docx` — project scope
- `Star_Energy_CEMS/` — additional project materials

> Note: `_bmad/bmm/config.yaml` still has `project_name: BMAD` — update this to `Star Energy CEMS` when starting formal artifacts.

## Output Conventions

- Skills self-route their output to the correct folder — do not move generated files
- `docs/` is the project knowledge base; the tech writer agent writes there
- When a skill says "sprint plan" or "story", the file goes to `_bmad-output/implementation-artifacts/`
- The `bmad-distillator` skill can compress large docs for token-efficient downstream use
