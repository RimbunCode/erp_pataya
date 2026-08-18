<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\Enums\FormStatus;
use App\Models\Model;
use App\Models\User\User;
use App\Notifications\ApprovalPendingNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ApprovalInstance extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'status'  => FormStatusCast::class,
        'options' => Json::class,
    ];
    // protected $appends = ['signed_url'];

    // protected function getSignedUrlAttribute() {
    //     return URL::signedRoute('approvalInstances.show', [
    //         'approvalInstance' => $this->id,
    //     ]);
    // }

    protected $with                = ['steps', 'document'];
    public string $translateKey    = 'core.approvalInstance';
    protected array $configColumns = [
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

    public static function makeInstance(Model $data, array $options = [], string $triggerOn = 'submit') {
        DB::beginTransaction();
        $model  = \get_class($data);
        $scheme = ApprovalScheme::where('model', $model)
            ->where('trigger_on', $triggerOn)
            ->where('is_active', true)
            ->first();

        if (! $scheme) {
            DB::rollBack();

            return null;
        }
        $schemeSteps = $scheme->steps()->with('approvers')->get();
        $instance    = static::firstOrCreate([
            'approval_scheme_id' => $scheme->id,
            'document_type'      => $model,
            'document_id'        => $data->id,
            'trigger_on'         => $triggerOn,
        ], [
            'options' => $options,
            'status'  => $schemeSteps->count() > 0 ? FormStatus::PENDING : FormStatus::APPROVED,
        ]);

        if ($instance->wasRecentlyCreated) {
            $instanceSteps = [];
            foreach ($schemeSteps as $step) {
                $instanceStep = $instance->steps()->create([
                    'sequence'          => $step->sequence,
                    'approver_type'     => $step->approver_type,
                    'approverable_type' => $step->approverable_type,
                    'approverable_id'   => $step->approverable_id,
                    'is_advanced'       => $step->is_advanced,
                    'status'            => $step->sequence > 0 ? FormStatus::WAITING : FormStatus::PENDING,
                ]);

                if ($step->is_advanced) {
                    foreach ($step->approvers as $approver) {
                        $instanceStep->approvers()->create([
                            'approver_type'     => $approver->approver_type,
                            'approverable_type' => $approver->approverable_type,
                            'approverable_id'   => $approver->approverable_id,
                            'status'            => FormStatus::PENDING,
                        ]);
                    }
                    $instanceStep->load('approvers');
                }

                $instanceSteps[] = $instanceStep;
            }

            static::runAutoApprovePass($instance, collect($instanceSteps), $data);
        }
        DB::commit();

        if ($instance->wasRecentlyCreated) {
            $firstStep = $instance->steps()->where('sequence', 0)->first();
            if ($firstStep && $firstStep->status == FormStatus::PENDING) {
                $candidates = $firstStep->resolveCandidateUsers();
                if ($candidates->isNotEmpty()) {
                    app(NotifyUser::class)->send($candidates, new ApprovalPendingNotification($firstStep));
                }
            }
        }

        return $instance;
    }

    private static function runAutoApprovePass(self $instance, Collection $steps, Model $data): void {
        $requesterId = $data->created_by_id;
        if (! $requesterId) {
            return;
        }
        $requesterRoleIds = User::find($requesterId)?->roles()->pluck('roles.id') ?? collect();

        $stepMatchesRequester = function (ApprovalInstanceStep $step) use ($requesterId, $requesterRoleIds): bool {
            foreach ($step->approverCandidates() as $candidate) {
                if ($candidate->approver_type === 'user' && $candidate->approverable_id === $requesterId) {
                    return true;
                }
                if ($candidate->approver_type === 'role' && $requesterRoleIds->contains($candidate->approverable_id)) {
                    return true;
                }
            }

            return false;
        };

        $matchedSeq = null;
        foreach ($steps->sortBy('sequence') as $step) {
            if ($stepMatchesRequester($step)) {
                $matchedSeq = $step->sequence;
            }
        }

        if ($matchedSeq === null) {
            return;
        }

        foreach ($steps as $step) {
            if ($step->sequence < $matchedSeq) {
                $step->update(['status' => FormStatus::SKIPPED]);
            } elseif ($step->sequence === $matchedSeq) {
                $step->update([
                    'status'      => FormStatus::APPROVED,
                    'acted_by_id' => $requesterId,
                    'acted_at'    => now(),
                ]);
                if ($step->is_advanced) {
                    foreach ($step->approvers as $approver) {
                        $isMatch = ($approver->approver_type === 'user' && $approver->approverable_id === $requesterId)
                            || ($approver->approver_type === 'role' && $requesterRoleIds->contains($approver->approverable_id));

                        $approver->update([
                            'status'      => $isMatch ? FormStatus::APPROVED : FormStatus::SKIPPED,
                            'acted_by_id' => $isMatch ? $requesterId : null,
                            'acted_at'    => $isMatch ? now() : null,
                        ]);
                    }
                }
            }
        }

        $nextPending = $steps->where('sequence', '>', $matchedSeq)->sortBy('sequence')->first();
        if ($nextPending) {
            $nextPending->update(['status' => FormStatus::PENDING]);
            $instance->update(['current_sequence' => $nextPending->sequence, 'status' => FormStatus::PENDING]);
        } else {
            $instance->update(['status' => FormStatus::APPROVED]);
        }
    }
}
