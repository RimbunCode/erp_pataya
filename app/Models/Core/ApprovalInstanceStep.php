<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class ApprovalInstanceStep extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'status'      => FormStatusCast::class,
        'acted_at'    => 'datetime',
        'is_advanced' => 'boolean',
        'config'      => Json::class,
    ];
    protected $with                = ['approver', 'actedBy', 'approvers'];
    public string $translateKey    = 'core.approvalInstance.steps';
    protected array $configColumns = [
        'approvalInstance' => [
            'show'            => true,
            'order'           => 0,
            'forceNavigation' => true,
        ],
        'status' => [
            'show'  => true,
            'order' => 1,
        ],
        'acted_at' => [
            'show'  => true,
            'order' => 2,
        ],
        'notes' => [
            'show'  => true,
            'order' => 3,
        ],
        'actedBy' => [
            'ignore' => true,
        ],
        'approver' => [
            'ignore' => true,
        ],
        'approver_type' => [
            'ignore' => true,
        ],
        'sequence' => [
            'ignore' => true,
        ],
    ];

    public function approvalInstance() {
        return $this->belongsTo(ApprovalInstance::class);
    }

    public static function templateLink() {
        return ':approvalInstance.document';
    }

    protected static function loadRelationsOnShow() {
        return [
            'approvalInstance',
            'approvalInstance.document',
            'approver',
            'actedBy',
        ];
    }

    public function approver() {
        return $this->morphTo('approver', 'approverable_type', 'approverable_id');
    }

    public function actedBy() {
        return $this->belongsTo(User::class, 'acted_by_id');
    }

    public function approvers() {
        return $this->hasMany(ApprovalInstanceStepApprover::class, 'approval_instance_step_id');
    }

    /**
     * Kembalikan kandidat approver step ini.
     * Jika advanced: dari tabel anak approvers.
     * Jika single: dari kolom approverable_* step itu sendiri.
     *
     * @return Collection<object{approver_type: string, approverable_id: string}>
     */
    public function approverCandidates(): Collection {
        if ($this->is_advanced) {
            return $this->approvers->map(fn ($a) => (object) [
                'approver_type'   => $a->approver_type,
                'approverable_id' => $a->approverable_id,
            ]);
        }

        return collect([(object) [
            'approver_type'   => $this->approver_type,
            'approverable_id' => $this->approverable_id,
        ]]);
    }
}
