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

class ApprovalSchemeController extends Controller
{
    public function __construct(Request $request)
    {
        parent::__construct($request, ApprovalScheme::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();

        ApprovalScheme::dataTable($request);

        return Inertia::render('Settings/ApprovalScheme/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    private function fillStepRelation(array $step, int $index)
    {
        $step['approverable_type'] = $step['approver_type'] == 'role' ? Role::class : User::class;
        $step['approverable_id'] = $step['approver']['id'];
        $step['sequence'] = $index;

        return $step;
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(ApprovalSchemeRequest $request)
    {
        $data = $request->validated();

        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model'] = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model'] = isset($data['permission']) ? $data['permission']['name'] : null;

        $approvalScheme = ApprovalScheme::create($data);
        foreach ($data['steps'] as $index => $step) {
            $approvalScheme->steps()->create($this->fillStepRelation($step, $index));
        }
        $approvalScheme->logForCreated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Display the specified resource.
     */
    public function show(ApprovalScheme $approvalScheme)
    {
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
    public function edit(ApprovalScheme $approvalScheme)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ApprovalSchemeRequest $request, ApprovalScheme $approvalScheme)
    {
        $data = $request->validated();

        DB::beginTransaction();
        $data['permission_id'] = isset($data['permission']) ? $data['permission']['id'] : null;
        $data['model'] = isset($data['permission']) ? $data['permission']['model'] : null;
        $data['name_model'] = isset($data['permission']) ? $data['permission']['name'] : null;

        $approvalScheme->fillForUpdate($data);
        $approvalScheme->steps()
            ->whereNotIn('id', array_column($data['steps'], 'id'))
            ->delete();
        foreach ($data['steps'] as $index => $step) {
            $step = $this->fillStepRelation($step, $index);
            if (Ulid::isValid($step['id'])) {
                $approvalScheme->steps()
                    ->find($step['id'])
                    ->update($step);

                continue;
            }
            $approvalScheme->steps()->create($step);
        }
        $approvalScheme->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ApprovalScheme $approvalScheme) {}
}
