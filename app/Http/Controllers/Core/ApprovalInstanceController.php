<?php

namespace App\Http\Controllers\Core;

use App\Enums\FormStatus;
use App\Events\Core\ApprovalDecided;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ApprovalDecisionRequest;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model;
use App\Services\Core\Approval\ApprovalAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

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
        abort_unless(app(ApprovalAccessService::class)->canAccessInstance($request->user(), $approvalInstance), 403);

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

    /**
     * Kunci baris instance lalu step di dalam transaksi yang sedang berjalan, kemudian validasi
     * ulang hak memutuskan pada state TERKUNCI.
     *
     * Guard di decision() memakai model hasil route-binding sebelum transaksi, jadi dua keputusan
     * bersamaan pada step yang sama sama-sama lolos. Tanpa re-check ini yang kalah menimpa
     * acted_by, mengirim ApprovalDecided dua kali, dan pada step final dapat menjalankan
     * onApproved()/onRejected() dua kali. Instance dikunci lebih dulu agar urutan kunci selalu
     * sama (instance -> step) dan keputusan pada instance yang sama diserialkan.
     *
     * @return ApprovalInstanceStep|null step segar yang terkunci, atau null bila sudah tak bisa diputuskan
     */
    private function lockDecidableStep(ApprovalInstanceStep $step): ?ApprovalInstanceStep {
        DB::table('approval_instances')->where('id', $step->approval_instance_id)->lockForUpdate()->value('id');

        $locked = ApprovalInstanceStep::query()->whereKey($step->getKey())->lockForUpdate()->first();

        return $locked?->canBeDecidedBy(Auth::user()) ? $locked : null;
    }

    private function unavailableResponse() {
        return back()->with('alert', [
            'message' => __('core/form.approvalDecision.unavailable'),
        ]);
    }

    private function approve(ApprovalInstanceStep $approvalInstanceStep, ?string $notes = null) {
        DB::beginTransaction();
        $approvalInstanceStep = $this->lockDecidableStep($approvalInstanceStep);
        if ($approvalInstanceStep === null) {
            DB::rollBack();

            return $this->unavailableResponse();
        }
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

            // SKIPPED (auto-approve partial) tidak menghalangi final approval.
            if (! \in_array($step->status, [FormStatus::APPROVED, FormStatus::SKIPPED], true)) {
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

            event(new ApprovalDecided($approval, 'approved'));

            if ($serviceClass) {
                return $this->asInertiaResponse(app($serviceClass)->onApproved($document));
            }

            return back();
        }
        $approval->save();
        DB::commit();

        event(new ApprovalDecided($approval, 'approved', $nextPending));

        return back();
    }

    /**
     * onApproved()/onRejected() Service mengembalikan model/null, bukan response. Permintaan
     * Inertia wajib dijawab redirect/response valid, kalau tidak klien menampilkan modal error
     * walau keputusan sudah tersimpan (dan klik ulang berakhir 403).
     */
    private function asInertiaResponse(mixed $result): mixed {
        return $result instanceof SymfonyResponse ? $result : back();
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
        $approvalInstanceStep = $this->lockDecidableStep($approvalInstanceStep);
        if ($approvalInstanceStep === null) {
            DB::rollBack();

            return $this->unavailableResponse();
        }
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

            event(new ApprovalDecided($approval, 'rejected', notes: $notes));

            if ($serviceClass) {
                return $this->asInertiaResponse(app($serviceClass)->onRejected($document));
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

        if (! $approvalInstanceStep->canBeDecidedBy($request->user())) {
            // Bukan kandidat sama sekali: tolak. Kandidat yang mengklik ulang / membuka halaman
            // basi (step sudah diputuskan, dibatalkan, atau belum gilirannya) cukup diberi tahu.
            abort_unless($approvalInstanceStep->isCandidate($request->user()), 403);

            return $this->unavailableResponse();
        }

        return $this->$decision($approvalInstanceStep, $data['notes'] ?? null);
    }
}
