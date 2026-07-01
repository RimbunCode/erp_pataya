# Comprehensive ERP_INKINDO Documentation Plan

## Overview

This plan creates comprehensive documentation covering **all features, roles, and flows** in the ERP_INKINDO system, with extensive **Mermaid diagrams** (user journey maps, sequence diagrams, state machines, ER diagrams, activity flows) to facilitate easy reading and understanding.

**Existing documentation base:** 11 docs (~2,500 lines) already in `docs/` covering setup, architecture, database, roles, routes, 6 module flows, services, frontend, deployment, and 18 Mermaid diagrams.

**Strategy:** Extend the existing docs structure rather than replace it. Focus heavily on NEW diagrams and flow documentation that fills current gaps.

---

## Task 1: Enhanced Navigation & Documentation Index

**File:** `docs/README.md` (UPDATE existing)

**Changes:**
- Add role-based navigation ("I am a Student dev / Instructor dev / Admin dev")
- Add task-based navigation ("I want to add a feature / understand a flow / debug an issue")
- Add diagram quick-link section organized by type (architecture, user flows, state machines)
- Keep existing structure intact, expand it

**Dependencies:** None (can start immediately)

---

## Task 2: User Journey Maps (Per Role)

**File:** `docs/11-user-journeys.md` (NEW)

**Purpose:** High-level visual maps showing the complete experience of each user role — every feature they can access and how features connect.

**Content:**

### 2.1 Student Journey Map
```
Mermaid journey diagram showing:
Register → Setup → Browse Catalog → Add to Cart → Checkout (payment) → 
Wait for Approval → Access Course → Learn Content → Submit Assignments → 
Track Progress → Complete Course → Request Instructor Role (optional)
```

### 2.2 Instructor Journey Map
```
Mermaid journey diagram showing:
Login → Dashboard (analytics) → Create Course → Add Sections → Add Content → 
Submit for Publishing → Course Published → Students Enroll → Grade Submissions → 
View Earnings → Request Payout → Manage Profile
```

### 2.3 Admin Journey Map (per sub-permission)
```
Mermaid journey diagram showing per admin type:
- finance_admin: Verify Payments → Manage Payouts → Configure Fees
- course_admin: Review Course Requests → Manage Categories
- user_admin: Manage Users → Approve Role Requests
- content_admin: Manage Landing Page
- super_admin: All of above + User Permissions
```

### 2.4 Organization Journey Map
```
Dashboard → Partner Trainers → Financial → Profile
```

### 2.5 Guest Journey Map
```
Home → Browse Training → Preview Course → About/Contact → Register
```

**Diagrams to create:** 5 journey diagrams + 1 combined overview flowchart

**Dependencies:** None

---

## Task 3: Complete System Architecture Diagrams

**File:** `docs/12-system-architecture.md` (NEW)

**Purpose:** Technical architecture diagrams beyond the existing simple one in `10-diagrams.md`.

**Content:**

### 3.1 C4 Container Diagram
- Browser (React 19 SPA)
- Inertia.js Protocol Layer
- Laravel Application (Controllers → Services → Models)
- MySQL 8.0 Database
- File Storage (local/cloud)
- Mail Service (SMTP)
- Queue Worker (async jobs)

### 3.2 Component Diagram (Backend)
```
Mermaid diagram showing:
Middleware Layer → Controller Layer → Service Layer → Model Layer → Database
With specific components: Auth, Course, Finance, Progress
```

### 3.3 Component Diagram (Frontend)
```
Mermaid diagram showing:
Layouts → Pages → Components → Hooks → Utils
With shared props flow from backend
```

### 3.4 Deployment Architecture
```
Mermaid diagram showing:
GitHub → CI/CD → cPanel (staging/production)
With build steps (npm, composer, artisan)
```

### 3.5 Request Lifecycle Diagram
```
Detailed Mermaid sequence diagram:
Browser → Inertia → Middleware Chain → Controller → Service → Model → DB
→ Response → Inertia → React Page Render
```

### 3.6 Data Flow Diagram
```
How data flows between major system components:
Payment data flow, Course content flow, User authentication flow
```

**Diagrams to create:** 6 architecture diagrams

