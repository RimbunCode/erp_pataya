<?php

namespace App\Http\Controllers\Core;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ApprovalDecisionRequest;
use App\Jobs\Core\AttachGeneratedPdfJob;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model;
use App\Notifications\ApprovalDecidedNotification;
use App\Notifications\ApprovalPendingNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ApprovalInstanceController extends Controller {
    public function __construct(Request $request) {
        $this->ignorePermission = true;
        parent::__construct($request, ApprovalInstanceStep::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        $user    = $request->user();
        $roleIds = $user->roles->pluck('id');

        ApprovalInstanceStep::query()
            ->whereNot('status', 'waiting')
            ->whereNot('status', 'skipped')
            ->where(function (Builder $query) use ($user, $roleIds) {
                // single-approver: cocok langsung di kolom step
                $query->where(function (Builder $query) use ($user, $roleIds) {
                    $query->where('is_advanced', false)
                        ->where(function (Builder $query) use ($user, $roleIds) {
                            $query->where(function (Builder $query) use ($roleIds) {
                                $query->where('approver_type', 'role')
                                    ->where(function (Builder $query) use ($roleIds) {
                                        $query->where(function (Builder $query) use ($roleIds) {
                                            $query->where('status', 'pending')
                                                ->whereIn('approverable_id', $roleIds);
                                        })->orWhere(function (Builder $query) use ($roleIds) {
                                            $query->whereIn('status', ['approved', 'rejected'])
                                                ->whereIn('approverable_id', $roleIds);
                                        });
                                    });
                            })->orWhere(function (Builder $query) use ($user) {
                                $query->where('approver_type', 'user')
                                    ->where('approverable_id', $user->id);
                            });
                        });
                })
                    // multi-approver: cocok di approver anak
                    ->orWhere(function (Builder $query) use ($user, $roleIds) {
                        $query->where('is_advanced', true)
                            ->whereHas('approvers', function (Builder $q) use ($user, $roleIds) {
                                $q->where(function (Builder $q) use ($user) {
                                    $q->where('approver_type', 'user')->where('approverable_id', $user->id);
                                })->orWhere(function (Builder $q) use ($roleIds) {
                                    $q->where('approver_type', 'role')->whereIn('approverable_id', $roleIds);
                                });
                            });
                    })
                    // histori: sudah acted_by user ini
                    ->orWhere('acted_by_id', $user->id);
            })
            ->dataTable($request);

        return Inertia::render('Core/ApprovalInstanceIndex');
    }

    public function show(Request $request, ApprovalInstance $approvalInstance) {
        abort_unless($this->canAccessApprovalInstance($request, $approvalInstance), 403);

        $document = $approvalInstance->document;
        abort_if(! $document, 404);

        $routeName  = "{$document->route}.show";
        $routeParam = $this->resolveRouteParameter($routeName, $document);
        $targetUrl  = URL::signedRoute($routeName, [
            $routeParam => $document->id,
            'u'         => $request->user()->id,
        ]);

        return redirect()->to($targetUrl);
    }

    private function resolveRouteParameter(string $routeName, Model $document): string {
        $route = Route::getRoutes()->getByName($routeName);

        return $route?->parameterNames()[0] ?? Str::camel(class_basename($document));
    }

    private function canAccessApprovalInstance(Request $request, ApprovalInstance $approvalInstance): bool {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        $roleIds = $user->roles->pluck('id');

        return $approvalInstance->steps()
            ->where(function (Builder $query) use ($user, $roleIds) {
                // single-approver
                $query->where(function (Builder $query) use ($user, $roleIds) {
                    $query->where('is_advanced', false)
                        ->where(function (Builder $query) use ($user, $roleIds) {
                            $query->where(function (Builder $query) use ($roleIds) {
                                $query->where('approver_type', 'role')
                                    ->whereIn('approverable_id', $roleIds);
                            })->orWhere(function (Builder $query) use ($user) {
                                $query->where('approver_type', 'user')
                                    ->where('approverable_id', $user->id);
                            });
                        });
                })
                    // multi-approver: ada sebagai approver anak
                    ->orWhere(function (Builder $query) use ($user, $roleIds) {
                        $query->where('is_advanced', true)
                            ->whereHas('approvers', function (Builder $q) use ($user, $roleIds) {
                                $q->where(function ($q) use ($user) {
                                    $q->where('approver_type', 'user')->where('approverable_id', $user->id);
                                })->orWhere(function ($q) use ($roleIds) {
                                    $q->where('approver_type', 'role')->whereIn('approverable_id', $roleIds);
                                });
                            });
                    })
                    ->orWhere('acted_by_id', $user->id);
            })
            ->exists();
    }

    private function approve(ApprovalInstanceStep $approvalInstanceStep, ?string $notes = null) {
        DB::beginTransaction();
        $approval = $approvalInstanceStep->approvalInstance;

        if ($approvalInstanceStep->is_advanced) {
            $this->recordApproverChildDecision($approvalInstanceStep, FormStatus::APPROVED);
        }

        $approvalInstanceStep->update([
            'status'      => FormStatus::APPROVED,
            'acted_at'    => now(),
            'acted_by_id' => Auth::user()->id,
            'notes'       => $notes,
        ]);

        $isApproved  = true;
        $nextPending = null;

        $approval->current_sequence += 1;

        foreach ($approval->steps()->orderBy('sequence')->get() as $step) {
            if ($approval->current_sequence == $step->sequence && $step->status == FormStatus::WAITING) {
                $step->update([
                    'status' => FormStatus::PENDING,
                ]);
                $isApproved  = false;
                $nextPending = $step;

                continue;
            }

            if ($step->status !== FormStatus::APPROVED) {
                $isApproved = false;
            }
        }

        if ($isApproved) {
            $approval->fill([
                'status' => FormStatus::APPROVED,
            ]);
            $approval->save();
            DB::commit();

            $document     = $approval->document;
            $serviceClass = $document::$service ?? null;

            AttachGeneratedPdfJob::dispatch($approval);

            $creator = $document?->createdBy;
            if ($creator) {
                app(NotifyUser::class)->send($creator, new ApprovalDecidedNotification($approval, 'approved'));
            }

            if ($serviceClass) {
                return app($serviceClass)->onApproved($document);
            }

            return back();
        }
        $approval->save();
        DB::commit();

        if ($nextPending) {
            $candidates = $nextPending->resolveCandidateUsers();
            if ($candidates->isNotEmpty()) {
                app(NotifyUser::class)->send($candidates, new ApprovalPendingNotification($nextPending));
            }
        }

        return back();
    }

    private function recordApproverChildDecision(ApprovalInstanceStep $step, FormStatus $status): void {
        $user    = Auth::user();
        $roleIds = $user->roles->pluck('id');

        $matched = $step->approvers()
            ->where(function ($q) use ($user, $roleIds) {
                $q->where(function ($q) use ($user) {
                    $q->where('approver_type', 'user')->where('approverable_id', $user->id);
                })->orWhere(function ($q) use ($roleIds) {
                    $q->where('approver_type', 'role')->whereIn('approverable_id', $roleIds);
                });
            })
            ->where('status', FormStatus::PENDING->value)
            ->first();

        if ($matched) {
            $matched->update([
                'status'      => $status,
                'acted_by_id' => $user->id,
                'acted_at'    => now(),
            ]);
        }

        $step->approvers()->where('status', FormStatus::PENDING->value)->update(['status' => FormStatus::SKIPPED->value]);
    }

    private function reject(ApprovalInstanceStep $approvalInstanceStep, ?string $notes = null) {
        DB::beginTransaction();
        $approval = $approvalInstanceStep->approvalInstance;

        if ($approvalInstanceStep->is_advanced) {
            $this->recordApproverChildDecision($approvalInstanceStep, FormStatus::REJECTED);
        }

        $approvalInstanceStep->update([
            'status'      => FormStatus::REJECTED,
            'acted_at'    => now(),
            'acted_by_id' => Auth::user()->id,
            'notes'       => $notes,
        ]);

        $isRejected = false;
        $approval->current_sequence += 1;
        foreach ($approval->steps()->get() as $step) {
            if ($isRejected) {
                $step->update([
                    'status' => FormStatus::SKIPPED,
                ]);
                $approval->current_sequence += 1;
            }
            if ($step->status == FormStatus::REJECTED) {
                $isRejected = true;
            }
        }

        if ($isRejected) {
            $approval->fill([
                'status' => FormStatus::REJECTED,
            ]);
            $approval->save();
            DB::commit();

            $document     = $approval->document;
            $serviceClass = $document::$service ?? null;

            $creator = $document?->createdBy;
            if ($creator) {
                app(NotifyUser::class)->send($creator, new ApprovalDecidedNotification($approval, 'rejected', $notes));
            }

            if ($serviceClass) {
                return app($serviceClass)->onRejected($document);
            }

            return back();
        }
        $approval->save();
        DB::commit();

        return back();
    }

    public function decision(ApprovalDecisionRequest $request, ApprovalInstanceStep $approvalInstanceStep) {
        $data     = $request->validated();
        $decision = $data['decision'];

        return $this->$decision($approvalInstanceStep, $data['notes'] ?? null);
    }
}
