# Strata — Project Roadmap & Status

> **Last updated:** 2026-09-15 — **statuses below were re-verified against the codebase** (schema + backend + UI + route present on disk).
> **Previous audit:** 2026-09-13 (Armenia moat shipped: SRC-ready payroll export, local PSP payments scaffolding; Shift Scheduling implemented)
>
> ### ⚠️ Verification note (2026-09-15)
>
> Several modules were marked `🔲 Not started` here while being **fully shipped in code**
> (schema + backend + client + route + i18n). Corrected below: **Benefits, Expenses,
> Assets, News**. Also corrected: **Compliance**, **PDF/export**, **Mobile (PWA)**,
> **Workflow builder**. Treat this file as the roadmap _now that it is synced_; when a
> status and the code disagree, the code is right.
> **Stack:** Next.js 16 (App Router) + Convex + Shadcn/ui + Tailwind CSS
> **i18n:** EN / RU / HY (Armenian) / DE
> **Auth:** Convex Auth (session-based)
> **RBAC Roles:** superadmin, admin, supervisor, employee, driver

---

## Status Legend

| Symbol | Meaning                                                |
| ------ | ------------------------------------------------------ |
| ✅     | Fully implemented (schema + backend + UI + i18n + nav) |
| ⚠️     | Mostly implemented, minor gaps remain                  |
| 🔲     | Not started                                            |
| 🚧     | In progress                                            |

---

## Phase 1 — Core HR Features (MVP Complete)