**Dependencies:** None

---

## Task 4: Detailed Feature Flow Diagrams

**File:** `docs/13-feature-flows.md` (NEW)

**Purpose:** Exhaustive activity diagrams and sequence diagrams for EVERY feature, going deeper than the existing `10-diagrams.md`.

**Content:**

### 4.1 Course Management Flow (Instructor)
- Course creation step-by-step (with validation)
- Section management (add/edit/reorder/delete)
- Content management (upload files, set types: material/assignment/pre_assessment)
- Thumbnail upload/delete flow
- Course publish request submission

### 4.2 Course Discovery & Enrollment Flow (Student)
- Catalog browsing and filtering
- Course preview (guest vs authenticated)
- Add to cart mechanism
- Checkout with payment proof upload
- Payment pending → admin review → enrollment activation

### 4.3 Learning & Progress Flow (Student)
- Course content navigation (sections → contents)
- Material completion (mark as done → UserProgress)
- Assignment submission (upload → Submission created)
- Pre-assessment flow
- Progress calculation formula visualization
- Course completion trigger (100% → enrollment completed)

### 4.4 Grading & Student Management (Instructor)
- View enrolled students per course
- Student progress detail view
- Submission review and grading
- Grade + feedback input → student notification

### 4.5 Payment Verification Flow (Admin)
- View pending payments list
- Review payment proof image
- Approve: verify → create enrollment → create instructor earning → calculate fee
- Reject: set rejection reason → student can re-upload

### 4.6 Payout Pipeline Flow (Complete)
- Earning creation from approved payment
- Available_at delay calculation
- Eligible balance calculation (exclude reserved)
- Manual payout request (instructor)
- Batch payout generation (admin)
- Payout approval → mark as paid → release earnings

### 4.7 Course Approval Workflow (Admin)
- View pending publish requests
- Review course details (price, content, quality)
- Approve → publish → visible in catalog
- Reject → rejection reason → instructor revises

### 4.8 Role Request Workflow
- Student requests instructor role
- Upload proof/credentials
- Admin reviews → approve (attach role) / reject (with reason)

### 4.9 Multi-Role Login & Switching
- Login → detect multiple roles → role selection page
- Cookie-based role storage
- Role switching without logout
- Dashboard redirection per role

### 4.10 User Registration & Onboarding
- Register flow (normal vs invited user)
- Email verification
- Google OAuth flow
- Setup user (complete profile)
- First login experience

### 4.11 Cart & Checkout System
- Add/remove courses to cart
- Cart panel UI flow
- Payment method selection
- Proof upload
- Checkout submission → creates Payment + Enrollment (pending)

### 4.12 Financial Configuration (Admin)
- Company fee percentage management
- Payout delay days management
- How changes affect new earnings (not retroactive)

### 4.13 Landing Page Management (Admin)
- Content settings (hero, about, features, etc.)
- How guest pages pull from settings

### 4.14 User Management (Admin)
- User directory (search, filter by role/status)
- User status management (activate/deactivate)
- Permission assignment for admin users
- Protection of last super_admin

**Diagrams to create:** ~20-25 Mermaid diagrams (mix of flowcharts and sequence diagrams)

**Dependencies:** Task 2 (journey maps provide context)

---

## Task 5: Comprehensive State Machine Diagrams

**File:** `docs/14-state-machines.md` (NEW)

**Purpose:** All entity state transitions in one place (expanded from existing `10-diagrams.md` which has 5 state machines).

**Content:**

### 5.1 Course Status States
```
DRAFT → PENDING → PUBLISHED / REJECTED → back to DRAFT
Including: triggers, who initiates, conditions
```

### 5.2 Payment Status States
```
PENDING → APPROVED / REJECTED → re-submit possible
Including: side effects (earning creation, enrollment activation)
```

### 5.3 Enrollment Status States
```
PENDING → ACTIVE / REJECTED → COMPLETED
Including: triggers, what unlocks access
```

### 5.4 Payout Request Status States
```
DRAFT / PENDING → APPROVED → PAID / REJECTED
Including: batch vs manual, earning reservation/release
```

