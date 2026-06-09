<?php

namespace App\Http\Controllers\Helpdesk;

use App\Http\Controllers\Controller;
use App\Http\Requests\Helpdesk\TiketRequest;
use App\Http\Requests\Helpdesk\TiketResponseRequest;
use App\Models\Helpdesk\Tiket;
use App\Services\Helpdesk\TiketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TiketController extends Controller {
    private TiketService $service;

    public function __construct(Request $request, TiketService $service) {
        $this->service = $service;
        parent::__construct($request, Tiket::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'markDone', 'updateTiket' => 'write',
            default => null,
        };
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Tiket::dataTable($request);

        return Inertia::render('Helpdesk/Tikets/Index');
    }

    public function store(TiketRequest $request) {
        $data              = $request->validated();
        $data['branch_id'] = $request->session()->get('currentBranch');
        DB::beginTransaction();
        $tiket = $this->service->create($data);
        DB::commit();

        return redirect()->route('tikets.show', $tiket);
    }

    public function show(Tiket $tiket) {
        $this->setBreadcrumbs($tiket);

        return Inertia::render('Helpdesk/Tikets/Show', [
            'tiket' => function () use ($tiket) {
                $tiket->load(['assignTo', 'createdBy', 'responses.user', 'responses.assignTo']);

                return $tiket;
            },
        ]);
    }

    public function update(TiketRequest $request, Tiket $tiket) {
        DB::beginTransaction();
        $this->service->update($tiket, $request->validated());
        DB::commit();

        return back();
    }

    public function destroy(Tiket $tiket) {
        DB::beginTransaction();
        $tiket->delete();
        $tiket->logForDeleted();
        DB::commit();

        return redirect()->route('tikets.index');
    }

    public function markDone(Tiket $tiket) {
        DB::beginTransaction();
        $this->service->markDone($tiket);
        DB::commit();

        return back();
    }

    public function updateTiket(TiketResponseRequest $request, Tiket $tiket) {
        DB::beginTransaction();
        $this->service->updateTiket($tiket, $request->validated());
        DB::commit();

        return back();
    }
}
