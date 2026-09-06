<?php

namespace App\Http\Controllers\User;

use App\Enums\FormStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\UserRequest;
use App\Models\Core\Branch;
use App\Models\Core\File;
use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Socialite\Socialite;

class UserController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, User::class);
    }

    protected function exceptPermission(string $method) {
        $route   = Route::getCurrentRoute();
        $user_id = $route->originalParameter('user');
        if (
            \in_array($method, [
                'show',
                'update',
                'image',
                'removeImage',
                'connectToProvider',
                'addComment',
                'addTag',
                'addFile',
                'removeFile',
                'removeComment',
                'removeTag',
            ]) && $user_id == Auth::user()->id
        ) {
            return true;
        }
    }

    protected function enforcePermission($method) {
        if (\in_array($method, ['image', 'removeImage'])) {
            return ['write'];
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        if (! Utils::isInertiaRequest($request)) {
            $users = User::query();
            if ($request->has('search')) {
                $users->whereAny(['name', 'email', 'username'], 'like', "%{$request->search}%");
            }

            return response()->json($users->get());
        }
        $this->setBreadcrumbs();
        // dd(json_decode(stripslashes($_COOKIE['datatable_columns'])));
        User::dataTable($request);

        return Inertia::render('Users/ManageUsers/Index');
    }

    public function image(Request $request, User $user) {
        DB::beginTransaction();
        File::uploadFile($request, 'ImageProfile', function ($file) use ($user) {
            $user->update([
                'image' => $file->id,
            ]);
        });
        DB::commit();

        return back();
    }

    public function removeImage(User $user) {
        $user->update(['image' => null]);

        return back();
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Users/ManageUsers/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        try {
            $user = User::create([
                'name'              => $data['name'],
                'email'             => $data['email'],
                'status'            => FormStatus::INVITED,
                'default_branch_id' => $data['default_branch_id'] ?? null,
            ]);
            if (! empty($data['roles'])) {
                $user->roles()->sync($data['roles']);
            }
            if (! empty($data['branches'])) {
                $user->branches()->sync($data['branches']);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('users.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, User $user) {
        $permissionChecker = PermissionChecker::forUser($request);
        $canSelect         = $permissionChecker->can(User::class, Permission::Select);
        if ($canSelect) {
            $this->setBreadcrumbs($user);
        } else {
            Inertia::share(['breadcrumbs' => [['name' => 'user.user.my_profile']]]);
        }
        $user->showDetail();

        $canManageRoles    = $permissionChecker->canAction(User::class, 'manage_roles');
        $canManageBranches = $permissionChecker->canAction(User::class, 'manage_branches');

        return Inertia::render('Users/ManageUsers/Show', [
            'user' => function () use ($user, $canManageRoles, $canManageBranches) {
                if ($canManageRoles) {
                    $user->roles = $user->roles()->pluck('id');
                }
                if ($canManageBranches) {
                    $user->branches = $user->branches()->pluck('id');
                }

                return $user;
            },
            ...($canManageRoles ? [
                'roles' => Inertia::defer(Role::with(['rules', 'rules.permission'])->get(...)),
            ] : []),
            ...($canManageBranches ? [
                'branches' => Inertia::defer(Branch::whereNull('branchable_type')->whereNull('branchable_id')->get(...)),
            ] : []),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, User $user) {
        $data              = $request->validated();
        $permissionChecker = PermissionChecker::forUser($request);
        DB::beginTransaction();
        if ($user->id != $request->user()->id) {
            $data['status'] = \in_array($user->status, [FormStatus::ACTIVE, FormStatus::INACTIVE]) ? $user->status : FormStatus::ACTIVE;
        }
        if ($permissionChecker->canAction(User::class, 'manage_roles')) {
            $user->roles()->sync($data['roles'] ?? []);
        }
        if ($permissionChecker->canAction(User::class, 'manage_branches')) {
            $user->branches()->sync($data['branches'] ?? []);
        }
        $user->fillForUpdate($data);
        DB::commit();

        return back();
    }

    public function connectToProvider(User $user, string $driver) {
        return Socialite::driver($driver)
            ->redirect();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(mixed $id) {
        $user = User::findOrFail($id);
        request()->validate([
            'password' => ['required', 'current_password'],
        ]);
        DB::beginTransaction();
        try {
            $user->delete();
            $user->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        if (request()->user()->id == $user->id) {
            Auth::logout();

            request()->session()->invalidate();
            request()->session()->regenerateToken();

            return redirect()->to('/');
        } else {
            return redirect()->route('users.index');
        }
    }
}
