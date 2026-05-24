<?php

namespace App\Http\Controllers\Core;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ApprovalDecisionRequest;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;
use ReflectionMethod;

class ApprovalInstanceController extends Controller {
    public function __construct(Request $request) {
        $this->ignorePermission = true;
        parent::__construct($request, ApprovalInstanceStep::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        $user = $request->user();
        ApprovalInstanceStep::query()
            ->whereNot('status', 'waiting')
            ->whereNot('status', 'skipped')
            ->where(function (Builder $query) use ($user) {
                $query->where(function (Builder $query) use ($user) {
                    $query->where('approver_type', 'role')
                        ->where(function (Builder $query) use ($user) {
                            $query->where(function (Builder $query) use ($user) {
                                $query->where('status', 'pending')
                                    ->whereIn('approverable_id', $user->roles->pluck('id'));
                            })->orWhere(function (Builder $query) use ($user) {
                                $query->whereIn('status', ['approved', 'rejected'])
                                    ->where('acted_by_id', $user->id);
                            });
                        });
                })
                    ->orWhere(function (Builder $query) use ($user) {
                        $query->where('approver_type', 'user')
                            ->where('approverable_id', $user->id);
                    });
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
                $query->where(function (Builder $query) use ($roleIds) {
                    $query->where('approver_type', 'role')
                        ->whereIn('approverable_id', $roleIds);
                })->orWhere(function (Builder $query) use ($user) {
                    $query->where('approver_type', 'user')
                        ->where('approverable_id', $user->id);
                })->orWhere('acted_by_id', $user->id);
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

        return app()->call("$controller@$method", $finalParams);
    }

    private function approve(ApprovalInstanceStep $approvalInstanceStep, ?string $notes = null) {
        DB::beginTransaction();
        $approval = $approvalInstanceStep->approvalInstance;

        $approvalInstanceStep->update([
            'status'      => FormStatus::APPROVED,
            'acted_at'    => now(),
            'acted_by_id' => Auth::user()->id,
            'notes'       => $notes,
        ]);

        $isApproved = false;

        $approval->current_sequence += 1;

        foreach ($approval->steps()->get() as $step) {
            if ($approval->current_sequence == $step->sequence && $step->status == FormStatus::WAITING) {
                $step->update([
                    'status' => FormStatus::PENDING,
                ]);
                $isApproved = false;

                continue;
            }
            $isApproved = match ($step->status) {
                FormStatus::PENDING, FormStatus::SKIPPED => false,
                FormStatus::APPROVED                     => true,
            };
        }

        if ($isApproved) {
            $approval->fill([
                'status' => FormStatus::APPROVED,
            ]);
            $approval->save();
            DB::commit();

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

    private function reject(ApprovalInstanceStep $approvalInstanceStep, ?string $notes = null) {
        DB::beginTransaction();
        $approval = $approvalInstanceStep->approvalInstance;

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