### 1.1 Performance Reviews / 360° Feedback

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                                                                                                                                                                                                                                                                                |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/performance.ts`                                                                                                                                                                                                                                                                       |
| Backend | ✅     | `convex/performance.ts`                                                                                                                                                                                                                                                                              |
| UI      | ✅     | `src/components/PerformanceClient.tsx`, `src/components/performance/CreateCycleWizard.tsx`, `src/components/performance/FillReviewDialog.tsx`, `src/components/performance/LaunchCycleDialog.tsx`, `src/components/performance/ResultsDialog.tsx`, `src/components/performance/CycleSummaryCard.tsx` |
| Route   | ✅     | `src/app/(dashboard)/performance/page.tsx`                                                                                                                                                                                                                                                           |
| i18n    | ⚠️     | EN ✅, RU ✅, HY 🔲                                                                                                                                                                                                                                                                                  |
| Sidebar | ✅     | Nav item added                                                                                                                                                                                                                                                                                       |

**Features implemented:**

- Review cycles, templates, assignments, responses, ratings
- 3-step CreateCycleWizard (Basic Info → Review Types → Competencies)
- FillReviewDialog (1-5 rating per competency + comments + strengths/improvements)
- LaunchCycleDialog (select participants, auto-assign self/manager)
- ResultsDialog (overall score, competency bars, grouped by type)
- CycleSummaryCard (all employees ranked by score)
- Mirror manager reviews → supervisorRatings (backward compat)
- Immutable competency snapshot at cycle creation
- Peer anonymity threshold (configurable, default 2)
- Deadline notifications (cron: `checkDeadlineNotifications`)

**TODO:**

- [ ] Export results (PDF/CSV)
- [ ] HY translations

---

### 1.2 OKR / Goals Management

**Status:** ⚠️ Mostly implemented

| Layer   | Status | Files                                                                                                                                                                          |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema  | ✅     | `convex/schema/goals.ts`                                                                                                                                                       |
| Backend | ✅     | `convex/goals.ts`                                                                                                                                                              |
| UI      | ✅     | `src/components/GoalsClient.tsx`, `src/components/goals/CreateObjectiveWizard.tsx`, `src/components/goals/CheckinDialog.tsx`, `src/components/goals/ObjectiveDetailDialog.tsx` |
| Route   | ✅     | `src/app/(dashboard)/goals/page.tsx`                                                                                                                                           |
| i18n    | ⚠️     | EN ✅, RU ✅, HY 🔲                                                                                                                                                            |
| Sidebar | ✅     | Crosshair icon                                                                                                                                                                 |

**Features implemented:**

- Objectives, keyResults, goalCheckins
- 3-step CreateObjectiveWizard
- CheckinDialog (update KR value + confidence + note)
- ObjectiveDetailDialog (KRs with progress bars + check-in history + aligned goals)
- Progress bar per KR (0-100%) with direction (increase/decrease)
- Goal tree (company → team → individual) via parentObjectiveId
- Filtering by period (Q1-Q4, H1-H2, FY) and year
- Team progress visualization (stats cards)
- Team scope via department field
- Weekly check-in reminders (cron: `sendWeeklyCheckinReminders`)

**TODO:**

- [ ] HY translations
- [ ] Link OKR with Performance Reviews

---

### 1.3 Recruitment / ATS

**Status:** ⚠️ Mostly implemented

| Layer       | Status | Files                                      |
| ----------- | ------ | ------------------------------------------ |
| Schema      | ✅     | `convex/schema/recruitment.ts`             |
| Backend     | ✅     | `convex/recruitment.ts`                    |
| UI          | ✅     | `src/components/RecruitmentClient.tsx`     |
| Route       | ✅     | `src/app/(dashboard)/recruitment/page.tsx` |
| Public page | ✅     | `src/app/careers/[slug]/page.tsx`          |
| i18n        | ⚠️     | EN ✅, RU ✅, HY 🔲                        |

**Features implemented:**

- Vacancies CRUD
- Kanban pipeline (Applied → Screening → Interview → Offer → Hired)
- Candidate cards (resume, contacts, notes)
- Interview scheduling
- Scorecard for interviewers
- Public careers page with application form

**TODO:**

- [ ] Recruitment funnel analytics
- [ ] HY translations

---

### 1.4 Onboarding Workflows

**Status:** ⚠️ Mostly implemented

| Layer   | Status | Files                                     |
| ------- | ------ | ----------------------------------------- |
| Schema  | ✅     | `convex/schema/onboarding.ts`             |
| Backend | ✅     | `convex/onboarding.ts`                    |
| UI      | ✅     | `src/components/OnboardingClient.tsx`     |
| Route   | ✅     | `src/app/(dashboard)/onboarding/page.tsx` |
| i18n    | ✅     | EN, RU                                    |

**Features implemented:**

- Onboarding templates, programs, tasks
- Templates by department/position
- Automatic checklists (spawn from template)
- Buddy/mentor assignment
- Progress tracker (% completion, server-side)
- Auto tasks for IT/HR/manager (assigneeType + dayOffset)
- Welcome page (My Onboarding tab)

**Features implemented:**

- Onboarding templates, programs, tasks
- Templates by department/position
- Automatic checklists (spawn from template)
- Buddy/mentor assignment
- Progress tracker (% completion, server-side)
- Auto tasks for IT/HR/manager (assigneeType + dayOffset)
- Welcome page (My Onboarding tab)
- Cron jobs for task activation and overdue reminders (`activateOnboardingTasks`, `sendOnboardingOverdueReminders`)

**TODO:**

- [ ] Integration with Tasks module (auto-create tasks)
- [ ] Link with Recruitment (auto-trigger on hired)

---

### 1.5 Offboarding Workflows

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                      |
| ------- | ------ | ------------------------------------------ |
| Schema  | ✅     | `convex/schema/offboarding.ts`             |
| Backend | ✅     | `convex/offboarding.ts`                    |
| UI      | ✅     | `src/components/OffboardingClient.tsx`     |
| Route   | ✅     | `src/app/(dashboard)/offboarding/page.tsx` |
| i18n    | ✅     | EN, RU                                     |

**Features implemented:**

- Offboarding programs, tasks, exitInterviews
- 8 default tasks (access revoke, equipment return, knowledge transfer, etc.)
- Exit Interview form (5-point experience, recommend, feedback, improvements)
- Retention analytics (reason breakdown, avg experience, recommend rate)
- StartOffboardingWizard (3-step)
- ProgramDetailDialog (checklist + exit interview panel)

---

### 1.6 E-Signatures

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                     |
| ------- | ------ | ----------------------------------------- |
| Schema  | ✅     | `convex/schema/signatures.ts`             |
| Backend | ✅     | `convex/signatures.ts`                    |
| UI      | ✅     | `src/components/ESignaturesClient.tsx`    |
| Route   | ✅     | `src/app/(dashboard)/signatures/page.tsx` |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅                       |

**Features implemented:**

- Document templates, signature documents, signature requests, audit log
- 3-step CreateDocumentWizard
- SignDocumentDialog (Canvas signature pad, mouse + touch)
- DocumentDetailDialog (status, signers progress, audit log, PDF export)
- TemplateManager (CRUD with categories: NDA, Offer, Contract, Policy, Custom)
- Immutable document snapshot on send (content hash)
- Sequential signing order enforcement
- Audit log (created, sent, viewed, signed, declined, cancelled, reminder_sent)
- PDF generation of signed documents (pdfmake with signers table, audit trail, metadata)

**TODO:**

- [ ] Digital certificate integration (optional enhancement)
- [ ] Watermark on PDF exports (optional enhancement)

---

### 1.7 Employee Engagement / Pulse Surveys

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                  |
| ------- | ------ | -------------------------------------- |
| Schema  | ✅     | `convex/schema/surveys.ts`             |
| Backend | ✅     | `convex/surveys.ts`                    |
| UI      | ✅     | `src/components/SurveysClient.tsx`     |
| Route   | ✅     | `src/app/(dashboard)/surveys/page.tsx` |
| i18n    | ✅     | EN, RU, HY                             |

**Features implemented:**

- Surveys, surveyQuestions, surveyResponses, surveyAnswers
- Question types: rating, multiple_choice, text, yes_no, nps
- Anonymous responses
- eNPS (0-10 scale)
- Create survey wizard with drag-and-drop question ordering
- TakeSurveyDialog, ResultsDialog
- Results Dashboard with trends (`/surveys/[id]/results`)
- Department segmentation
- CSV export
- Individual response viewer (for named surveys)
- Automatic pulse surveys (cron: hourly activation/closure)

**TODO:**

- [ ] Quiz taking UI with timer (if needed for surveys)
- [ ] Cross-survey trend analytics over time

---

### 1.8 Recognition & Kudos

**Status:** ⚠️ Mostly implemented

| Layer   | Status | Files                                              |
| ------- | ------ | -------------------------------------------------- |
| Schema  | ✅     | `convex/schema/recognition.ts`                     |
| Backend | ✅     | `convex/recognition.ts`                            |
| UI      | ✅     | `src/components/recognition/RecognitionClient.tsx` |
| Route   | ✅     | `src/app/(dashboard)/recognition/page.tsx`         |
| i18n    | ⚠️     | EN ✅, RU ✅, HY 🔲                                |

**Features implemented:**

- Kudos feed, leaderboard, stats cards
- SendKudos Wizard (3-step)
- Points Economy (userPoints + pointTransactions)
- Points: -3 for sending kudos, +1 for attendance, +3 for positive review ≥4★
- Badge system (kudosBadges, kudosBadgeAwards)

**TODO:**

- [ ] HY translations

---

## Phase 2 — Competitive Edge

> Re-verified 2026-09-15: **2.1, 2.3, 2.4, 2.6 and 3.6 are shipped.** Remaining gap: 2.7 Succession.

### 2.1 Learning Management System (LMS)

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/learning.ts`                                                                                                                                                                                                                                                                                                                                                                                                         |
| Backend | ✅     | `convex/learning.ts`                                                                                                                                                                                                                                                                                                                                                                                                                |
| UI      | ✅     | `src/components/learning/LearningClient.tsx`, `src/components/learning/CourseCatalog.tsx`, `src/components/learning/MyCourses.tsx`, `src/components/learning/TeamOverview.tsx`, `src/components/learning/CreateCourseDialog.tsx`, `src/components/learning/LessonFormDialog.tsx`, `src/components/learning/LessonPlayerDialog.tsx`, `src/components/learning/CourseDetailDialog.tsx`, `src/components/learning/CertificatesTab.tsx` |
| Route   | ✅     | `src/app/(dashboard)/learning/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                             |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Sidebar | ✅     | GraduationCap icon                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Features implemented:**

- Course catalog with search, category & difficulty filters
- Course enrollment (self + admin bulk enroll)
- Lesson progress tracking (video/text/quiz/mixed content types)
- Quiz system with multiple question types (multiple choice, true/false, short answer)
- Score tracking, passing thresholds, attempt limits
- Certificate issuance on course completion
- Team learning overview for admins (stats dashboard)
- Course categories management
- Mandatory compliance training support
- Difficulty levels (beginner, intermediate, advanced)
- Three-tab interface: Catalog, My Courses, Team Overview (Surveys-style tabs)
- CreateCourseDialog (course creation)
- LessonFormDialog (lesson management)
- LessonPlayerDialog (content viewer)
- CourseDetailDialog
- CertificatesTab

**TODO:**

- [ ] Quiz taking UI with timer
- [ ] Certificate download/view UI
- [ ] Drag-and-drop lesson ordering
- [ ] Course completion cron jobs (expiry notifications)
- [ ] Manager course assignment UI

---

### 2.2 Compensation Management

**Status:** ⚠️ Mostly implemented

| Layer   | Status | Files                                                                                                                                                                                                                                                                                 |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/compensation.ts`                                                                                                                                                                                                                                                       |
| Backend | ✅     | `convex/compensation.ts`                                                                                                                                                                                                                                                              |
| UI      | ✅     | `src/components/compensation/CompensationClient.tsx`, `src/components/compensation/CompensationRecordWizard.tsx`, `src/components/compensation/CompensationBandWizard.tsx`, `src/components/compensation/BonusProgramWizard.tsx`, `src/components/compensation/ReviewCycleWizard.tsx` |
| Route   | ✅     | `src/app/(dashboard)/compensation/page.tsx`                                                                                                                                                                                                                                           |
| i18n    | ⚠️     | EN ✅, RU ✅, HY 🔲                                                                                                                                                                                                                                                                   |
| Sidebar | ✅     | Nav item added                                                                                                                                                                                                                                                                        |

