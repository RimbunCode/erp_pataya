<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\BranchRequest;
use App\Models\Core\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class BranchController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Branch::class);
    }

    protected function exceptPermission(string $method) {
        if ($method == 'switch') {
            return true;
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Branch::whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->dataTable($request);

        return Inertia::render('Settings/Branches/Index');
    }

    public function switch(Request $request, string $id) {
        $request->session()->forget('currentBranch');
        $request->session()->put('currentBranch', $id);

        return back();
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Branches/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(BranchRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        if (isset($data['shipping_country'])) {
            $data['shipping_country_id'] = $data['shipping_country']['code'];
        }
        if (isset($data['billing_country'])) {
            $data['billing_country_id'] = $data['billing_country']['code'];
        }
        $branch = Branch::create($data);
        $branch->logForCreated();
        DB::commit();

        return back()->with('id', $branch->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Branch $branch) {
        if ($branch->branchable_type) {
            abort(404);
        }
        $this->setBreadcrumbs($branch);
        $branch->showDetail();

        return Inertia::render('Settings/Branches/Show', [
            'branch' => function () use ($branch) {
                $branch->loadRelations();

                return $branch;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(BranchRequest $request, Branch $branch) {
        if ($branch->branchable_type) {
            abort(404);
        }
        $data = $request->validated();
        DB::beginTransaction();
        if (isset($data['shipping_country'])) {
            $data['shipping_country_id'] = $data['shipping_country']['code'];
        }
        if (isset($data['billing_country'])) {
            $data['billing_country_id'] = $data['billing_country']['code'];
        }
        $branch->fillForUpdate($data);
        $branch->logForUpdated();
        DB::commit();

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Branch $branch) {
        if ($branch->is_main_branch) {
            abort(403);
        }
        DB::beginTransaction();
        $branch->delete();
        $branch->logForDeleted();
        DB::commit();

        return redirect()->route('branches.index');
    }
}
