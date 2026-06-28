<?php
use App\Http\Controllers\Admin\CourseApprovalController;
use App\Http\Controllers\Admin\CourseCategoryController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\LandingPageSettingController;
use App\Http\Controllers\Admin\OrganizationInvitationController;
use App\Http\Controllers\Admin\ProfileController as AdminProfileController;
use App\Http\Controllers\Admin\SystemFinanceController;
use App\Http\Controllers\Admin\UserDirectoryController;
use App\Http\Controllers\Core\CompanyLogoController;
use App\Http\Controllers\Core\FileController;
use App\Http\Controllers\Core\LanguageController;
use App\Http\Controllers\Instructor\CourseContentController;
use App\Http\Controllers\Instructor\CourseController as InstructorCourseController;
use App\Http\Controllers\Instructor\CourseSectionController;
use App\Http\Controllers\Instructor\CourseSectionNoteController;
use App\Http\Controllers\Instructor\DashboardController as InstructorDashboardController;
use App\Http\Controllers\Instructor\FinancialController as InstructorFinancialController;
use App\Http\Controllers\Instructor\ProfileController as InstructorProfileController;
use App\Http\Controllers\Instructor\CertificateIssueController;
use App\Http\Controllers\Instructor\StudentManagementController;
use App\Http\Controllers\Instructor\SubmissionController as InstructorSubmissionController;
use App\Http\Controllers\ModelController;
use App\Http\Controllers\Student\CartController;
use App\Http\Controllers\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Student\CourseListController;
use App\Http\Controllers\Student\DashboardController as StudentDashboardController;
use App\Http\Controllers\Student\EnrollmentController;
use App\Http\Controllers\Student\InstructorRoleRequestController;
use App\Http\Controllers\Student\ProfileController as StudentProfileController;
use App\Http\Controllers\Student\ProgressController;
use App\Http\Controllers\Student\CertificateController as StudentCertificateController;
use App\Http\Controllers\Admin\CertificateTemplateController;
use App\Http\Controllers\Student\SubmissionController;
use App\Services\Auth\RoleResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::macro('resourceDetail', function ($name, $controller, bool $isSubmmitable = false, $nestedShow = null) {
    $uri = Str::plural($name);
    Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name, $nestedShow, $isSubmmitable) {
        Route::get('/', 'index')->name("$uri.index");
        Route::post('/', 'store')->name("$uri.store");
        Route::get('/create/{ref?}', 'create')->name("$uri.create")->where('ref', '.*');

        if ($isSubmmitable) {
            Route::put("/{{$name}}/submit", 'submit')->name("$uri.submit");
            Route::put("/{{$name}}/cancel", 'cancel')->name("$uri.cancel");
            Route::put("/{{$name}}/amend", 'amend')->name("$uri.amend");
            Route::put("/{{$name}}/{level?}", 'update')->name("$uri.update");
            Route::get('/create-print-template', 'createPrintTemplate')->name("$uri.createPrintTemplate");
            Route::get("/{{$name}}/print/{printTemplate?}", 'print')->name("$uri.print");
        } else {
            Route::put("/{{$name}}", action: 'update')->name("$uri.update");
        }

        if ($nestedShow) {
            Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
        }
        Route::get("/{{$name}}", 'show')->name("$uri.show");
        Route::delete("/{{$name}}", 'destroy')->name("$uri.destroy");

        Route::post("/{{$name}}/comment", 'addComment')->name("$uri.addComment");
        Route::delete("/{{$name}}/comment/{id}", 'removeComment')->name("$uri.removeComment");

        Route::post("/{{$name}}/tag", 'addTag')->name("$uri.addTag");
        Route::delete("/{{$name}}/tag/{id}", 'removeTag')->name("$uri.removeTag");

        Route::post("/{{$name}}/file", 'addFile')->name("$uri.addFile");
        Route::delete("/{{$name}}/file/{id}", 'removeFile')->name("$uri.removeFile");
    });
});

Route::get('/', function () {
    return redirect('/');
});

// Organization completion (public guest routes — must be before auth group)
use App\Http\Controllers\Guest\OrganizationCompletionController;

