<?php

namespace App\Models\User;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
  /** @use HasFactory<\Database\Factories\UserFactory> */
  use HasFactory, Notifiable, HasUlids, SoftDeletes;

  /**
   * The attributes that are mass assignable.
   *
   * @var list<string>
   */
  protected $fillable = [
    'name',
    'username',
    'email',
    'password',
  ];

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
  public function logs() {
    return $this->morphMany(Log::class, 'loggable');
  }
  public function tags() {
    return $this->morphToMany(Tag::class, 'taggable')
      ->whereNull('taggables.deleted_at');
  }

  public function files() {
    return $this->morphToMany(File::class, 'fileable')
      ->whereNull('fileables.deleted_at');
  }
  public function roles() {
    return $this->belongsToMany(Role::class, 'user_role', 'user_id', 'role_id');
  }
}
