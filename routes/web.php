<?php
use App\FormStatus;
use App\Http\Controllers\Core\ApprovalInstanceController;
use App\Http\Controllers\Core\ApprovalSchemeController;
use App\Http\Controllers\Core\BranchController;
use App\Http\Controllers\Core\CompanyController;
use App\Http\Controllers\Core\CompanyLogoController;
use App\Http\Controllers\Core\DashboardController;
use App\Http\Controllers\Core\FileController;
use App\Http\Controllers\Core\FormatingSeriesController;
use App\Http\Controllers\Core\LanguageController;
use App\Http\Controllers\Core\LogController;
use App\Http\Controllers\Core\PrintTemplateController;
use App\Http\Controllers\Core\TagController;
use App\Http\Controllers\Core\WidgetController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\MockAuthController;
use App\Http\Controllers\ModelController;
use App\Http\Controllers\Student\ProfileController as StudentProfileController;
use App\Http\Controllers\Instructor\ProfileController as InstructorProfileController;
use App\Http\Controllers\User\RoleController;
use App\Http\Controllers\User\UserController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

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
    return redirect('/guest');
});

Route::middleware(['auth'])->group(function () {
    Route::prefix('/student')->group(function () {
        Route::get('/dashboard', fn () => inertia('Students/Dashboard'))->name('student.dashboard');
        Route::get('/classes', fn () => inertia('Students/StudentCourseList'))->name('student.classes');
        Route::get('/profile', [\App\Http\Controllers\Student\ProfileController::class, 'index'])->name('student.profile');
        Route::put('/profile', [\App\Http\Controllers\Student\ProfileController::class, 'update'])->name('student.profile.update');
        Route::get('/certificates', fn () => inertia('Students/Certificates'))->name('student.certificates');
        Route::get('/classEnrollment', fn () => inertia('Students/WishlistCart'))->name('student.wishlistCart');
        Route::get('/training/{id}', fn ($id) => inertia('Students/TrainingDetail', ['courseId' => $id]))->name('student.training.detail');
    });

    Route::prefix('/instructor')->group(function () {
        Route::get('/dashboard', fn () => inertia('Instructors/Dashboard'))->name('instructor.dashboard');
        Route::get('/classes', [CourseController::class, 'index'])->name('instructor.classes.index');
        Route::post('/classes', [CourseController::class, 'store'])->name('instructor.classes.store');
        Route::get('/classes/{id}', [CourseController::class, 'show'])->name('instructor.classes.show');
        Route::get('/classes/{id}/edit', [CourseController::class, 'edit'])->name('instructor.classes.edit');
        Route::put('/classes/{id}', [CourseController::class, 'update'])->name('instructor.classes.update');
        Route::patch('/classes/{id}/toggle-publish', [CourseController::class, 'togglePublish'])->name('instructor.classes.togglePublish');
        Route::get('/students', fn () => inertia('Instructors/StudentManagement'))->name('instructor.students');
        Route::get('/growth', fn () => inertia('Instructors/GrowthAnalytics'))->name('instructor.growth');
        Route::get('/financial', fn () => inertia('Instructors/Financials'))->name('instructor.financial');
        Route::get('/profile', [InstructorProfileController::class, 'index'])->name('instructor.profile');
        Route::put('/profile', [InstructorProfileController::class, 'update'])->name('instructor.profile.update');
        Route::post('/instructor/profile/avatar', [InstructorProfileController::class, 'updateAvatar'])->name('instructor.avatar.update');
    });

    Route::prefix('/organization')->group(function () {
        Route::get('/dashboard', fn () => inertia('Organizations/Dashboard'))->name('organization.dashboard');
        Route::get('/partner', fn () => inertia('Organizations/PartnerTrainers'))->name('organization.partner');
        Route::get('/profile', fn () => inertia('Organizations/ProfileSettings'))->name('organization.profile');
        Route::get('/financial', fn () => inertia('Organizations/Financials'))->name('organization.financial');
    });

    Route::get('/admin/dashboard', fn () => inertia('Admin/Dashboard'))->name('admin.dashboard');
});

Route::prefix('home')->group(function () {
    Route::get('/', fn () => inertia('Guest/Index'));
    Route::get('/training', [TrainingController::class, 'index']);
    Route::get('/training/{id}', [TrainingController::class, 'show'])->name('home.training.preview');
    Route::get('/verify', fn () => inertia('Guest/VerifyCTA/VerifyCTA'));
    Route::get('/about', fn () => inertia('Guest/AboutUs/AboutUs'));
    Route::get('/contact', fn () => inertia('Guest/Contact/ContactInfo'));
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
Route::post('/mock-login', [MockAuthController::class, 'login'])->name('mock.login');

Route::get('/health', fn () => response()->json(['status' => 'ok']));
require __DIR__ . '/auth.php';
require __DIR__ . '/guest.php';
