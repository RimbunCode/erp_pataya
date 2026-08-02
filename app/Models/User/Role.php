<?php

namespace App\Models\User;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Role extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public string $formComponent = 'Users/Roles/Form';
    protected $guarded           = ['id'];
    protected $casts             = [
        'is_disabled' => 'boolean',
    ];
    protected array $configColumns = [
        'name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'description' => [
            'show'  => true,
            'order' => 1,
        ],
        'is_disabled' => [
            'show'  => true,
            'order' => 2,
        ],
    ];
    public $translateKey = 'user.role';

    public static function templateLink() {
        return ':name';
    }

    protected static function loadRelationsOnShow() {
        return ['rules', 'rules.permission'];
    }

    public function users() {
        return $this->belongsToMany(User::class, 'user_roles', 'role_id', 'user_id');
    }

    public function rules() {
        return $this->hasMany(RolePermission::class)->orderBy('name')->orderBy('level');
    }
}