### 5.5 Instructor Earning Lifecycle
```
CREATED → AVAILABLE (after delay) → RESERVED (in payout) → RELEASED (paid)
Logical states, not DB columns
```

### 5.6 Role Request Status States
```
PENDING → APPROVED / REJECTED
Including: what happens to user roles on approval
```

### 5.7 User Status States
```
PENDING → ACTIVE / INACTIVE
Including: triggers (email verify, admin action)
```

### 5.8 Submission Status States
```
SUBMITTED → GRADED
Including: who transitions, what data is added
```

### 5.9 Course Publish Request States
```
PENDING → APPROVED / REJECTED
Including: snapshot data stored (price, discount)
```

**Diagrams to create:** 9 state machine diagrams with detailed annotations

**Dependencies:** Task 4 (flows reference states)

---

## Task 6: Database ER Diagrams (Per Module)

**File:** `docs/15-database-erd.md` (NEW)

**Purpose:** Module-specific ER diagrams that are easier to read than the full system ERD in `03-database.md`. Each diagram shows only related tables.

**Content:**

### 6.1 User & Authentication Module ERD
```
users, roles, user_role, permissions, admin_user_permissions, 
user_providers, role_requests, student_profiles, instructor_profiles
```

### 6.2 Course & Content Module ERD
```
courses, categories, course_category, course_sections, course_contents,
course_content_files, course_notes, course_publish_requests
```

### 6.3 Enrollment & Payment Module ERD
```
enrollments, payments, carts, users (fk references)
```

### 6.4 Finance & Payout Module ERD
```
instructor_earnings, instructor_payout_requests, instructor_payout_request_items,
payments (source), users (instructor)
```

### 6.5 Learning & Progress Module ERD
```
user_progress, submissions, enrollments, course_contents
```

### 6.6 Content Management Module ERD
```
files, fileables, tags, taggables (polymorphic)
```

### 6.7 Full System ERD (Enhanced)
```
All tables with cardinality, key constraints, soft-delete indicators
```

**Diagrams to create:** 7 ER diagrams

**Dependencies:** None

---

## Task 7: Sequence Diagrams for Critical Interactions

**File:** `docs/16-sequence-diagrams.md` (NEW)

**Purpose:** Actor-to-system sequence diagrams showing the exact interaction timeline for critical operations.

**Content:**

### 7.1 Student Enrollment Sequence
```
Student → Browser → Controller → Service → DB → Mail → Response
Full sequence for: browse → cart → checkout → payment → approval → access
```

### 7.2 Instructor Course Publication Sequence
```
Instructor → Course CRUD → Publish Request → Admin Review → Approval → Public
```

### 7.3 Payment Verification Sequence
```
Admin → Finance Page → View Proof → Approve → EarningCreation → EnrollmentActivation
```

### 7.4 Payout Request & Fulfillment Sequence
```
Instructor → Check Balance → Request Payout → Admin Approve → Admin Pay → Release
```

### 7.5 Multi-Role Authentication Sequence
```
User → Login → Credential Check → Role Detection → Selection → Dashboard
```

### 7.6 Grading Workflow Sequence
```
Instructor → Student List → Submission → Grade Input → Save → Student Notified
```

### 7.7 Batch Payout Generation Sequence
```
Admin/Cron → RunBatchCommand → Scan Instructors → Create Drafts → Notify
```

**Diagrams to create:** 7 detailed sequence diagrams

**Dependencies:** Task 4 (activity flows inform sequences)

---

## Task 8: Controller & API Reference

**File:** `docs/17-api-reference.md` (NEW)

**Purpose:** Complete controller reference showing every endpoint, its authorization requirements, Inertia props, and related code.

**Content:**
- Organized by role group (Student, Instructor, Admin, Auth, Guest, Core)
- Per controller: class name, file path, responsibility, methods
- Per method: route, HTTP verb, middleware, Inertia page rendered, props passed
- Cross-references to service and model files

**Format:** Structured tables (easy to scan and maintain)

**Dependencies:** Task 4 (flows reference controllers)

---

## Task 9: Frontend Component & Page Inventory

**File:** `docs/18-frontend-reference.md` (NEW)

**Purpose:** Expand existing `08-frontend.md` with complete page inventory, component catalog, and frontend patterns.

