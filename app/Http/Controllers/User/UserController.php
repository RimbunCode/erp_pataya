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
        if ($method == 'image') {
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
    public function store(Request $request) {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, User $user) {
        $canSelect = PermissionChecker::forUser($request)->can(User::class, Permission::Select);
        if ($canSelect) {
            $this->setBreadcrumbs($user);
        } else {
            Inertia::share(['breadcrumbs' => [['name' => 'user.user.my_profile']]]);
        }
        $user->showDetail();

        return Inertia::render('Users/ManageUsers/Show', [
            'user' => function () use ($user, $request) {
                if ($request->user()->id != $user->id) {
                    $user->roles    = $user->roles()->pluck('id');
                    $user->branches = $user->branches()->pluck('id');
                }

                return $user;
            },
            ...($request->user()->id != $user->id ? [
                'roles'    => Inertia::defer(Role::with(['rules', 'rules.permission'])->get(...)),
                'branches' => Inertia::defer(Branch::whereNull('branchable_type')->whereNull('branchable_id')->get(...)),
            ] : []),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, User $user) {
        $data = $request->validated();
        DB::beginTransaction();
        if ($user->id != $request->user()->id) {
            $data['status'] = \in_array($user->status, [FormStatus::ACTIVE, FormStatus::INACTIVE]) ? $user->status : FormStatus::ACTIVE;
            $user->roles()->sync($data['roles']);
            $user->branches()->sync($data['branches']);
        }
        $user->fillForUpdate($data);
        $user->logForUpdated();
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
    public function destroy(Request $request, User $user) {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);
        DB::beginTransaction();
        $user->delete();
        $user->logForDeleted();
        DB::commit();
        if ($request->user()->id == $user->id) {
            Auth::logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->to('/');
        } else {
            return redirect()->route('users.index');
        }
    }
}
