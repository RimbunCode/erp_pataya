<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\FormStatus;
use App\Models\Model;
use App\Models\User\Permission;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalScheme extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_active' => 'boolean',
        'config'    => Json::class,
    ];
    protected $appends = ['status'];

    public function status(): Attribute {
        return new Attribute(
            get: fn () => $this->is_active ? FormStatus::ACTIVE : FormStatus::INACTIVE,
        );
    }

    public static function boot() {
        parent::boot();

        self::saved(function ($data) {
            if ($data->is_active) {
                ApprovalScheme::where('permission_id', $data->permission_id)
                    ->where('trigger_on', $data->trigger_on)
                    ->whereNot('id', $data->id)
                    ->update(['is_active' => false]);
            } else {
                $counter = ApprovalScheme::where('permission_id', $data->permission_id)
                    ->whereNot('id', $data->id)
                    ->count();

                if ($counter <= 0) {
                    $data->is_active = true;
                }
            }

            $data->saveQuietly();
        });
    }

    public string $translateKey = 'core.approvalScheme';
    public array $configColumns = [
        'name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'name_model' => [
            'show'  => true,
            'order' => 1,
        ],
        'status' => [
            'type'      => 'formStatus',
            'show'      => true,
            'order'     => 2,
            'dependsOn' => ['is_active'],
        ],
        'permission_id' => [
            'ignore' => true,
        ],
        'model' => [
            'ignore' => true,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return ['permission', 'steps', 'steps.approver'];
    }

    public static function templateLink() {
        return ':name';
    }

    public function permission() {
        return $this->belongsTo(Permission::class);
    }

    public function steps() {
        return $this->hasMany(ApprovalSchemeStep::class, 'approval_scheme_id');
    }
}
