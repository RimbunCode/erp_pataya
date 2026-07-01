# Organization Registration Feature

## Context

The ERP Inkindo LMS already has an `organization` role with routes and a placeholder Organizations tab in the admin User Directory page. This feature implements the full lifecycle: admin invites an organization via email, the organization completes their profile on a public form, and admin reviews/approves to create the account.

## Flow

```
Admin sends invite (name, email, contact person)
  → organization_invitations record (status: invited)
  → email with secure token link
  → Org clicks link → public form (guest route)
  → Org fills profile + password → status: submitted
  → Admin reviews in Organizations tab
  → Admin approves → user created with organization role → status: approved
  → Confirmation email sent
```

---

## Task 1: Database Migration

**Create:** `database/migrations/2026_06_22_000001_create_organization_invitations_table.php`

| Column | Type | Notes |
|--------|------|-------|
| `id` | ulid PK | |
| `token` | string(64), unique, indexed | Secure token for public form |
| `organization_name` | string, NOT NULL | |
| `email` | string, NOT NULL | |
| `contact_person` | string, NOT NULL | |
| `address` | text, nullable | Filled during completion |
| `phone` | string(20), nullable | |
| `website` | string, nullable | |
| `industry` | string, nullable | |
| `employee_count` | string, nullable | Range: "1-10", "11-50", etc. |
| `logo_file_id` | ulid, nullable, FK files | |
| `password` | string, nullable, hashed | Stored on invitation, transferred to user on approval |
| `status` | string, default: `'invited'` | Uses FormStatus enum values |
| `invited_by` | ulid, FK users, nullOnDelete | |
| `reviewed_by` | ulid, nullable, FK users | |
| `reviewed_at` | timestamp, nullable | |
| `rejection_reason` | text, nullable | |
| `user_id` | ulid, nullable, FK users, nullOnDelete | Linked user account |
| `submitted_at` | timestamp, nullable | |
| `expired_at` | timestamp, nullable | Default 7 days from creation |
| `timestamps` | | |
| `deleted_at` | softDeletes | |

---

## Task 2: Model + Factory

**Create:** `app/Models/OrganizationInvitation.php`
- Traits: `HasUlids`, `SoftDeletes`, `HasFactory`
- Cast: `status` → `FormStatusCast::class`
- Relationships: `invitedBy()`, `reviewedBy()`, `user()`, `logoFile()` (all belongsTo)
- Scopes: `scopePendingReview`, `scopeInvited`, `scopeApproved`
- Methods: `isExpired()`, `isPendingReview()`, `isApproved()`

**Create:** `database/factories/OrganizationInvitationFactory.php`
- States: `submitted()`, `approved()`, `rejected()`, `expired()`, `withProfile()`

---

## Task 3: Service Layer

**Create:** `app/Services/Admin/OrganizationInvitationService.php`

Four methods:
1. **`sendInvitation(array $data, User $invitedBy)`** — Generate token, create record (status: invited, expired_at: +7 days), dispatch email notification
2. **`completeProfile(OrganizationInvitation $inv, array $data)`** — Validate not expired, update profile fields + editable fields (name, email, CP) + hashed password, set status → submitted
3. **`approve(OrganizationInvitation $inv, User $reviewer)`** — Create/update User with `organization` role (reuse existing INVITED user pattern from `RegisteredUserController`), link invitation, dispatch confirmation email
4. **`reject(OrganizationInvitation $inv, User $reviewer, string $reason)`** — Set status → rejected + reason, dispatch rejection email

**Modify:** `app/Services/Auth/UserRoleManager.php`
- Add `attachOrganizationRole(User $user): void` following the same pattern as `attachInstructorRole()`

---

## Task 4: Notifications

**Create:** `app/Notifications/OrganizationInvitationNotification.php`
- Uses `MyMailMessage` with button linking to `route('guest.organization.complete', ['token' => ...])`
- Subject: "Undangan Registrasi Organisasi - INKINDO"

**Create:** `app/Notifications/OrganizationApprovedNotification.php`
- Button linking to login page

**Create:** `app/Notifications/OrganizationRejectedNotification.php`
- Includes rejection reason, button to contact page

---

## Task 5: Form Requests

**Create:** `app/Http/Requests/Admin/SendOrganizationInvitationRequest.php`
- Rules: `organization_name` (required), `email` (required|email), `contact_person` (required)

**Create:** `app/Http/Requests/Admin/ReviewOrganizationInvitationRequest.php`
- Rules: `action` (required|in:approve,reject), `reason` (required_if:action,reject)