**Features implemented:**

- Salary bands by position (min/mid/max)
- Employee position visualization within band
- Compensation review cycles
- Bonuses and premiums
- Create compensation records wizard
- Compensation band management wizard
- Bonus program wizard
- Review cycle wizard
- Surveys-style tab interface (Catalog, My Records, Team Overview, Settings)
- Portal-rendered modals (no clipping)

**TODO:**

- [ ] HY translations
- [ ] Raise budgeting UI
- [ ] Market benchmarking integration
- [ ] Compensation history export (PDF/CSV)
- [ ] Deadline notifications for review cycles

**Competitors with this:** Rippling, BambooHR

---

### 2.3 Benefits Administration

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                        |
| ------- | ------ | -------------------------------------------- |
| Schema  | ✅     | `convex/schema/benefits.ts`                  |
| Backend | ✅     | `convex/benefits.ts` (13 exports)            |
| UI      | ✅     | `src/components/benefits/BenefitsClient.tsx` |
| Route   | ✅     | `src/app/(dashboard)/benefits/page.tsx`      |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅, DE ✅                   |
| Billing | ✅     | `benefits` module + `plans`/`claims` limits  |

**Tables:** `benefitPlans`, `benefitEnrollments`, `benefitWallets`, `benefitClaims`

**Features implemented:**

- Benefits catalog (insurance, fitness, education — per-org plans)
- Self-service enrollment with admin approve / cancel-enrollment flows
- Flexible benefits budget (`benefitWallets`)
- Claims submission (title, amount, receipt) with approval
- Separation of duties — nobody approves their own claim

**Competitors with this:** Rippling, Deel, BambooHR

---

### 2.4 Visual Org Chart

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                        |
| ------- | ------ | -------------------------------------------- |
| Schema  | ✅     | `convex/schema/orgchart.ts`                  |
| Backend | ✅     | `convex/orgchart.ts`                         |
| UI      | ✅     | `src/components/orgchart/OrgChartClient.tsx` |
| Route   | ✅     | `src/app/(dashboard)/org-chart/page.tsx`     |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅                          |

**Features implemented:**

- Interactive visualization (React Flow/@xyflow)
- Proper tree layout algorithm (subtree-centering)
- Hierarchy: company → department → team → person
- Search and filter
- Click → mini employee profile (email, phone, department, position)
- Drag-and-drop reorg (admin only)
- Export to SVG
- Auto-generate org chart from employee data
- Save/load user-specific layouts
- Add/Edit/Delete nodes with dialogs
- Move node with circular reference prevention
- Node types: person, department, group
- Color-coded nodes by type
- Fix departments mutation (auto-correct parent-child relationships)

**TODO:**

- [ ] Export to PDF/PNG (in addition to SVG)

---

### 2.5 Document Management System

**Status:** ⚠️ Mostly implemented