Route::get('/organization/complete/success', [OrganizationCompletionController::class, 'success'])->name('organization.success');
Route::get('/organization/complete/{token}', [OrganizationCompletionController::class, 'show'])->name('organization.complete');
Route::post('/organization/complete/{token}', [OrganizationCompletionController::class, 'store'])->name('organization.complete.store');

Route::middleware(['auth'])->group(function () {

    //     // Files
    Route::resourceDetail('file', FileController::class);

    Route::middleware(['role:student'])->prefix('/student')->group(function () {
        Route::get('/dashboard', [StudentDashboardController::class, 'index'])->name('student.dashboard');
        Route::get('/my-courses', [CourseListController::class, 'index'])->name('student.courses.index');
        Route::post('/submissions/{content}', [SubmissionController::class, 'store'])->name('student.submissions.store');
        Route::delete('/submissions/{content}/files/{file}', [SubmissionController::class, 'destroyFile'])->name('student.submissions.files.destroy');
        Route::post('/progress/{content}', [ProgressController::class, 'store'])->name('student.progress.store');
        Route::get('/course-catalogue', [StudentCourseController::class, 'index'])->name('student.course-catalogue');
        Route::get('/course-preview/{course}', [StudentCourseController::class, 'show'])->name('student.course.preview');
        Route::post('/enroll', [EnrollmentController::class, 'store'])->name('student.enroll');
        Route::post('/cart', [CartController::class, 'store'])->name('student.cart.store');
        Route::delete('/cart/{courseId}', [CartController::class, 'destroy'])->name('student.cart.destroy');
        Route::get('/profile', [StudentProfileController::class, 'index'])->name('student.profile');
        Route::put('/profile', [StudentProfileController::class, 'update'])->name('student.profile.update');
        Route::post('/instructor-requests', [InstructorRoleRequestController::class, 'store'])->name('student.instructor-requests.store');
        Route::post('/profile/avatar', [StudentProfileController::class, 'updateAvatar'])->name('student.avatar.update');
        Route::delete('/profile/avatar', [StudentProfileController::class, 'destroyImage'])->name('student.image.delete');
        Route::get('/certificates', [StudentCertificateController::class, 'index'])->name('student.certificates');
        Route::get('/certificates/{credentialId}/verify', [StudentCertificateController::class, 'verify'])->name('student.certificates.verify');
    });

    Route::middleware(['role:instructor'])->prefix('/instructor')->name('instructor.')->group(function () {

        Route::get('/dashboard', [InstructorDashboardController::class, 'index'])->name('dashboard');
        Route::prefix('classes')->name('classes.')->group(function () {
            // Course CRUD
            Route::get('/', [InstructorCourseController::class, 'index'])->name('index');
            Route::post('/', [InstructorCourseController::class, 'store'])->name('store');
            Route::get('/{course}', [InstructorCourseController::class, 'show'])->name('show');
            Route::patch('/{course}', [InstructorCourseController::class, 'update'])->name('update');
            Route::post('/{course}/avatar', [InstructorCourseController::class, 'updateThumbnail'])->name('thumbnail.update');
            Route::delete('/{course}/avatar', [InstructorCourseController::class, 'destroyThumbnail'])->name('thumbnail.delete');
            Route::patch('/{course}/publish', [InstructorCourseController::class, 'togglePublish'])->name('togglePublish');
            // Sections
            Route::post('/{course}/sections', [CourseSectionController::class, 'store'])->name('sections.store');
            Route::patch('/sections/{section}', [CourseSectionController::class, 'update'])->name('sections.update');
            Route::delete('/sections/{section}', [CourseSectionController::class, 'destroy'])->name('sections.destroy');
            // Notes (per section)
            Route::post('/sections/{section}/notes', [CourseSectionNoteController::class, 'store'])->name('sections.notes.store');
            Route::delete('/notes/{note}', [CourseSectionNoteController::class, 'destroy'])->name('sections.notes.destroy');
            // Contents
            Route::post('/sections/{section}/contents', [CourseContentController::class, 'store'])->name('sections.contents.store');
            Route::patch('/contents/{content}', [CourseContentController::class, 'update'])->name('sections.contents.update');
            Route::delete('/contents/{content}', [CourseContentController::class, 'destroy'])->name('sections.contents.destroy');
            Route::post('/contents/{content}/upload', [CourseContentController::class, 'upload'])->name('sections.contents.upload');
            Route::delete('/contents/{content}/files/{file}', [CourseContentController::class, 'destroyFile'])->name('sections.contents.files.destroy');
        });
        Route::get('/students', [StudentManagementController::class, 'index'])->name('students');
        Route::patch('/enrollments/{enrollment}/submissions/{submission}/grade', [InstructorSubmissionController::class, 'grade'])->name('enrollments.submissions.grade');
        Route::post('/enrollments/{enrollment}/issue-certificate', [CertificateIssueController::class, 'issue'])->name('enrollments.issue-certificate');
        Route::get('/growth', fn () => inertia('Instructors/GrowthAnalytics'))->name('growth');
        Route::get('/financial', [InstructorFinancialController::class, 'index'])->name('financial');
        Route::post('/financial/payout-requests', [InstructorFinancialController::class, 'storePayoutRequest'])->name('financial.payout-requests.store');

        Route::get('/profile', [InstructorProfileController::class, 'index'])->name('profile');
        Route::put('/profile', [InstructorProfileController::class, 'update'])->name('profile.update');
        Route::post('/profile/avatar', [InstructorProfileController::class, 'updateAvatar'])->name('avatar.update');
        Route::delete('/profile/avatar', [InstructorProfileController::class, 'destroyImage'])->name('image.delete');
    });

    Route::middleware(['role:organization'])->prefix('/organization')->group(function () {
        Route::get('/dashboard', fn () => inertia('Organizations/Dashboard'))->name('organization.dashboard');
        Route::get('/partner', fn () => inertia('Organizations/PartnerTrainers'))->name('organization.partner');
        Route::get('/profile', fn () => inertia('Organizations/ProfileSettings'))->name('organization.profile');
        Route::get('/financial', fn () => inertia('Organizations/Financials'))->name('organization.financial');
    });

    Route::middleware(['role:admin'])->prefix('/admin')->name('admin.')->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index'])->name('dashboard');

        Route::middleware(['admin.permission:course_admin,super_admin'])->group(function () {
            Route::get('/approvals', [CourseApprovalController::class, 'index'])->name('approval');
            Route::patch('/approvals/{coursePublishRequest}/approve', [CourseApprovalController::class, 'approve'])->name('approval.approve');
            Route::patch('/approvals/{coursePublishRequest}/reject', [CourseApprovalController::class, 'reject'])->name('approval.reject');
            Route::get('/course-categories', [CourseCategoryController::class, 'index'])->name('course-categories.index');
            Route::post('/course-categories', [CourseCategoryController::class, 'store'])->name('course-categories.store');
        });

        Route::middleware(['admin.permission:finance_admin,super_admin'])->group(function () {
            Route::get('/finance', [SystemFinanceController::class, 'index'])->name('finance');
            Route::patch('/finance/{payment}/approve', [SystemFinanceController::class, 'approve'])->name('finance.approve');
            Route::patch('/finance/{payment}/reject', [SystemFinanceController::class, 'reject'])->name('finance.reject');
            Route::get('/finance/{payment}/proof', [SystemFinanceController::class, 'proof'])->name('finance.proof');
            Route::post('/finance/payouts/batch', [SystemFinanceController::class, 'runPayoutBatch'])->name('finance.payouts.batch');
            Route::patch('/finance/payouts/{payoutRequest}/approve', [SystemFinanceController::class, 'approvePayoutRequest'])->name('finance.payouts.approve');
            Route::patch('/finance/payouts/{payoutRequest}/reject', [SystemFinanceController::class, 'rejectPayoutRequest'])->name('finance.payouts.reject');
            Route::patch('/finance/payouts/{payoutRequest}/paid', [SystemFinanceController::class, 'markPayoutRequestAsPaid'])->name('finance.payouts.paid');
            Route::get('/finance/payouts/{payoutRequest}/proof', [SystemFinanceController::class, 'payoutProof'])->name('finance.payouts.proof');
            Route::patch('/finance/settings/payout-delay', [SystemFinanceController::class, 'updatePayoutDelay'])->name('finance.settings.payout-delay');
            Route::patch('/finance/settings/company-fee', [SystemFinanceController::class, 'updateCompanyFee'])->name('finance.settings.company-fee');
        });

        Route::middleware(['admin.permission:user_admin,super_admin'])->group(function () {
            Route::get('/user', [UserDirectoryController::class, 'index'])->name('user');
            Route::patch('/user/requests/{roleRequest}/approve', [UserDirectoryController::class, 'approveRequest'])->name('user.requests.approve');
            Route::patch('/user/requests/{roleRequest}/reject', [UserDirectoryController::class, 'rejectRequest'])->name('user.requests.reject');
            Route::patch('/user/users/{user}/status', [UserDirectoryController::class, 'updateUserStatus'])->name('user.users.status');

            // Organization invitations
            Route::post('/user/organizations/invite', [OrganizationInvitationController::class, 'store'])->name('user.organizations.invite');
            Route::patch('/user/organizations/{invitation}/review', [OrganizationInvitationController::class, 'review'])->name('user.organizations.review');
            Route::post('/user/organizations/{invitation}/resend', [OrganizationInvitationController::class, 'resend'])->name('user.organizations.resend');
            Route::delete('/user/organizations/{invitation}', [OrganizationInvitationController::class, 'destroy'])->name('user.organizations.destroy');
        });

        Route::middleware(['admin.permission:content_admin,super_admin'])->group(function () {
            Route::get('/landing-page-settings', [LandingPageSettingController::class, 'index'])->name('landing-page-settings.index');
            Route::patch('/landing-page-settings', [LandingPageSettingController::class, 'update'])->name('landing-page-settings.update');
            Route::post('/landing-page-settings/media', [LandingPageSettingController::class, 'uploadMedia'])->name('landing-page-settings.media.upload');
            Route::get('/certificate-templates', [CertificateTemplateController::class, 'index'])->name('certificate-templates.index');
            Route::post('/certificate-templates', [CertificateTemplateController::class, 'store'])->name('certificate-templates.store');
            Route::patch('/certificate-templates/{certificateTemplate}', [CertificateTemplateController::class, 'update'])->name('certificate-templates.update');
            Route::delete('/certificate-templates/{certificateTemplate}', [CertificateTemplateController::class, 'destroy'])->name('certificate-templates.destroy');
        });

        Route::middleware(['admin.permission:super_admin'])->group(function () {
            Route::patch('/user/admins/{user}/permissions', [UserDirectoryController::class, 'updateAdminPermissions'])->name('user.admins.permissions');
        });

        Route::get('/profile', [AdminProfileController::class, 'index'])->name('profile');
        Route::put('/profile', [AdminProfileController::class, 'update'])->name('profile.update');
        Route::post('/profile/avatar', [AdminProfileController::class, 'updateAvatar'])->name('avatar.update');
        Route::delete('/profile/avatar', [AdminProfileController::class, 'destroyImage'])->name('image.delete');
    });

    Route::get('/{role}/{path?}', function (Request $request, string $role, RoleResolver $roleResolver) {
        $user = $request->user();
        if (! $user) {
            return redirect('/');
        }

        $userRoles = $roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        if (! $roleResolver->isRoleOwned($role, $userRoles)) {
            abort(403, 'Unauthorized.');
        }

        return redirect($roleResolver->dashboardPath($role))
            ->withCookie($roleResolver->makeLastActiveRoleCookie($role));
    })
        ->where('role', 'student|instructor|organization|admin')
        ->where('path', '.*')
        ->name('role.prefix.fallback');
});

