<?php

namespace App\Models\User;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class RoleProfile extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_profile_details', 'role_profile_id', 'role_id');
    }
}
