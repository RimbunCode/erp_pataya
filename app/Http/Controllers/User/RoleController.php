<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\RoleRequest;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

class RoleController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Role::class);
    }

    public function enforcePermission(string $method) {
        if ($method == 'permissions') {
            return true;
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Role::dataTable($request);

        return Inertia::render('Users/Roles/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs('__(user.role.new)');

        return Inertia::render('Users/Roles/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RoleRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $role = Role::create([
            'name'        => $data['name'],
            'description' => $data['description'] ?? '',
            'is_disabled' => $data['is_disabled'] ?? '',
        ]);

        $this->updatePermissions($role, $data['rules']);
        $role->logForCreated();

        DB::commit();

        return redirect()->route('roles.show', $role);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Role $role) {
        if (! $this->isInertiaRequest($request)) {
            $role->loadRelations();

            return response()->json($role);
        }

        $this->setBreadcrumbs($role);
        $role->showDetail();

        return Inertia::render('Users/Roles/Show', [
            'role' => function () use ($role) {
                $role->loadRelations();

                return $role;
            },
        ]);
    }

    public function permissions(Request $request) {
        if ($this->isInertiaRequest($request)) {
            abort(404);
        }
        $ids   = $request->ids;
        $roles = RolePermission::select('role_permissions.model', 'role_permissions.name', 'role_permissions.permissions', 'role_permissions.level', 'role_permissions.only_creator')
            ->whereIn('role_permissions.role_id', $ids)
            ->get()
            ->groupBy([
                'model',
                'level',
                fn ($permission) => $permission->only_creator ? 'true' : 'false',
            ])
            ->map(fn ($levels) => $levels->map(fn ($onlyCreators) => $onlyCreators->map(function ($permissions) {
                $dataPermissions = [];
                foreach ($permissions as $permission) {
                    foreach ($permission->permissions as $key => $value) {
                        $dataPermissions[$key] = ($dataPermissions[$key] ?? false) || $value;
                    }
                }

                $masterData = $permissions->first();

                return [
                    'name'         => $masterData->name,
                    'model'        => $masterData->model,
                    'level'        => $masterData->level,
                    'only_creator' => $masterData->only_creator,
                    'permissions'  => $dataPermissions,
                ];
            })))
            ->flatten(2);

        return response()->json(['rules' => $roles]);
    }

    private function updatePermissions(Role &$role, array $rules) {
        $permissions = array_map(fn ($permission) => $permission['permission_id'], $rules);
        $permissions = Permission::whereIn('id', $permissions)->get()
            ->mapWithKeys(fn ($permission) => [$permission->id => $permission]);
        $ruleIds = collect($rules)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingRules = $role->rules()
            ->whereIn('id', $ruleIds)
            ->get()
            ->keyBy('id');

        $role->rules()
            ->whereNotIn('id', array_column($rules, 'id'))
            ->delete();
        foreach ($rules as $rule) {
            $permission = $permissions[$rule['permission_id']];
            $payload    = [
                'name'          => $permission->name,
                'module'        => $permission->module,
                'model'         => $permission->model,
                'is_submitable' => $permission->is_submitable,
                'permissions'   => collect($rule['level'] > 0 ? ['read', 'write'] : $permission->permissions)
                    ->mapWithKeys(fn ($permission) => [$permission => $rule['permissions'][$permission] ?? false]),
            ];
            if (Ulid::isValid($rule['id'])) {
                $existingRules->get($rule['id'])?->update($payload);
            } else {
                $role->rules()->create([
                    'role_id'       => $role->id,
                    'permission_id' => $permission->id,
                    'level'         => $rule['level'],
                    'only_creator'  => $rule['only_creator'],
                    ...$payload,
                ]);
            }
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(RoleRequest $request, Role $role) {
        $data = $request->validated();
        DB::beginTransaction();
        $role->fillForUpdate([
            'name'        => $data['name'],
            'description' => $data['description'] ?? '',
            'is_disabled' => $data['is_disabled'] ?? '',
        ]);

        $this->updatePermissions($role, $data['rules']);
        $role->logForUpdated();

        DB::commit();

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id) {
        //
    }
}