// Languages
Route::controller(LanguageController::class)->group(function () {
    Route::get('/lang', 'index')->name('lang.index');
    Route::post('/lang', action: 'set')->name('lang.set');
});

// Route for Preview Image
Route::get('/company-logo', CompanyLogoController::class)->name('company-logo');

Route::get('/files/{file}/preview', [FileController::class, 'preview'])->name('files.preview');
// Get Data from Model Direct
Route::post('/model', ModelController::class)
    ->middleware(middleware: ['auth'])
    ->name('model');
Route::post('/model/datatable', [ModelController::class, 'datatable'])
    ->middleware(middleware: ['auth'])
    ->name('model.datatable');
Route::get('/model/{model}', [ModelController::class, 'columns'])
    ->where('model', '.*')
    ->middleware(middleware: ['auth'])
    ->name('model.columns');

// Route::middleware(['auth', 'lang', 'onboarded', 'app'])->group(function () {
//     if (config('app.debug')) {
//         Route::get('/status', function () {
//             return Inertia::render('Status', [
//                 'canLogin'       => Route::has('login'),
//                 'canRegister'    => Route::has('register'),
//                 'laravelVersion' => Application::VERSION,
//                 'phpVersion'     => PHP_VERSION,
//                 'statuses'       => collect(FormStatus::cases())
//                     ->map(fn (FormStatus $status) => [
//                         'name'  => $status->name,
//                         'value' => $status->value,
//                         'label' => $status->label(),
//                     ])
//                     ->values(),
//             ]);
//         });
//     }
//     Route::get('/logs/{log}', [LogController::class, 'show'])->name('logs.show');
//     // Branch Switcher
//     Route::put('/switch_branch/{id}', [BranchController::class, 'switch'])->name('branch.switch');
//     // Dashboard
//     Route::get('dashboard-view', [DashboardController::class, 'view'])->name('dashboard');
//     Route::post('dashboard-update', [DashboardController::class, 'storeUserDashboard'])->name('dashboardForms.store');
//     Route::post('dashboard-widget-order/{dashboard}', [DashboardController::class, 'reorderWidgets'])->name('dashboard.widgets.reorder');
//     Route::post('get-chart/{widget}', [WidgetController::class, 'getChartData'])->name('get-chart');
//     // Settings
//     Route::prefix('/settings')->group(function () {
//         // Dashboard
//         Route::resourceDetail('dashboard', DashboardController::class);

