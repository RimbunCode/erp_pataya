<?php

namespace App\Http\Controllers\Core;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ApprovalDecisionRequest;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Core\PrintTemplate;
use App\Models\Model;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;
use ReflectionMethod;
use Throwable;

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

        $roleIds = $user->roles()->pluck('roles.id');

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

    public function checkApproval(Model $data, array $options = [], string $triggerOn = 'submit') {
        return DB::transaction(function () use ($data, $options, $triggerOn) {
            $currentRoute     = Route::getCurrentRoute();
            $controller       = $currentRoute->getControllerClass();
            $parameters       = $currentRoute->originalParameters();
            $instanceApproval = ApprovalInstance::makeInstance($data, [
                'controller' => $controller,
                'parameters' => $parameters,
                'options'    => $options,
            ], $triggerOn);

            if (! $instanceApproval || $instanceApproval->status == FormStatus::APPROVED) {
                $result = app()->call(\implode([$controller, '@', 'onApproved']), [
                    ...$currentRoute->parameters(),
                ]);
            } elseif ($instanceApproval->status == FormStatus::REJECTED) {
                $result = app()->call(\implode([$controller, '@', 'onRejected']), [
                    ...$currentRoute->parameters(),
                ]);
            } else {
                $data->update([
                    'status' => FormStatus::NEED_APPROVAL,
                ]);
            }

            $data->logForSubmitted();

            DB::commit();

            return $result ?? null;
        });
    }

    private function callWithRouteModels(string $controller, string $method, array $rawParams) {
        $ref         = new ReflectionMethod($controller, $method);
        $finalParams = [];

        foreach ($ref->getParameters() as $param) {
            $name = $param->getName();
            $type = $param->getType();

            if ($type && ! $type->isBuiltin()) {
                $className = $type->getName();

                // Kalau type-nya turunan Model dan ada ID-nya di $rawParams
                if (is_subclass_of($className, Model::class) && isset($rawParams[$name])) {
                    $finalParams[$name] = $className::findOrFail($rawParams[$name]);

                    continue;
                }
            }

            // fallback: pakai value apa adanya
            if (array_key_exists($name, $rawParams)) {
                $finalParams[$name] = $rawParams[$name];
            }
        }

        request()->attributes->set('isApprovalCallback', true);

        try {
            return app()->call("$controller@$method", $finalParams);
        } finally {
            request()->attributes->remove('isApprovalCallback');
        }
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

        $isApproved = true;

        $approval->current_sequence += 1;

        foreach ($approval->steps()->orderBy('sequence')->get() as $step) {
            if ($approval->current_sequence == $step->sequence && $step->status == FormStatus::WAITING) {
                $step->update([
                    'status' => FormStatus::PENDING,
                ]);
                $isApproved = false;

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

            // Attachment is a side effect of a decision that already
            // committed above — a failure here must never look like the
            // approval itself failed, so it is isolated in its own
            // try-catch and logged rather than propagated.
            $this->attachGeneratedPdf($approval);

            return $this->callWithRouteModels(
                (string) ($approval->options['controller'] ?? ''),
                'onApproved',
                $approval->options['parameters'] ?? [],
            );
        }
        $approval->save();
        DB::commit();

        return back();
    }

    /**
     * Render the approved document's default print template to HTML
     * server-side, convert it to PDF, and attach it to the document —
     * called after the approval transaction has already committed, so a
     * failure here (missing template, render error, PDF engine failure)
     * only prevents the attachment, never the approval itself.
     */
    private function attachGeneratedPdf(ApprovalInstance $approval): void {
        try {
            $controller = (string) ($approval->options['controller'] ?? '');
            $document   = $this->resolveDocumentModel($controller, $approval->options['parameters'] ?? []);

            if ($document === null) {
                return;
            }

            $template = PrintTemplate::where('model', $document::class)
                ->where('is_default', true)
                ->first();

            if ($template === null) {
                Log::info('PDF auto-attach skipped: no default PrintTemplate configured', [
                    'model'       => $document::class,
                    'document_id' => $document->getKey(),
                ]);

                return;
            }

            $columns = $template->columns;
            $html    = app(PrintTemplateRenderService::class)->render($document, $template, $columns);
            $pdf     = app(PdfExportService::class)->generate($html, $template);

            app(PdfAttachmentService::class)->attach($pdf, $document);
        } catch (Throwable $e) {
            Log::error('PDF auto-attach failed after approval', [
                'approval_instance_id' => $approval->id,
                'error'                => $e->getMessage(),
            ]);
        }
    }

    /**
     * Resolve the document model instance the approval was created for,
     * using the same route-model resolution as callWithRouteModels():
     * inspect the target controller's `onApproved` method signature and
     * find the first typed parameter that is a Model subclass present in
     * the stored route parameters.
     *
     * @param  array<string, mixed>  $rawParams
     */
    private function resolveDocumentModel(string $controller, array $rawParams): ?Model {
        if ($controller === '' || ! method_exists($controller, 'onApproved')) {
            return null;
        }

        $ref = new ReflectionMethod($controller, 'onApproved');

        foreach ($ref->getParameters() as $param) {
            $type = $param->getType();
            if (! $type || $type->isBuiltin()) {
                continue;
            }

            $className = $type->getName();
            if (! is_subclass_of($className, Model::class)) {
                continue;
            }

            $name = $param->getName();
            if (isset($rawParams[$name])) {
                return $className::find($rawParams[$name]);
            }
        }

        return null;
    }

    private function recordApproverChildDecision(ApprovalInstanceStep $step, FormStatus $status): void {
        $user    = Auth::user();
        $roleIds = $user->roles()->pluck('roles.id');

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

            return $this->callWithRouteModels(
                (string) ($approval->options['controller'] ?? ''),
                'onRejected',
                $approval->options['parameters'] ?? [],
            );
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
