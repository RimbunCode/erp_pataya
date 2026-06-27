<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ApprovalSchemeRequest;
use App\Models\Core\ApprovalScheme;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

class ApprovalSchemeController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, ApprovalScheme::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();

        ApprovalScheme::dataTable($request);

        return Inertia::render('Settings/ApprovalScheme/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/ApprovalScheme/Show');
    }

    private function fillStepRelation(array $step, int $index): array {
        $step['sequence']    = $index;
        $step['is_advanced'] = $step['is_advanced'] ?? false;

        if ($step['is_advanced']) {
            // Isi kolom morph dari approver anak pertama sebagai fallback display
            $firstApprover = $step['approvers'][0] ?? null;
            if ($firstApprover) {
                $step['approver_type']     = $firstApprover['approver_type'];
                $step['approverable_type'] = $firstApprover['approver_type'] === 'role' ? Role::class : User::class;
                $step['approverable_id']   = $firstApprover['approver']['id'];
            }
        } else {
            $step['approverable_type'] = ($step['approver_type'] ?? '') === 'role' ? Role::class : User::class;
            $step['approverable_id']   = $step['approver']['id'] ?? null;
        }

        return $step;
    }

    private function syncStepApprovers(ApprovalScheme $scheme, array $stepsData): void {
        foreach ($stepsData as $index => $stepData) {
            if (empty($stepData['is_advanced']) || empty($stepData['approvers'])) {
                continue;
            }

            $stepId = $stepData['id'] ?? null;
            $step   = Ulid::isValid((string) $stepId)
                ? $scheme->steps()->where('id', $stepId)->first()
                : $scheme->steps()->where('sequence', $index)->latest()->first();

            if (! $step) {
                continue;
            }

            $incomingIds = collect($stepData['approvers'])
                ->pluck('id')
                ->filter(fn ($id) => Ulid::isValid((string) $id))
                ->values()
                ->all();

            $step->approvers()->whereNotIn('id', $incomingIds)->delete();

            $existingApprovers = $step->approvers()->whereIn('id', $incomingIds)->get()->keyBy('id');

            foreach ($stepData['approvers'] as $approverData) {
                $type          = $approverData['approver_type'];
                $approverModel = $type === 'role' ? Role::class : User::class;
                $approverId    = $approverData['approver']['id'] ?? null;

                if (! $approverId) {
                    continue;
                }

                $payload = [
                    'approver_type'     => $type,
                    'approverable_type' => $approverModel,
                    'approverable_id'   => $approverId,
                ];

                $approverRowId = $approverData['id'] ?? null;
                if (Ulid::isValid((string) $approverRowId) && $existingApprovers->has($approverRowId)) {
                    $existingApprovers->get($approverRowId)->update($payload);
                } else {
                    $step->approvers()->create($payload);
                }
            }
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(ApprovalSchemeRequest $request) {
        $data = $request->validated();

        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $approvalScheme = ApprovalScheme::create($data);
        foreach ($data['steps'] as $index => $step) {
            $approvalScheme->steps()->create($this->fillStepRelation($step, $index));
        }
        $this->syncStepApprovers($approvalScheme, $data['steps']);
        $approvalScheme->logForCreated();
        DB::commit();

        return redirect()->back()->with('id', $approvalScheme->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(ApprovalScheme $approvalScheme) {
        $this->setBreadcrumbs($approvalScheme);
        $approvalScheme->showDetail();

        return Inertia::render('Settings/ApprovalScheme/Show', [
            'approvalScheme' => function () use ($approvalScheme) {
                $approvalScheme->loadRelations();

                return $approvalScheme;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ApprovalScheme $approvalScheme) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ApprovalSchemeRequest $request, ApprovalScheme $approvalScheme) {
        $data = $request->validated();

        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model']         = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model']    = isset($data['permission']) ? $data['permission']['name'] : null;

        $approvalScheme->fillForUpdate($data);
        $approvalScheme->steps()
            ->whereNotIn('id', array_column($data['steps'], 'id'))
            ->delete();
        $stepIds = collect($data['steps'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingSteps = $approvalScheme->steps()
            ->whereIn('id', $stepIds)
            ->get()
            ->keyBy('id');
        foreach ($data['steps'] as $index => $step) {
            $step = $this->fillStepRelation($step, $index);
            if (Ulid::isValid($step['id'])) {
                $existingSteps->get($step['id'])?->update($step);

                continue;
            }
            $approvalScheme->steps()->create($step);
        }
        $this->syncStepApprovers($approvalScheme, $data['steps']);
        $approvalScheme->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ApprovalScheme $approvalScheme) {
        DB::beginTransaction();
        $approvalScheme->delete();
        $approvalScheme->logForDeleted();
        DB::commit();

        return redirect()->route('approvalSchemes.index');
    }
}
