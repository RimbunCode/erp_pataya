# Sequence Diagrams — Diagram Urutan Interaksi

Dokumen ini berisi diagram urutan (sequence diagram) yang menunjukkan interaksi timeline antar aktor dan komponen sistem untuk operasi-operasi kritis.

---

## Daftar Isi

1. [Student Enrollment (Browse → Access)](#1-student-enrollment)
2. [Instructor Course Publication](#2-instructor-course-publication)
3. [Payment Verification](#3-payment-verification)
4. [Payout Request & Fulfillment](#4-payout-request-fulfillment)
5. [Multi-Role Authentication](#5-multi-role-authentication)
6. [Grading Workflow](#6-grading-workflow)
7. [Batch Payout Generation](#7-batch-payout-generation)

---

## 1. Student Enrollment

Alur lengkap dari browse katalog sampai bisa mengakses kursus.

```mermaid
sequenceDiagram
    actor Student
    participant Browser as Browser (React)
    participant Controller as EnrollmentController
    participant DB as Database
    participant Storage as File Storage
    participant Admin
    participant Finance as SystemFinanceController
    participant Payout as InstructorPayoutService

    Student->>Browser: Browse /student/course-catalogue
    Browser->>Controller: GET /student/course-catalogue
    Controller->>DB: Query published courses\n(exclude enrolled, load cart)
    DB-->>Controller: Courses list
    Controller-->>Browser: CourseCatalogue page

    Student->>Browser: Klik Add to Cart
    Browser->>Controller: POST /student/cart
    Controller->>DB: Cart::firstOrCreate
    DB-->>Controller: OK
    Controller-->>Browser: Reload page

    Student->>Browser: Buka CartPanel + pilih courses
    Student->>Browser: Upload bukti bayar + pilih method
    Browser->>Controller: POST /student/enroll
    Controller->>Storage: Store payment proof
    Storage-->>Controller: Path file
    Controller->>DB: BEGIN TRANSACTION
    Controller->>DB: Payment::create (status=pending)
    Controller->>DB: Enrollment::create (status=pending)
    Controller->>DB: COMMIT
    Controller-->>Browser: Redirect + flash success

    Note over Admin: Beberapa waktu kemudian...

    Admin->>Finance: Buka /admin/finance
    Finance->>DB: Query payments + history
    DB-->>Finance: Payment data
    Finance-->>Admin: SystemFinance page

    Admin->>Finance: Klik Approve
    Finance->>DB: BEGIN TRANSACTION
    Finance->>DB: Payment.status = approved
    Finance->>DB: Enrollment.status = active
    Finance->>Payout: createEarningFromApprovedPayment
    Payout->>DB: InstructorEarning::updateOrCreate
    Finance->>DB: COMMIT
    Finance-->>Admin: Redirect + success

    Student->>Browser: Buka /student/my-courses
    Browser->>Controller: GET /student/my-courses
    Controller->>DB: Query active enrollments
    DB-->>Controller: Enrolled courses
    Controller-->>Browser: MyCourses page (course accessible)
```

---

## 2. Instructor Course Publication

Alur dari pembuatan course sampai dipublish ke katalog.

```mermaid
sequenceDiagram
    actor Instructor
    participant Browser as Browser (React)
    participant Course as CourseController
    participant DB as Database
    participant Admin
    participant Approval as CourseApprovalController

    Instructor->>Browser: Buka /instructor/classes
    Instructor->>Browser: Klik Create Course
    Browser->>Course: POST /instructor/classes
    Course->>DB: Course::create (is_published=false)
    Course->>DB: Attach category
    Course->>DB: Create sections + contents
    Course-->>Browser: Redirect ke CourseDetail

    Instructor->>Browser: Edit course details
    Instructor->>Browser: Klik Toggle Publish
    Browser->>Course: PATCH /classes/course/publish
    Course->>DB: Check pending request
    DB-->>Course: None pending
    Course->>DB: CoursePublishRequest::create\n(status=pending, snapshot price)
    Course-->>Browser: Flash success

    Note over Admin: Admin review...

    Admin->>Approval: Buka /admin/approvals
    Approval->>DB: Query publish requests\n+ course, creator, reviewer
    DB-->>Approval: Request list
    Approval-->>Admin: Approvals page

    alt Approve
        Admin->>Approval: Klik Approve
        Approval->>DB: BEGIN TRANSACTION
        Approval->>DB: Request.status = approved
        Approval->>DB: Course.is_published = true\nCourse.price = submitted_price
        Approval->>DB: COMMIT
        Approval-->>Admin: Success
    else Reject
        Admin->>Approval: Klik Reject + alasan
        Approval->>DB: Request.status = rejected\n+ rejection_reason
        Approval-->>Admin: Success
        Note over Instructor: Lihat rejection reason\nRevisi course dan submit ulang
    end
```

---

## 3. Payment Verification

Alur detail verifikasi pembayaran oleh admin finance.

```mermaid
sequenceDiagram
    actor Admin
    participant Browser as Browser (React)
    participant Finance as SystemFinanceController
    participant DB as Database
    participant Storage as File Storage
    participant Payout as InstructorPayoutService

    Admin->>Browser: Buka /admin/finance
    Browser->>Finance: GET /admin/finance
    Finance->>DB: Query all payments\nwith user, course, verifier
    Finance->>DB: Group by user_id|course_id\n(rejection history)
    Finance->>Payout: resolvePayoutDelayDays
    Payout->>DB: Preference query
    DB-->>Payout: delay_days
    Finance->>Payout: resolveCompanyFeePercentage
    Payout->>DB: Preference query
    DB-->>Payout: fee_percentage
    Finance->>Payout: calculateGlobalEligibleBalance
    Payout->>DB: Query eligible earnings\n(left join reserved amounts)
    DB-->>Payout: Balance total
    Finance-->>Browser: SystemFinance page\n(payments + stats + charts)

    Admin->>Browser: Klik Lihat Bukti Bayar
    Browser->>Finance: GET /admin/finance/payment/proof
    Finance->>Storage: Stream file response
    Storage-->>Browser: Image display

    alt Approve
        Admin->>Finance: Klik Approve
        Finance->>DB: Validate status = pending
        Finance->>DB: BEGIN TRANSACTION
        Finance->>DB: Payment: status=approved,\nverified_at, verified_by
        Finance->>DB: Enrollment: status=active,\nenrolled_at=now
        Finance->>Payout: createEarningFromApprovedPayment
        Payout->>DB: Calculate gross/company/instructor\namounts, set available_at
        Payout->>DB: InstructorEarning::updateOrCreate
        Finance->>DB: COMMIT
        Finance-->>Browser: Redirect + success
    else Reject
        Admin->>Finance: Klik Reject + alasan
        Finance->>DB: Validate status = pending
        Finance->>DB: BEGIN TRANSACTION
        Finance->>DB: Payment: status=rejected,\nrejection_reason
        Finance->>DB: Enrollment: status=rejected
        Finance->>DB: COMMIT
        Finance-->>Browser: Redirect + success
    end
```

---

## 4. Payout Request & Fulfillment

Alur lengkap dari instruktur request payout sampai dana dicairkan.

```mermaid
sequenceDiagram
    actor Instructor
    participant Browser as Browser (React)
    participant Financial as FinancialController
    participant Service as InstructorPayoutService
    participant DB as Database
    actor Admin
    participant Finance as SystemFinanceController
    participant Storage as File Storage

    Instructor->>Browser: Buka /instructor/financial
    Browser->>Financial: GET /instructor/financial
    Financial->>Service: calculateEligibleBalance
    Service->>DB: Query earnings\n(available_at<=now, released_at IS NULL)\nleft join reserved amounts
    DB-->>Service: Eligible earnings
    Service-->>Financial: Balance amount
    Financial->>DB: Query lifetime earning\n+ pending payouts
    Financial-->>Browser: Financials page\n(balance, mutations, payouts)

    Instructor->>Browser: Input nominal + note
    Browser->>Financial: POST /financial/payout-requests
    Financial->>Service: createInstructorRequest
    Service->>DB: Validate amount <= balance
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: InstructorPayoutRequest::create\n(status=pending, source=manual)
    Service->>DB: Create PayoutRequestItems\n(distribute across earnings)
    Service->>DB: COMMIT
    Financial-->>Browser: Redirect + success

    Note over Admin: Admin review payout...

    Admin->>Finance: Buka /admin/finance tab Payouts
    Finance->>DB: Query payout requests\nwith instructor, requestedBy, etc.
    DB-->>Finance: Payout list

    Admin->>Finance: Klik Approve
    Finance->>Service: approvePayoutRequest
    Service->>DB: Validate status in [draft, pending]
    Service->>DB: Update status=approved,\napproved_by, approved_amount
    Service-->>Finance: Updated request

    Admin->>Finance: Transfer ke bank instruktur
    Admin->>Finance: Upload bukti + reference
    Finance->>Storage: Store proof file
    Finance->>Service: markPayoutAsPaid
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: Update status=paid,\npaid_by, transfer_reference
    Service->>DB: Check all paid items\nfor each earning
    Service->>DB: If total_paid >= instructor_amount\n→ released_at = now
    Service->>DB: COMMIT
    Finance-->>Browser: Redirect + success
```

---

## 5. Multi-Role Authentication

Alur login dengan deteksi multiple roles dan pemilihan role.

```mermaid
sequenceDiagram
    actor User
    participant Browser as Browser (React)
    participant Auth as AuthenticatedSessionController
    participant Verifier as LoginCredentialVerifier
    participant Resolver as RoleResolver
    participant DB as Database
    participant Session as Session/Cookie

    User->>Browser: Buka /login
    User->>Browser: Isi email + password
    Browser->>Auth: POST /login/roles
    Auth->>Verifier: verifyCredentials
    Verifier->>DB: Find user by email/username
    DB-->>Verifier: User record
    Verifier->>Verifier: Check password hash\n+ rate limiting (5/min)
    Verifier-->>Auth: User instance
    Auth->>Resolver: normalizeRoles(user.roles)
    Resolver-->>Auth: Normalized roles array

    alt 1 role
        Auth-->>Browser: {auto_role: "student", requires_selection: false}
    else 2+ roles
        Auth-->>Browser: {roles: [...], requires_selection: true}
        Browser-->>User: Show SelectRole page
        User->>Browser: Pilih role
    end

    Browser->>Auth: POST /login (preferred_role)
    Auth->>Verifier: verifyCredentials (again)
    Verifier-->>Auth: User instance
    Auth->>DB: Auth::login(user)
    Auth->>Session: session->regenerate()
    Auth->>Resolver: dashboardPath(role)
    Resolver-->>Auth: "/student/dashboard"
    Auth->>Resolver: makeLastActiveRoleCookie
    Auth-->>Browser: Redirect + cookie(last_active_role)

    Note over User: Switching role...
    User->>Browser: Klik role lain (e.g. /instructor)
    Browser->>DB: GET /instructor
    DB->>Resolver: isRoleOwned(instructor, user.roles)
    Resolver-->>DB: true
    DB->>Resolver: dashboardPath(instructor)
    DB-->>Browser: Redirect + new cookie
```

---

## 6. Grading Workflow

Alur instruktur menilai submission student.

```mermaid
sequenceDiagram
    actor Instructor
    participant Browser as Browser (React)
    participant Student as StudentManagementController
    participant Submission as SubmissionController
    participant DB as Database

    Instructor->>Browser: Buka /instructor/students
    Browser->>Student: GET /instructor/students
    Student->>DB: Query enrollments\n(status=active, course by instructor)
    Student->>DB: Load user, course.sections.contents
    Student->>DB: Build completedLookup per user
    Student->>DB: Build submittedLookup per user
    Student->>DB: Build submissions with files
    Student->>Student: calculateProgress per student
    Student->>Student: buildModules per student
    Student-->>Browser: StudentManagement page

    Instructor->>Browser: Pilih student
    Instructor->>Browser: Lihat submissions list
    Instructor->>Browser: Klik submission belum dinilai
    Instructor->>Browser: Download file tugas
    Browser->>DB: GET /files/file/preview
    DB-->>Browser: File stream

    Instructor->>Browser: Input grade (0-100) + feedback
    Browser->>Submission: PATCH /enrollments/{e}/submissions/{s}/grade
    Submission->>DB: UPDATE submissions
SET status='graded',
grade=value,
feedback=text,
graded_at=now
    DB-->>Submission: OK
    Submission-->>Browser: Redirect + success

    Note over Instructor: Nilai muncul di\nMyCourses student
```

---

## 7. Batch Payout Generation

Alur admin generate payout batch untuk semua instruktur.

```mermaid
sequenceDiagram
    actor Admin
    participant Browser as Browser (React)
    participant Finance as SystemFinanceController
    participant Service as InstructorPayoutService
    participant DB as Database

    Admin->>Browser: Klik Run Batch Payout
    Browser->>Finance: POST /admin/finance/payouts/batch
    Finance->>Service: runBatchDraftPayouts(actor)

    Service->>DB: resolveBatchCandidateInstructorIds\nSELECT DISTINCT instructor_id\nFROM instructor_earnings\nWHERE available_at <= now()
    DB-->>Service: List of instructor IDs

    loop Per instructor
        Service->>Service: queryEligibleEarnings(instructorId)
        Service->>DB: Query earnings\n(available, not released,\nminus reserved)
        DB-->>Service: Eligible earnings + amounts
        Service->>Service: Sum available amounts

        alt Amount > 0
            Service->>DB: BEGIN TRANSACTION
            Service->>DB: InstructorPayoutRequest::create\n(status=draft, source=batch,\nrequested_by=admin)
            loop Per eligible earning
                Service->>DB: PayoutRequestItem::create\n(payout_request_id, earning_id, amount)
            end
            Service->>DB: COMMIT
            Note over Service: created++
        else Amount = 0
            Note over Service: skipped++
        end
    end

    Service-->>Finance: {created: N, skipped: M}
    Finance-->>Browser: Redirect + flash\n"Draft dibuat: N, dilewati: M"

    Note over Admin: Draft payout muncul\ndi tab Payouts untuk review
```
