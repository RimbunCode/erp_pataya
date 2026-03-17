<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\FormStatus;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class ApprovalInstance extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'status'  => FormStatusCast::class,
        'options' => Json::class,
    ];
    protected $with             = ['steps', 'document'];
    public string $translateKey = 'core.approvalInstance';
    public $configColumns       = [
        'document' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
    ];

    public static function templateLink() {
        return ':document';
    }

    public function approvalScheme() {
        return $this->belongsTo(ApprovalScheme::class);
    }

    public function document() {
        return $this->morphTo('document', 'document_type', 'document_id');
    }

    public function steps() {
        return $this->hasMany(ApprovalInstanceStep::class, 'approval_instance_id');
    }

    public function currentStep() {
        return $this->hasOne(ApprovalInstanceStep::class, 'approval_instance_id')->where('sequence', $this->current_sequence);
    }

    public static function makeInstance(Model $data, array $options = []) {
        DB::beginTransaction();
        $model  = \get_class($data);
        $scheme = ApprovalScheme::where('model', $model)
            ->where('is_active', true)
            ->first();

        if (! $scheme) {
            return null;
        }
        $steps    = $scheme->steps;
        $instance = static::firstOrCreate([
            'approval_scheme_id' => $scheme->id,
            'document_type'      => $model,
            'document_id'        => $data->id,
        ], [
            'options' => $options,
            'status'  => $steps->count() > 0 ? FormStatus::PENDING : FormStatus::APPROVED,
        ]);

        foreach ($steps as $step) {
            $instance->steps()->create([
                'sequence'          => $step->sequence,
                'approver_type'     => $step->approver_type,
                'approverable_type' => $step->approverable_type,
                'approverable_id'   => $step->approverable_id,
                'status'            => $step->sequence > 0 ? FormStatus::WAITING : FormStatus::PENDING,
            ]);
        }
        DB::commit();

        return $instance;
    }
}