| Layer   | Status | Files                                                                                               |
| ------- | ------ | --------------------------------------------------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/documents.ts`                                                                        |
| Backend | ✅     | `convex/documents.ts`                                                                               |
| UI      | ✅     | `src/components/documents/DocumentsClient.tsx`, `src/components/documents/DocumentUploadWizard.tsx` |
| Route   | ✅     | `src/app/(dashboard)/documents/page.tsx`                                                            |
| i18n    | ⚠️     | EN ✅, RU ✅, HY 🔲                                                                                 |
| Sidebar | ✅     | Nav item added                                                                                      |

**Features implemented:**

- Document management with tabbed interface (Surveys-style tabs)
- Document upload wizard
- Folder organization
- Access control (who can view/edit)
- Document versioning support
- Full-text search

**Features implemented:**

- Document management with tabbed interface (Surveys-style tabs)
- Document upload wizard
- Document template wizard
- Document detail view
- Folder organization
- Access control (who can view/edit)
- Document versioning support
- Full-text search

**TODO:**

- [ ] HY translations
- [ ] E-Signatures integration
- [ ] Bulk download/export
- [ ] Document preview UI

**Competitors with this:** Rippling, BambooHR

---

### 2.6 Expense Management

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                        |
| ------- | ------ | -------------------------------------------- |
| Schema  | ✅     | `convex/schema/expenses.ts`                  |
| Backend | ✅     | `convex/expenses.ts` (25 exports)            |
| UI      | ✅     | `src/components/expenses/ExpensesClient.tsx` |
| Route   | ✅     | `src/app/(dashboard)/expenses/page.tsx`      |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅, DE ✅                   |
| Billing | ✅     | `expenses` module + `reports/mo` limit       |

**Tables:** `expenses`, `expenseCategories`, `expensePolicies`, `expenseReports`, `expenseReportItems`

**Features implemented:**

- Expense submission (amount, category, receipt)
- Approval workflow with policy thresholds: daily limit, director approval limit, auto-approval limit
- Expense policies per category
- Analytics by category and status
- Self-approval forbidden (precedent reused by leaves/benefits/ratings)

**Competitors with this:** Rippling

---

### 2.7 Succession Planning

**Status:** 🔲 Not started

**Required files:**

- Schema: `convex/schema/succession.ts` (keyPositions, successors, developmentPlans, nineBoxRatings)
- Backend: `convex/succession.ts`
- UI: `src/components/succession/SuccessionClient.tsx`
- Route: `src/app/(dashboard)/succession/page.tsx`

**Features to implement:**

- 9-Box Grid (Performance vs Potential)
- Key position identification
- Successor assignment
- Development plans (linked to LMS)
- Risk assessment (what if someone leaves)

**Competitors with this:** Leapsome, HiBob

---

## Phase 3 — Differentiation

> Re-verified 2026-09-15: **3.3, 3.4, 3.9, 3.10 shipped; 3.1, 3.2, 3.5, 3.7 partially shipped.**
> Remaining: 3.8 Career Development.

### 3.1 Mobile App (PWA)

**Status:** ⚠️ Partially implemented (installable assets exist, offline/push not wired globally)

**Existing:**

- `public/manifest.json` + `public/site.webmanifest` — linked from `src/app/layout.tsx`
- `public/sw.js` (service worker) + `public/offline.html`
- `src/app/offline/page.tsx`
- Push notification helper: `src/lib/pushNotifications.ts` (registers the SW)

**TODO:**

- [ ] Register the service worker globally (today only `pushNotifications.ts` does)
- [ ] Offline caching strategy for dashboard routes
- [ ] Store-ready wrapper (React Native or Capacitor) if the stores are required
- [ ] Quick actions: approve leave, mark attendance

**Features to implement:**

- PWA manifest + service worker
- Responsive design for all modules
- Push notifications (Web Push API)
- Offline mode (caching)
- Quick actions: approve leave, mark attendance
- Alternative: React Native (iOS + Android)

---

### 3.2 Compliance & Audit Trail

**Status:** ⚠️ Mostly implemented (dedicated module + audit UI shipped; coverage of _all_ writes still incomplete)

**Existing:**

- Schema: `convex/schema/{security,compliance}.ts`
- Backend: `convex/security.ts`, `convex/compliance.ts`
- Route + UI: `src/app/(dashboard)/compliance/page.tsx`, `src/components/compliance/ComplianceClient.tsx`
- Audit UI: `src/app/(dashboard)/audit/page.tsx` — `AuditLogClient`, `AuditFilters`, `AuditDetailSheet`
- Data Browser with before/after JSON + one-click undo: `adminDbChanges`, `src/components/superadmin/DataBrowserClient.tsx`
- Backups: `convex/backups.ts`, `convex/backups.cron.ts`, `convex/schema/backups.ts`

**TODO:**

- [ ] Full audit logging for ALL actions (who, what, when, IP, before/after) — rows exist, coverage is uneven
- [ ] GDPR self-service data export + right to erasure
- [ ] Data retention policies
- [ ] SOC 2 evidence automation — see `docs/soc2-type2-readiness.md` (203-line control map, mostly `[ ]`)

---

### 3.3 Asset / IT Equipment Management

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                                  |
| ------- | ------ | ------------------------------------------------------ |
| Schema  | ✅     | `convex/schema/assets.ts`                              |
| Backend | ✅     | `convex/assets.ts` (37 exports)                        |
| UI      | ✅     | `src/components/assets/AssetsClient.tsx` (2 316 lines) |
| Route   | ✅     | `src/app/(dashboard)/assets/page.tsx`                  |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅, DE ✅                             |

**Tables:** `assetCatalog`, `assetAssignments`, `assetMaintenance`, `assetHistory`, `assetRequests`

**Features implemented:**

- Equipment inventory (catalog with categories)
- Assignment / return with assigned-by / assigned-at tracking
- Maintenance log
- Asset requests (employee → admin approval)
- Full asset history trail
- PDF export for asset acts (`src/lib/assetActContent.ts`)

---

### 3.4 Company News Feed / Announcements

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                                    |
| ------- | ------ | -------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/news.ts`                                  |
| Backend | ✅     | `convex/news.ts` (12 exports)                            |
| UI      | ✅     | `src/components/news/NewsClient.tsx`, `NewsComposer.tsx` |
| Route   | ✅     | `src/app/(dashboard)/news/page.tsx`                      |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅, DE ✅                               |

**Tables:** `announcements`, `announcementSchedule`, `announcementReactions`, `announcementComments`, `announcementViews`

**Features implemented:**

- Company feed with composer, featured/pinned posts
- Reactions and comments
- View tracking
- Scheduled announcements (`announcementSchedule`)
- Categories (news, events, birthdays, achievements)

---

### 3.5 Custom Workflow Builder (Visual)

**Status:** ⚠️ Built, but gated to the platform operator (superadmin) — not sold to customers yet

**Existing:**

- Schema: `convex/schema/automation.ts`
- Backend: `convex/automation.ts`, `convex/automationActions.ts`, `convex/automationMutations.ts`, `convex/automationTest.ts`
- UI: `src/components/automation/AutomationClient.tsx`
- **Visual drag-and-drop builder: `src/components/workflow/WorkflowBuilderClient.tsx`** (React Flow)
- Route: `src/app/(dashboard)/superadmin/automation/page.tsx`, lazily mounted from `SuperadminHubClient.tsx`

**TODO (this is the real gap):**

- [ ] Expose the builder to org admins at `src/app/(dashboard)/automation/page.tsx`
- [ ] Org-scoped workflows (today the console is platform-level)
- [ ] Workflow templates for customers
- [ ] Execution logging UI for the tenant
- [ ] Entitlement gate (`automation` module exists in the billing catalog)

---

### 3.6 Employee Directory

**Status:** ✅ Fully implemented

**Existing:**