**Create:** `app/Http/Requests/Guest/CompleteOrganizationProfileRequest.php`
- Rules: all profile fields + `password` (required|confirmed|min:8) + `logo` (nullable|image|max:2048)

---

## Task 6: Controllers

**Create:** `app/Http/Controllers/Admin/OrganizationInvitationController.php`
- `store()` — POST invite, returns `back()` with Inertia partial reload `['orgs']`
- `review()` — PATCH approve/reject
- `resend()` — POST resend email
- `destroy()` — DELETE cancel invitation

**Create:** `app/Http/Controllers/Guest/OrganizationCompletionController.php`
- `show(string $token)` — GET show form with pre-filled data (validates token + expiry)
- `store(string $token)` — POST submit completed profile
- `success()` — GET thank-you page

**Modify:** `app/Http/Controllers/Admin/UserDirectoryController.php`
- Update `index()` to query `OrganizationInvitation` and provide real `orgs` payload (replacing the placeholder `[]`)

---

## Task 7: Routes

**Modify:** `routes/web.php` — Inside the `admin.permission:user_admin,super_admin` group (after line 179):
```php
Route::post('/user/organizations/invite', [OrganizationInvitationController::class, 'store'])->name('user.organizations.invite');
Route::patch('/user/organizations/{invitation}/review', [OrganizationInvitationController::class, 'review'])->name('user.organizations.review');
Route::post('/user/organizations/{invitation}/resend', [OrganizationInvitationController::class, 'resend'])->name('user.organizations.resend');
Route::delete('/user/organizations/{invitation}', [OrganizationInvitationController::class, 'destroy'])->name('user.organizations.destroy');
```

**Modify:** `routes/guest.php` — Add:
```php
Route::get('/organization/complete/success', [OrganizationCompletionController::class, 'success'])->name('organization.success');
Route::get('/organization/complete/{token}', [OrganizationCompletionController::class, 'show'])->name('organization.complete');
Route::post('/organization/complete/{token}', [OrganizationCompletionController::class, 'store'])->name('organization.complete.store');
```
Note: `success` route must be defined before `{token}` route.

---

## Task 8: Frontend — Admin Side

**Create:** `resources/js/Pages/Admin/UserDirectory/components/InviteOrganizationModal.jsx`
- 3-field form (org name, email, contact person) using `useForm` + `router.post`

**Create:** `resources/js/Pages/Admin/UserDirectory/components/ReviewOrganizationDialog.jsx`
- Approve/reject dialog with rejection reason textarea

**Rewrite:** `resources/js/Pages/Admin/UserDirectory/tabs/TabOrganizations.jsx`
- Full list/detail view with status sections: Pending Review, Invited, Approved, Rejected
- Detail panel shows org info + context-dependent action buttons
- "Invite Organization" button in header
- Uncomment the orgs tab in `index.jsx` TABS array

**Modify:** `resources/js/Pages/Admin/UserDirectory/index.jsx`
- Uncomment the "orgs" tab entry in the TABS array (line 22-26)

---

## Task 9: Frontend — Guest Side

**Create:** `resources/js/Pages/Guest/OrganizationComplete.jsx`
- Public form page using `AuthLayout`-style layout
- Pre-filled editable fields, profile completion fields, logo upload, password fields
- Expired/already-submitted error states

**Create:** `resources/js/Pages/Guest/OrganizationCompleteSuccess.jsx`
- Thank-you page with "pending admin review" message

---

## Task 10: Tests

**Create:** `tests/Feature/Admin/OrganizationInvitationTest.php`
- Admin can send invitation, validates fields, permission checks
- Admin can approve/reject submitted invitations
- Cannot approve non-submitted invitations

**Create:** `tests/Feature/Guest/OrganizationCompletionTest.php`
- Valid token shows form, expired token shows error
- Guest can submit completed profile, password validation
- Invalid token returns 404, already-submitted cannot be resubmitted

**Create:** `tests/Unit/OrganizationInvitationServiceTest.php`
- Service methods tested in isolation with factories

---

## Verification

1. Run migration: `php artisan migrate`
2. Run tests: `php artisan test --compact tests/Feature/Admin/OrganizationInvitationTest.php tests/Feature/Guest/OrganizationCompletionTest.php tests/Unit/OrganizationInvitationServiceTest.php`
3. Manual test: Visit `/admin/user`, switch to Organizations tab, send invitation, complete form via email link, approve in admin panel
4. Run pint: `vendor/bin/pint --dirty --format agent`
