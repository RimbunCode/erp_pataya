<?php

namespace App\Models\User;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;

class RolePermission extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'permissions'   => Json::class,
        'is_submitable' => 'boolean',
        'only_creator'  => 'boolean',
    ];
    protected $appends = ['permissionKeys'];

    protected static function loadRelationsOnShow() {
        return [
            'permission',
            'role',
        ];
    }

    public function getPermissionKeysAttribute() {
        if ($this->level > 0) {
            return ['read', 'write'];
        }

        $permissionKeys = $this->permission?->permissions ?? \array_keys((array) $this->permissions);
        if ($this->only_creator) {
            return \array_values(\array_filter($permissionKeys, fn ($k) => $k !== 'create'));
        }

        return $permissionKeys;
    }

    public function permission() {
        return $this->belongsTo(Permission::class);
    }

    public function role() {
        return $this->belongsTo(Role::class);
    }

    public static function getPermissions(string $model) {
        $rolePermissions = RolePermission::select('role_permissions.permissions', 'role_permissions.level', 'role_permissions.only_creator')
            ->join('roles', 'roles.id', '=', 'role_permissions.role_id')
            ->join('user_role', 'user_role.role_id', '=', 'roles.id')
            ->where('user_role.user_id', Auth::user()->id)
            ->where('model', $model);
        $result = [];

        foreach ($rolePermissions->get()->toArray() as $item) {
            foreach ($item['permissions'] as $key => $value) {
                $isReadWrite = $key === 'read' || $key === 'write';

                // CASE: read/write dengan level <= 0
                if ($isReadWrite && $item['level'] <= 0) {
                    $result[$key][0] ??= [false, false];
                    $ref = &$result[$key][0];

                    $idx       = $item['only_creator'] ? 1 : 0;
                    $ref[$idx] = $ref[$idx] || $value;

                    unset($ref);

                    continue;
                }

                // CASE: read/write dengan level > 0
                if ($isReadWrite) {
                    $result[$key][$item['level']] = ($result[$key][$item['level']] ?? false) || $value;

                    continue;
                }

                // CASE: key lain
                $result[$key] ??= [false, false];
                $ref = &$result[$key];

                $idx       = $item['only_creator'] ? 1 : 0;
                $ref[$idx] = $ref[$idx] || $value;

                unset($ref);
            }
        }

        return $result;
    }
}