//         // Company
//         Route::controller(CompanyController::class)->group(function () {
//             Route::get('company', 'index')->name('companies.index');
//             Route::put('company', 'update')->name('companies.update');
//             Route::post('company/image', 'image')->name('companies.image');
//         });
//         // Branches
//         Route::resourceDetail('branch', BranchController::class);
//         Route::resourceDetail('formatingSeries', FormatingSeriesController::class);
//         Route::resourceDetail('approvalScheme', ApprovalSchemeController::class);

//         Route::resourceDetail('printTemplates', PrintTemplateController::class);
//         Route::get('/printTemplates/{printTemplates}/editor', [PrintTemplateController::class, 'editor'])->name('printTemplates.editor');
//         Route::resourceDetail('widget', WidgetController::class);
//     });
//     // Tags
//     Route::resourceDetail('tag', TagController::class);
//     // Files
//     Route::resourceDetail('file', FileController::class);
//     // Users
//     Route::get('/users/{user}/connect/{driver}/redirect', [UserController::class, 'connectToProvider'])->name('users.connect-provider');
//     Route::post('/users/{user}/image', [UserController::class, 'image'])->name('users.image');
//     Route::resourceDetail('user', UserController::class);
//     // Roles
//     Route::get('/roles/permissions', [RoleController::class, 'permissions'])->name('roles.permissions');
//     Route::resourceDetail('role', RoleController::class);
//     // Approval Instance
//     Route::get('approvals', [ApprovalInstanceController::class, 'index'])->name('approvalInstances.index');
//     Route::get('approvals/{approvalInstance}', [ApprovalInstanceController::class, 'show'])->name('approvalInstances.show');
//     Route::post('approvals/{approvalInstanceStep}/decision', [ApprovalInstanceController::class, 'decision'])->name('approvalInstances.decision');

// });

Route::get('/health', fn () => response()->json(['status' => 'ok']));
require __DIR__ . '/auth.php';
require __DIR__ . '/guest.php';