**Content:**

### 9.1 Pages per Role (complete inventory)
- Student pages: path, route name, layout, purpose
- Instructor pages: path, route name, layout, purpose
- Admin pages: path, route name, layout, purpose
- Auth pages: path, route name, layout, purpose
- Guest pages: path, route name, layout, purpose

### 9.2 Reusable Components Catalog
- shadcn/ui components used
- Custom components (DataTable, FormPage, etc.)
- Hook inventory (useCart, useSessionStorage, usePermission, etc.)

### 9.3 Frontend Patterns
- Form handling (useForm + Inertia)
- Data table pattern
- Modal/dialog pattern
- Toast notifications
- File upload pattern
- Layout assignment pattern

**Dependencies:** None

---

## Task 10: Developer Workflows & Backend Patterns

**File:** `docs/19-developer-guide.md` (NEW)

**Purpose:** Common workflows (how to add features) and backend patterns (how code is structured).

**Content:**

### 10.1 Common Developer Workflows
- "Add a new Student feature" step-by-step
- "Add a new Instructor feature" step-by-step
- "Add a new Admin module" step-by-step
- "Add a new payment status" step-by-step
- "Create a new model with migration" step-by-step
- "Add a new admin permission" step-by-step

### 10.2 Backend Patterns Reference
- Service layer pattern (when to use, how to create)
- Trait usage (Submitable, DataTable, HasInitials, LinkModel, HasCountry)
- ULID + SoftDeletes convention
- BaseProfileController template method
- Middleware chain patterns
- FormRequest patterns
- DataTable backend (ModelController)

### 10.3 Developer Onboarding Path
- Sequential reading order for new developers
- Mini-tasks for hands-on learning

**Dependencies:** Tasks 8, 9

---

## Task 11: Update & Cross-Reference Existing Docs

**Files:** Multiple existing docs in `docs/`

**Changes:**
- Add "Related Documents" section to each existing doc
- Add breadcrumb navigation links
- Update `docs/README.md` with links to all new documents
- Ensure consistent terminology
- Add links from `10-diagrams.md` to the new detailed diagram docs

**Dependencies:** All previous tasks (this is the final integration step)

---

## Dependency Graph

```
Task 1 (README) ─────────────────────────────────────────────┐
Task 2 (User Journeys) ──────┐                               │
Task 3 (Architecture) ────────┤                               │
Task 6 (ER Diagrams) ─────────┤── can run in parallel         │
Task 9 (Frontend Ref) ────────┘                               │
                                                              │
Task 4 (Feature Flows) ←── depends on Task 2                  │
Task 5 (State Machines) ←── depends on Task 4                 │
Task 7 (Sequences) ←── depends on Task 4                      │
Task 8 (API Reference) ←── depends on Task 4                  │
Task 10 (Dev Guide) ←── depends on Tasks 8, 9                 │
Task 11 (Cross-References) ←── depends on ALL ────────────────┘
```

**Parallel Track A (immediate):** Tasks 1, 2, 3, 6, 9
**Parallel Track B (after Task 2):** Tasks 4, then 5, 7, 8 in parallel
**Sequential Final:** Task 10 → Task 11

---

## Diagram Summary

| Category | Count | Location |
|----------|-------|----------|
| User Journey Maps | 5 + 1 overview | `11-user-journeys.md` |
| Architecture Diagrams | 6 | `12-system-architecture.md` |
| Feature Activity Flows | ~20-25 | `13-feature-flows.md` |
| State Machines | 9 | `14-state-machines.md` |
| Module ER Diagrams | 7 | `15-database-erd.md` |
| Sequence Diagrams | 7 | `16-sequence-diagrams.md` |
| **TOTAL NEW DIAGRAMS** | **~55-60** | Across 6 files |

Combined with existing 18 diagrams in `10-diagrams.md`, the system will have **~75+ Mermaid diagrams** covering every aspect.

---

## Documentation Language

- New documentation will be written in **Indonesian** (consistent with existing docs)
- Code examples and technical terms remain in English
- Mermaid diagram labels in Indonesian (matching existing convention)

---

## File Structure After Completion

