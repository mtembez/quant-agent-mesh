# Interactive Agile Project Development Life-Cycle (PDLC) Process Map

This document establishes the institutional Agile Scrum & XP engineering workflow governing development across all projects for Simon M. Munyambu (`@mtembez`).

---

## 1. End-to-End PDLC Flowchart

```text
[ PHASE 1: DISCOVERY & INCEPTION ]
  │
  ├── 1.1 Product Vision & Problem Statement (PRD.md)
  ├── 1.2 Architectural Spike & Technical Design Document (ARCHITECTURE.md)
  └── 1.3 Epics Definition & High-Level Roadmapping
  │
  ▼
[ PHASE 2: PRODUCT BACKLOG FORMULATION ]
  │
  ├── 2.1 User Story Deconstruction (As a... I want... So that...)
  ├── 2.2 Gherkin Acceptance Criteria (Given... When... Then...)
  └── 2.3 Fibonacci Story Point Estimation (1, 2, 3, 5, 8)
  │
  ▼
[ PHASE 3: INTERACTIVE AGILE SPRINT CYCLE ]
  │
  ┌─────────────────────────────────────────────────────────────┐
  │  CEREMONY 1: SPRINT PLANNING                                │
  │  - Set singular Sprint Goal                                 │
  │  - Select prioritized stories from Product Backlog          │
  │  - Lock Sprint Backlog Scope with Product Owner (User)      │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  CEREMONY 2: TDD SPRINT EXECUTION (STORY BY STORY)         │
  │  - Step 1: Red (Write failing unit/integration test)        │
  │  - Step 2: Green (Write minimal surgical implementation)    │
  │  - Step 3: Refactor (Optimize memory, POSIX compliance)     │
  │  - Step 4: Verification (Exit code 0, py_compile, pytest)   │
  │  - Step 5: User Checkpoint & Acceptance Sign-off            │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  CEREMONY 3: SPRINT REVIEW & LIVE DEMO                      │
  │  - Demonstrate runnable increment (CLI, ASGI API, UI)      │
  │  - Validate against Gherkin Acceptance Criteria             │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  CEREMONY 4: SPRINT RETROSPECTIVE                           │
  │  - What went well?                                          │
  │  - What broke / what was blocked?                           │
  │  - Actionable process improvement for next sprint           │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
[ PHASE 4: RELEASE & DEPLOYMENT ]
  │
  ├── 4.1 Git Tagging (SemVer vX.Y.Z)
  ├── 4.2 GitHub Actions CI/CD Run Verification
  └── 4.3 GitHub Release & Changelog Publication
```

---

## 2. Interactive Sprint Ceremonies (Rules of Engagement)

### Ceremony 1: Sprint Planning (Before Any Code is Written)
1. **User Role**: Product Owner & Lead Architect.
2. **AI Role**: Agile Engineering Pair.
3. **Artifact Produced**: Sprint Backlog Table with:
   * **Story ID** (e.g., `US-8.1`)
   * **Title & Intent** (`As a quantitative trader, I want...`)
   * **Story Points** (Fibonacci estimation)
   * **Acceptance Criteria** (Given/When/Then)
4. **Mandatory Gate**: The AI *cannot* begin coding until the user explicitly responds to approve or modify the Sprint Backlog and Sprint Goal.

### Ceremony 2: Incremental Story Execution (TDD Red-Green-Refactor)
1. Never implement an entire sprint in one unprompted batch.
2. For each User Story:
   * Present the Test Plan and the failing test (Red).
   * Implement the surgical solution (Green).
   * Run compiler and deterministic verification commands (Refactor / Verify).
   * Confirm with the user before transitioning to the next story.

### Ceremony 3: Sprint Review & Interactive Demo
1. Run the software in the live shell or browser.
2. Provide exact command-line walkthroughs (e.g., `python cli.py ...` or API curl commands).
3. Product Owner signs off on Acceptance Criteria.

### Ceremony 4: Sprint Retrospective
1. Review team velocity (Completed Story Points vs Committed).
2. Document engineering friction, bottlenecks, and performance anomalies.
3. Update `AGILE_SPRINTS.md` with real empirical retrospective findings.