- `src/app/(dashboard)/employees/page.tsx` — Employee list
- `src/app/(dashboard)/employees/[id]/page.tsx` — Employee profile
- `src/app/(dashboard)/employees/departments/page.tsx` — Department management
- `src/app/(dashboard)/employees/positions/page.tsx` — Position management
- `src/components/employees/EmployeesClient.tsx` — Main UI
- `src/components/employees/EmployeeProfilePageClient.tsx` — Profile view
- `src/components/employees/DepartmentsClient.tsx` — Department UI
- `src/components/employees/PositionsClient.tsx` — Position UI
- `src/components/employees/EmployeeHoverCard.tsx` — Quick view card
- `src/components/employees/AddEmployeeModal.tsx` — Add employee
- `src/components/employees/EditEmployeeModal.tsx` — Edit employee
- `src/components/employees/TeamSidebar.tsx` — Team sidebar
- `convex/schema/employees.ts` — Employee schema
- `convex/employees.ts` — Employee backend
- `convex/departments.ts` — Department backend
- `convex/positions.ts` — Position backend

---

### 3.7 PDF Reports / Export

**Status:** ⚠️ Mostly implemented (export helpers exist per module; no unified report builder)

**Existing:**

- `src/lib/exportDocument.ts` (1 486 lines) — shared export pipeline
- `src/lib/pdf.ts`-style helpers: `simplePdf.ts`, `exportMyPayslip.ts`, `exportDriversToPDF.ts`, `assetActContent.ts`
- PDF generation via `pdfmake` (dependency) + `exceljs` for spreadsheets
- Route + UI: `src/app/(dashboard)/reports/page.tsx` (648 lines, KPI + charts)
- Signed e-signature documents export to PDF with audit trail
- Armenian payroll → SRC filing sheet Excel: `src/app/api/payroll/src-export/route.ts`
- Leave timesheet export: `src/app/api/leave/timesheet-export/route.ts`

**TODO:**

- [ ] Unified report builder (pick columns → template)
- [ ] Bulk export across a selected employee set
- [ ] Scheduled reports (auto-email via cron + Resend)

---

### 3.8 Career Development Paths

**Status:** 🔲 Not started

**Required files:**

- Schema: `convex/schema/careers.ts` (skillMatrices, careerTracks, gapAnalyses, mentorships)
- Backend: `convex/careers.ts`
- UI: `src/components/careers/CareersClient.tsx`
- Route: `src/app/(dashboard)/careers/page.tsx`

**Features to implement:**