```
docs/
├── README.md                    ← UPDATED (enhanced navigation)
├── 01-setup.md                  ← unchanged
├── 02-architecture.md           ← unchanged
├── 03-database.md               ← unchanged
├── 04-roles-permissions.md      ← unchanged
├── 05-routes.md                 ← unchanged
├── 06-modules/
│   ├── auth.md                  ← unchanged
│   ├── course.md                ← unchanged
│   ├── enrollment.md            ← unchanged
│   ├── finance.md               ← unchanged
│   ├── student-progress.md      ← unchanged
│   └── admin.md                 ← unchanged
├── 07-services.md               ← unchanged (already comprehensive)
├── 08-frontend.md               ← unchanged
├── 09-deployment.md             ← unchanged
├── 10-diagrams.md               ← minor update (add links to new docs)
├── 11-user-journeys.md          ← NEW
├── 12-system-architecture.md    ← NEW
├── 13-feature-flows.md          ← NEW
├── 14-state-machines.md         ← NEW
├── 15-database-erd.md           ← NEW
├── 16-sequence-diagrams.md      ← NEW
├── 17-api-reference.md          ← NEW
├── 18-frontend-reference.md     ← NEW
└── 19-developer-guide.md        ← NEW
```

---

## Rejected Alternatives

### 1. Auto-Generation Script (from Plan C)
**Rejected because:** The user's primary ask is comprehensive documentation with diagrams, not automation tooling. Auto-generation produces shallow output that doesn't capture business logic or user flows. Can be added later as an enhancement.

### 2. Separate Docs per Approval Workflow (from Plan B)
**Rejected because:** Creates too many small files. Instead, approval workflows are consolidated within `13-feature-flows.md` (sections 4.5, 4.6, 4.7, 4.8) and their states in `14-state-machines.md`. This reduces navigation overhead.

### 3. Multi-Role System as Separate Doc (from Plan B)
**Rejected because:** Already well-documented in `04-roles-permissions.md`. The multi-role login flow is added to `13-feature-flows.md` (section 4.9) and `11-user-journeys.md`. No need for a dedicated file.

### 4. Finance Configuration as Separate Doc (from Plan B)
**Rejected because:** Already documented in `06-modules/finance.md`. Extended in feature flows (section 4.12). Separate doc would be redundant.

### 5. Lightweight Catalogs Only (from Plan A)
**Rejected because:** User specifically asked for diagrams to understand flows. Tables alone don't communicate process understanding. However, the catalog concept is incorporated into Task 8 (API Reference) and Task 9 (Frontend Reference).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Diagrams become outdated when code changes | Use Mermaid (text-based, version-controlled). Add "Last Updated" note per section. Include in PR checklist. |
| Too many diagrams overwhelm readers | Organize by type with clear table of contents. User journey maps provide top-level orientation before diving into details. |
| Documentation drift from existing docs | Cross-reference heavily (Task 11). Don't duplicate info — link to existing docs instead. |
| Large scope might not be completed | Prioritize by tracks: Tracks A (journeys, architecture, ER) provide highest value first. Feature flows (Track B) can be added incrementally. |
| Language inconsistency | Follow existing convention: Indonesian prose, English for code/technical terms. |

---

## Estimated Effort

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Task 1: README update | 1 hour | HIGH |
| Task 2: User Journeys | 3-4 hours | HIGH |
| Task 3: Architecture Diagrams | 3-4 hours | HIGH |
| Task 4: Feature Flows | 8-10 hours | HIGH |
| Task 5: State Machines | 3-4 hours | MEDIUM |
| Task 6: ER Diagrams | 4-5 hours | MEDIUM |
| Task 7: Sequence Diagrams | 4-5 hours | MEDIUM |
| Task 8: API Reference | 4-5 hours | MEDIUM |
| Task 9: Frontend Reference | 3-4 hours | MEDIUM |
| Task 10: Developer Guide | 3-4 hours | LOW |
| Task 11: Cross-References | 2-3 hours | LOW |
| **TOTAL** | **~38-48 hours** | |

**Recommended execution order:** Tasks 1-3-6 first (high value, independent), then Task 2-4 (core flows), then 5-7-8-9 (reference material), finally 10-11 (polish).
