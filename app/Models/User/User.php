<?php

namespace App\Models\User;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Casts\FormStatusCast;
use App\Models\Core\Branch;
use App\Models\Core\Dashboard;
use App\Models\Core\File;
use App\Models\Enrollment;
use App\Models\InstructorProfile;
use App\Models\Payment;
use App\Models\RoleRequest;
use App\Models\StudentProfile;
use App\Models\Submission;
use App\Models\UserProgress;
use App\Traits\DataTable;
use App\Traits\LinkModel;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
    /** @use HasFactory<UserFactory> */
    use DataTable, HasFactory, HasUlids, LinkModel, Notifiable, SoftDeletes;

    public $translateKey = 'user.user';
    protected $guarded   = ['id'];

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
            'password'          => 'hashed',
            'status'            => FormStatusCast::class,
        ];
    }

    public static function templateLink() {
        return ':name';
    }

    public $configColumns = [
        'image' => [
            'show'  => true,
            'order' => 0,
            'type'  => 'image',
            'width' => 'fit',
        ],
        'name' => [
            'show'   => true,
            'order'  => 1,
            'isLink' => true,
        ],
        'username' => [
            'show'  => true,
            'order' => 2,
        ],
        'email' => [
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'defaultBranch',
    ];

    public function payments() {
        return $this->hasMany(Payment::class);
    }

    public function enrollments() {
        return $this->hasMany(Enrollment::class);
    }

    public function progress() {
        return $this->hasMany(UserProgress::class);
    }

    public function submissions() {
        return $this->hasMany(Submission::class);
    }

    public function defaultBranch() {
        return $this->belongsTo(Branch::class, 'default_branch_id');
    }

    public function roles() {
        return $this->belongsToMany(Role::class, 'user_role', 'user_id', 'role_id');
    }

    public function idRoles() {
        return $this->belongsToMany(Role::class, 'user_role', 'user_id', 'role_id')
            ->select('roles.id');
    }

    public function branches() {
        return $this->belongsToMany(Branch::class, 'user_branch', 'user_id', 'branch_id');
    }

    public function dashboards() {
        return $this->belongsToMany(Dashboard::class, 'user_dashboards', 'user_id', 'dashboard_id')
            ->withPivot('order')
            ->orderByPivot('order');
    }

    public function providers() {
        return $this->hasMany(UserProvider::class, 'user_id');
    }

    public function roleRequests() {
        return $this->hasMany(RoleRequest::class, 'user_id');
    }

    public function reviewedRoleRequests() {
        return $this->hasMany(RoleRequest::class, 'reviewed_by');
    }

    public function adminPermissionAssignments(): HasMany {
        return $this->hasMany(AdminUserPermission::class);
    }

    public function adminPermissions(): BelongsToMany {
        return $this->belongsToMany(Permission::class, 'admin_user_permissions', 'user_id', 'permission_id')
            ->wherePivotNull('deleted_at')
            ->withTimestamps();
    }

    public function inactiveByUser() {
        return $this->belongsTo(User::class, 'inactive_by');
    }

    public function studentProfile(): HasOne {
        return $this->hasOne(StudentProfile::class);
    }

    public function instructorProfile(): HasOne {
        return $this->hasOne(InstructorProfile::class);
    }

    public function imageFile() {
        return $this->belongsTo(File::class, 'image');
    }

    public function getImageUrlAttribute() {
        if (! $this->imageFile) {
            return null;
        }

        return asset('storage/' . $this->imageFile->path);
    }
}
