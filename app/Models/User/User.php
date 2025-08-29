<?php

namespace App\Models\User;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Models\Core\Branch;
use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Traits\DataTable;
use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
  /** @use HasFactory<\Database\Factories\UserFactory> */
  use HasFactory, Notifiable, HasUlids, SoftDeletes, DataTable, LinkModel;

  protected $guarded = ['id'];

  /**
   * The attributes that should be hidden for serialization.
   *
   * @var list<string>
   */
  protected $hidden = [
    'password',
    'remember_token',
  ];

  /**
   * Get the attributes that should be cast.
   *
   * @return array<string, string>
   */
  protected function casts(): array {
    return [
      'email_verified_at' => 'datetime',
      'password' => 'hashed',
    ];
  }

  protected $appends = [
    'templateLink'
  ];
  protected function getTemplateLinkAttribute() {
    return ":name";
  }

  public static function templateLink() {
    return ":name";
  }

  public function roles() {
    return $this->belongsToMany(Role::class, 'user_role', 'user_id', 'role_id');
  }

  public function branches() {
    return $this->belongsToMany(Branch::class, 'user_branch', 'user_id', 'branch_id');
  }
}