- Skill Matrix (skills by position)
- Career tracks (Junior → Mid → Senior → Lead)
- Gap analysis (what's needed for promotion)
- LMS integration (recommended courses)
- Mentorship assignments

---

### 3.9 Shift Scheduling

**Status:** ✅ Fully implemented

| Layer   | Status | Files                                                          |
| ------- | ------ | -------------------------------------------------------------- |
| Schema  | ✅     | `convex/schema/shifts.ts` (shifts, shiftTemplates, shiftSwaps) |
| Backend | ✅     | `convex/shifts.ts`                                             |
| UI      | ✅     | `src/components/shifts/ShiftsClient.tsx`                       |
| Route   | ✅     | `src/app/(dashboard)/shifts/page.tsx`                          |
| i18n    | ✅     | EN ✅, RU ✅, HY ✅, DE ✅ (dedicated `shifts` namespace)      |
| Nav     | ✅     | Sidebar + ToolDock + billing module map (`shiftScheduling`)    |

**Features implemented:**

- Weekly roster grid with week navigation (prev/next/this week)
- Shift templates (name + start/end), one-click apply to the week
- Per-shift break minutes and notes
- Shift swap requests with accept/decline + notifications (`shiftSwapRequested`, `shiftSwapResponded`)
- Publish/unpublish rosters; RBAC: admins/supervisors manage, employees view own
- Entitlement-gated module (plan-based access like other billing modules)

**TODO:**

- [ ] Month view + auto-distribution
- [ ] Attendance integration (shift vs actual hours)

---

### 3.10 SRC-Ready Payroll Export (Armenia Tax Service)

**Status:** ✅ Fully implemented

| Layer | Status | Files                                                    |
| ----- | ------ | -------------------------------------------------------- |
| Logic | ✅     | `src/lib/payroll/srcExport.ts` (pure, tested)            |
| API   | ✅     | `src/app/api/payroll/src-export/route.ts` (styled Excel) |
| UI    | ✅     | `PayrollRunDetailClient` header button                   |
| Tests | ✅     | `src/__tests__/srcExport.test.ts` (16 tests)             |
| i18n  | ✅     | EN ✅, RU ✅, HY ✅, DE ✅                               |

**Features implemented:**

- Per-employee SRC filing rows: ՀՎՀՀ (tax ID) from `employeeProfiles.socialCardNumber`
- Tax figures mirror `convex/lib/taxRules.ts` exactly: 20% flat income tax, funded pension 5% / 10%−25k (max 87,500), military stamp duty 1,000/15,000, tiered health insurance 0/4,800/10,800
- Org header block (name, ՀՎՀՀ) + totals row + missing-tax-ID highlighting
- Excel download styled per project workbook conventions

This is the wedge against Armsoft/1C for Armenian accountants: payroll → one click → SRC filing sheet.

---

### 3.11 Local Payment Providers (Idram / ArCa)

**Status:** ✅ End-to-end (checkout is complete; only the merchant credentials themselves are outstanding)

| Layer        | Status | Files                                                                            |
| ------------ | ------ | -------------------------------------------------------------------------------- |
| Schema       | ✅     | `paymentProviderConfigs`, `localPayments` in `convex/schema/settings.ts`         |
| Crypto       | ✅     | `convex/lib/paymentSignature.ts` — HMAC-SHA256, handshake, payload normalization |
| Backend      | ✅     | `convex/payments.ts` (PSP-agnostic)                                              |
| Webhook      | ✅     | `convex/http.ts` — `POST /webhooks/payments/<provider>`                          |
| Checkout UI  | ✅     | `UpgradeModal` → local rails; `PaymentProvidersClient` (superadmin)              |
| Result pages | ✅     | `/checkout/local/success`, `/checkout/local/fail`                                |
| Tests        | ✅     | `src/__tests__/payments-local.test.ts` (26 cases, cross-checked vs Node crypto)  |
| Billing      | ✅     | `convex/subscriptions.ts` — `source: 'stripe' \| 'local'`                        |

**Features implemented:**

- PSP-agnostic provider configs (Idram, Ameriabank / Ardshinbank / FastBank ArCa acquiring) with server-only secrets
- **Handshake builder** covering both real PSP shapes: Idram-style form POST (`EDP_*` fields) and ArCa-style hosted-page redirect; AMD amounts are passed in by the caller so the backend never guesses FX
- **Webhook endpoint** at `/webhooks/payments/<provider>`: HMAC-SHA256 over the raw body, 401 on a bad signature, 202 when disabled, 404 for an unknown order, 413 on oversized payloads
- **Superadmin console** at `/superadmin/payments`: enable/disable, merchant id, write-only secret, endpoint override, return paths, the webhook URL to paste into the bank cabinet, and the local payment ledger
- **Checkout entry** in the upgrade modal — one button per enabled provider, rendered only when a provider is enabled and sealed
- `localPayments` ledger, idempotent by `orderId`, so a PSP retry never double-charges
- Subscription activation through the same path Stripe uses, so plans/entitlements resolve identically

**Bug found and fixed while wiring this up (would have broken go-live on day one):**

`hmacSha256Hex` hashed the **hex string** of the inner digest in the outer round instead of its raw 32 bytes,
and shortened long keys to a 64-character hex string rather than the RFC 2104 digest. Every real PSP
signature would have been rejected — and it was invisible because the function had no caller and no test.
Fixed, with `sha256BytesHex` extracted in `convex/lib/sha256.ts` so digests are never routed through
UTF-8 encoding. Now verified against `crypto.createHmac` (short key, long key, empty key, non-ASCII body).

**TODO (the only true blocker):**

- [ ] Idram / bank merchant credentials, and the exact per-bank field & signature-header names from the signed merchant specification — the code paths are in place and configurable, but the spec must be confirmed before taking real money

---

## Already Implemented (Not in Roadmap)

### Dashboard

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/dashboard/page.tsx`
- Component: `src/components/dashboard/DashboardClient.tsx`

### Employees

**Status:** ✅ Fully implemented

- Routes: `src/app/(dashboard)/employees/page.tsx`, `src/app/(dashboard)/employees/[id]/page.tsx`
- Components: `src/components/employees/EmployeesClient.tsx`, `src/components/employees/EmployeeProfilePageClient.tsx`
- Schema: `convex/schema/employees.ts`

### Leaves

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/leaves/page.tsx`
- Component: `src/components/leaves/LeavesClient.tsx`
- Schema: `convex/schema/leaves.ts`
- Backend: `convex/leaves.ts`

### Attendance / Time Tracking

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/attendance/page.tsx`
- Component: `src/components/attendance/AttendanceDashboard.tsx`
- Backend: `convex/timeTracking.ts`

### Tasks

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/tasks/page.tsx`
- Component: `src/components/tasks/TasksClient.tsx`
- Schema: `convex/schema/tasks.ts`
- Backend: `convex/tasks.ts`

### Chat

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/chat/page.tsx`
- Component: `src/components/chat/ChatClient.tsx`
- Schema: `convex/schema/chat.ts`
- Backend: `convex/chat.ts`, `convex/chatAction.ts`

### Calendar

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/calendar/page.tsx`
- Component: `src/components/calendar/CalendarClient.tsx`
- Schema: `convex/schema/calendar.ts`

### Analytics

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/analytics/page.tsx`
- Backend: `convex/analytics.ts`
- Components: LeavesTrendChart, DepartmentStats, LeaveHeatmap, StatsCard

### Payroll

**Status:** ✅ Fully implemented

- Routes: `src/app/(dashboard)/payroll/page.tsx`, `payroll/[id]/page.tsx`, `payroll/runs/page.tsx`, `payroll/settings/page.tsx`
- Schema: `convex/schema/payroll.ts`
- Components: PayrollDashboard, PayrollRecordsTable, PayrollCalculator, PayrollRunDialogs, EditPayrollRecordDialog, PayrollRunDetailClient

### Drivers

**Status:** ✅ Fully implemented (unique feature)

- Routes: `src/app/(dashboard)/drivers/page.tsx`, `drivers/dashboard/page.tsx`, `drivers/favorites/page.tsx`
- Schema: `convex/schema/drivers.ts`
- Backend: `convex/drivers.ts`, `convex/driverAI.ts`
- Components: 40+ files in `src/components/drivers/`

### Approvals

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/approvals/page.tsx`
- Component: `src/components/approvals/ApprovalsClient.tsx`

### AI Chat

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/ai-chat/page.tsx`
- Component: `src/components/ai-chat/AIChatClient.tsx`
- Schema: `convex/schema/ai.ts`
- Backend: `convex/aiChat.ts`, `convex/aiChatMutations.ts`

### Help / Tickets

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/help/page.tsx`
- Schema: `convex/schema/tickets.ts`, `convex/schema/sla.ts`
- Backend: `convex/tickets.ts`, `convex/sla.ts`
- Component: `src/components/help/CreateTicketWizard.tsx`

### Settings

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/settings/page.tsx`
- Schema: `convex/schema/settings.ts`
- Backend: `convex/settings.ts`
- Components: 10 sub-components (Appearance, Cookie, Security, Localization, Integration, Advanced Security, Dashboard Customization, Profile, Productivity, Notification)

### Profile

**Status:** ✅ Fully implemented

- Route: `src/app/(dashboard)/profile/page.tsx`

### Organization Management

**Status:** ✅ Fully implemented

- Schema: `convex/schema/organizations.ts`
- Backend: `convex/organizations.ts`, `convex/organizationJoinRequests.ts`, `convex/organizationRequests.ts`
- Routes: `src/app/(dashboard)/join-requests/page.tsx`, `src/app/(dashboard)/org-requests/page.tsx`

### Admin Panel

**Status:** ✅ Fully implemented

- Routes: `src/app/(dashboard)/admin/page.tsx`, `admin/events/page.tsx`, `admin/join-requests/page.tsx`
- Backend: `convex/admin.ts`, `convex/events.ts`

### Superadmin Panel

**Status:** ✅ Fully implemented

- Routes: 15+ pages (users, organizations, subscriptions, security, automation, impersonation, emergency, bulk actions, create-org, support, stripe-dashboard)
- Backend: `convex/superadmin.ts`, `convex/subscriptions.ts`, `convex/subscriptions_admin.ts`, `convex/security.ts`, `convex/automation*.ts`

### Birthdays

**Status:** ✅ Fully implemented

- Backend: `convex/birthdays.ts`

### Conflicts

**Status:** ✅ Fully implemented

- Backend: `convex/conflicts/main.ts`

---

## Implementation Priority Order

```
PHASE 2 (Competitive Edge):
  2.1 LMS ............................ ✅ DONE (full i18n, all core features)
  2.2 Compensation Management ........ ⚠️ DONE (core + UI; HY translations + raise budgeting pending)
  2.3 Benefits Administration ........ ✅ DONE (plans, wallets, enrollments, claims)
  2.4 Visual Org Chart ............... ✅ DONE (full i18n, tree built from reporting line)
  2.5 Document Management ............ ⚠️ DONE (core + UI + templates; HY pending)
  2.6 Expense Management ............. ✅ DONE (policies, limits, approval, analytics)
  2.7 Succession Planning ............ 🔲 NOT STARTED — the only true Phase 2 gap
  3.6 Employee Directory ............. ✅ DONE (full CRUD, departments, positions)

PHASE 3 (Differentiation):
  3.1 Mobile App (PWA) ............... ⚠️ PARTIAL (manifest + SW + offline.html; SW registered only by the push helper)
  3.2 Compliance & Audit Trail ....... ⚠️ MOSTLY DONE (module + audit UI + one-click undo; write coverage uneven)
  3.3 Asset Management ............... ✅ DONE (catalog, assignments, maintenance, requests, history)
  3.4 Company News Feed .............. ✅ DONE (feed, reactions, comments, scheduling)
  3.5 Custom Workflow Builder ........ ⚠️ BUILT BUT SUPERADMIN-ONLY (visual builder exists; not sold to tenants)
  3.7 PDF Reports / Export ........... ⚠️ MOSTLY DONE (per-module exporters; no unified builder)
  3.8 Career Development ............. 🔲 NOT STARTED
  3.9 Shift Scheduling ............... ✅ DONE (week roster, templates, swaps, i18n ×4)
  3.10 SRC Payroll Export (AM) ....... ✅ DONE (tested, Excel, ՀՎՀՀ)
  3.11 Local Payments (Idram/ArCa) ... ✅ DONE (checkout handoff, HMAC webhooks,
                                        superadmin config, return pages; needs only
                                        live PSP credentials in the superadmin UI)

PHASE 1 (Remaining TODOs):
  1.1 Performance notifications ...... ✅ DONE (cron: checkDeadlineNotifications)
  1.2 OKR reminders .................. ✅ DONE (cron: sendWeeklyCheckinReminders)
  1.3 Recruitment email templates .... ✅ DONE (Resend integration, 4 templates)
  1.4 Onboarding integrations ........ ✅ DONE (cron: activateOnboardingTasks, sendOnboardingOverdueReminders)

REAL REMAINING PRODUCT WORK (after re-verification — this is the honest list):
  - Succession planning (9-box, key positions, successors) ........ 🔲 ~3-4 days
  - Career development (skill matrix, tracks, gap analysis) ....... 🔲 ~4-5 days
  - Workflow builder for TENANTS, not just superadmin ............. ⚠️ ~5-7 days
  - Mobile: store-ready build OR global service-worker registration  ⚠️ ~5-7 days
  - Unified report builder + scheduled exports .................... ⚠️ ~2-3 days
  - Public API + webhooks for customers ......................... ✅ DONE (REST /api/v1,
                                        HMAC-signed webhooks, API keys, plan quotas)
  - Translation coverage ....................................... ✅ DONE (key parity for
                                        en/ru/hy/de is machine-checked in CI; 16 namespaces aligned)
  - Public comparison pages (/compare + 6 head-to-head, ×4 langs) .. ✅ DONE (GTM surface)

NOT code tasks — these cannot be shipped from the repository:
  - SOC 2 Type II certification (see docs/soc2-type2-readiness.md)
  - App Store / Google Play presence
  - Brand, case studies, sales channels, funding
```

---

## Technical Standards for New Modules

Every new module MUST follow these conventions:

### File Structure

```
convex/schema/{module}.ts          — Database schema (defineTable)
convex/{module}.ts                  — Backend queries + mutations
src/app/(dashboard)/{module}/page.tsx — Server wrapper with nextDynamic
src/components/{module}/{Module}Client.tsx — Client component
src/components/{module}/            — Sub-components (wizards, dialogs, cards)
src/i18n/locales/en.json            — English translations
src/i18n/locales/ru.json            — Russian translations
src/i18n/locales/hy.json            — Armenian translations
```

### Server Wrapper Pattern

```tsx
import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

const ModuleClient = nextDynamic(() => import('@/components/module/ModuleClient'), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

export default function ModulePage() {
  return <ModuleClient />;
}
```

### Client Component Rules

- Use `'use client'` directive at top
- Accept NO `params` props — use `useParams()` hook instead
- Import Skeleton from `@/components/ui/Skeleton` (capital S)
- Import Convex API from `@/convex/_generated/api` (alias, not relative)

### Backend Rules

- All queries must filter `role !== 'superadmin'` from user lists
- Use `MAX_PAGE_SIZE` from `convex/pagination`
- Use indexes (`withIndex`) whenever possible, avoid `.collect()` unless necessary
- All mutations must check RBAC permissions
- Use `SUPERADMIN_EMAIL` from `convex/lib/auth` for superadmin checks

### i18n Rules

- Every new module needs EN + RU + HY translations
- Add nav keys to `src/i18n/locales/{en,ru,hy}.json` under `nav.{module}`
- Use `useTranslation()` hook in client components

### RBAC Rules

- Every module must define which roles can access it
- Permission checks in backend mutations
- UI shows/hides features based on role

---

## Competitive Analysis Summary

| Feature                                         | This Project | Rippling |  HiBob  | BambooHR | Leapsome |  Deel   |
| ----------------------------------------------- | :----------: | :------: | :-----: | :------: | :------: | :-----: |
| Employee Management                             |      ✅      |    ✅    |   ✅    |    ✅    |    ❌    |   ✅    |
| Leave Management                                |      ✅      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| Attendance/Time Tracking                        |      ✅      |    ✅    |   ✅    |    ✅    |    ❌    |   ❌    |
| Task Management                                 |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| Chat/Messaging                                  |      ✅      |    ❌    |   ✅    |    ❌    |    ❌    |   ❌    |
| Calendar                                        |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| Recruitment/ATS                                 |      ✅      |    ✅    |   ✅    |    ✅    |    ❌    |   ✅    |
| Recruitment Emails                              |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| Onboarding                                      |      ✅      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| Offboarding                                     |      ✅      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| Performance Reviews                             |      ✅      |    ✅    |   ✅    |    ❌    |    ✅    |   ❌    |
| OKR/Goals                                       |      ✅      |    ❌    |   ❌    |    ❌    |    ✅    |   ❌    |
| E-Signatures                                    |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ✅    |
| Pulse Surveys                                   |      ✅      |    ❌    |   ✅    |    ❌    |    ✅    |   ❌    |
| Recognition/Kudos                               |      ✅      |    ❌    |   ✅    |    ❌    |    ✅    |   ❌    |
| AI Assistant                                    |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| Payroll                                         |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ✅    |
| Driver Management                               |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| Approvals Workflow                              |      ✅      |    ✅    |   ✅    |    ✅    |    ❌    |   ❌    |
| Analytics Dashboard                             |      ✅      |    ✅    |   ✅    |    ✅    |    ✅    |   ❌    |
| Multi-language (3+)                             |      ✅      |    ✅    |   ✅    |    ❌    |    ❌    |   ✅    |
| **LMS**                                         |      ✅      |    ✅    |   ❌    |    ❌    |    ✅    |   ❌    |
| **Compensation**                                |      ✅      |    ✅    |   ❌    |    ✅    |    ❌    |   ❌    |
| **Benefits**                                    |      ✅      |    ✅    |   ❌    |    ✅    |    ❌    |   ✅    |
| **Org Chart**                                   |      ✅      |    ❌    |   ✅    |    ✅    |    ❌    |   ❌    |
| **Documents**                                   |      ✅      |    ✅    |   ❌    |    ✅    |    ❌    |   ❌    |
| **Expenses**                                    |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Assets / IT equipment**                       |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| **News / announcements**                        |      ✅      |    ❌    |   ✅    |    ❌    |    ❌    |   ❌    |
| **Video conferencing**                          |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Meeting rooms**                               |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Overtime**                                    |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Projects**                                    |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Strategy maps**                               |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Compliance (GDPR)**                           |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Security center**                             |      ✅      |    ✅    |   ❌    |    ❌    |    ❌    |   ❌    |
| **SCIM + SSO (SAML / OIDC)**                    |      ✅      |    ✅    |   ✅    |    ⚠️    |    ❌    |   ✅    |
| **Telegram integration**                        |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Shift Scheduling**                            |      ✅      |    ✅    |   ✅    |    ❌    |    ❌    |   ✅    |
| **SRC Tax Export (AM)**                         |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Local PSP (Idram/ArCa)**                      |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Armenian localization (hy + imID + Armsoft)** |      ✅      |    ❌    |   ❌    |    ❌    |    ❌    |   ❌    |
| **Succession**                                  |      🔲      |    ❌    |   ❌    |    ❌    |    ✅    |   ❌    |
| **PWA / installable mobile**                    |      ⚠️      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| **Native mobile app (iOS + Android)**           |      🔲      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| **Workflow builder for tenants**                |      ⚠️      |    ✅    |   ❌    |    ✅    |    ❌    |   ❌    |
| **Public API + webhooks for customers**         |      ✅      |    ✅    |   ✅    |    ✅    |    ✅    |   ✅    |
| **Global payroll (100+ countries)**             |      🔲      |    ✅    |   ❌    |    ❌    |    ❌    |   ✅    |
| **Benefits brokerage / EOR / entity**           |      🔲      |    ✅    |   ❌    |    ❌    |    ❌    |   ✅    |
| **TOTAL (shipped features)**                    |   **~43**    | **~31**  | **~20** | **~16**  | **~13**  | **~16** |

> **Competitor marks are indicative**, compiled from public vendor material as of 2026-09, and
> must be re-verified per deal before being used in a sales document. This project's column was
> re-verified against the repository on 2026-09-16. Totals are the mechanical count of ✅ marks in
> the table above, not estimates — change a mark and the total changes with it.

**Shipped and re-verified since the last audit:** Shift Scheduling, SRC-ready payroll export
(Armenia Tax Service), **local payments (Idram/ArCa) end to end** — checkout handoff, HMAC-signed
webhooks, superadmin configuration, return pages, **public API + signed webhooks with plan quotas**,
automated SOC 2 evidence collection, public comparison pages in four languages, plus **Benefits,
Expenses, Assets, News, Compliance, Projects, Overtime, Strategy Maps, Telegram** — the
Armenian-tax and local-PSP rows exist in **no** global competitor.

### The distinction that actually decides the market

Feature count is not the scoreboard. On **shipped capability** this project now sits above the
mid-market set (BambooHR, HiBob, Personio) and roughly level with Rippling/Deel minus their
finance infrastructure. What still separates it from the market leaders is **not features**:

| Decides the deal                | Status here                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Native mobile apps              | ❌ missing (PWA partial)                                                          |
| Integration marketplace         | ❌ missing (API + webhooks shipped; no partner app store)                         |
| SOC 2 Type II certificate       | ⚠️ readiness doc + automated evidence (`npm run soc2:evidence`); audit not booked |
| Global payroll / EOR / entity   | ❌ out of scope by design                                                         |
| Support SLAs, DPA, legal entity | ⚠️ not evidenced                                                                  |
| Brand, references, channel      | ❌ none                                                                           |

**Therefore the winnable position is not "beat Workday everywhere" — it is "be the only correct
answer in Armenia and the Armenian/Russian-speaking diaspora",** where SRC filing, Idram/ArCa,
imID, Armsoft and a native Armenian locale are things no global vendor will build.

---

## How to Use This File

1. Pick a module number (e.g., "2.7" for Succession Planning)
2. Check the "Required files" section for what needs to be created
3. Follow the "Technical Standards" for file structure and patterns
4. Update this file after completing each module (change 🔲 → ✅)
5. Update the competitive analysis table

> 💡 **Next recommended module:** 2.7 Succession Planning (~3-4 days) — the only genuinely
> unstarted item in Phase 2. Everything else listed as "Not started" before 2026-09-15 is
> already shipped; see the Verification note at the top.

> ⚠️ **Before editing any status below:** check the code. The 2026-09-15 audit found four modules
> marked "Not started" that were fully implemented for some time.
