<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderBatchRequest;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderBatchSubmission;
use App\Services\Purchase\FromRequests\PurchaseOrderBatchService;
use App\Services\Purchase\FromRequests\PurchaseRequestPoSourceResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseOrderFromRequestsController extends Controller {
    public function __construct(Request $request, private PurchaseRequestPoSourceResolver $sources, private PurchaseOrderBatchService $batch) {
        parent::__construct($request, PurchaseOrder::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'stage', 'workspace', 'store', 'result' => 'create',
            default                                 => null,
        };
    }

    public function stage(Request $request): RedirectResponse {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'list', 'min:1', 'max:' . PurchaseRequestPoSourceResolver::MAX_REQUESTS],
            'ids.*' => ['required', 'string', 'ulid', 'distinct:strict'],
        ]);
        $token = $this->sources->stage($data['ids'], $request->user(), $request->session()->get('currentBranch'));

        return redirect()->route('purchaseOrders.fromRequests.show', $token);
    }

    public function workspace(Request $request, string $token): Response {
        $branchId = $request->session()->get('currentBranch');
        $context  = $this->sources->tokenContext($token, $request->user(), $branchId);
        $errors   = [];
        try {
            $sources = $this->sources->resolve($context['ids'], $request->user(), $branchId);
            $this->sources->rememberSnapshot($token, $sources);
        } catch (ValidationException $exception) {
            $sources = [];
            $errors  = $exception->errors();
        }
        $this->setBreadcrumbs('purchase.purchaseOrder.new');

        return Inertia::render('Purchase/PurchaseOrders/FromRequests/Workspace', [
            'token'        => $token,
            'sources'      => $sources,
            'sourceErrors' => $errors,
        ]);
    }

    public function store(PurchaseOrderBatchRequest $request): RedirectResponse {
        $submission = $this->batch->createDrafts(
            $request->validated(),
            $request->user(),
            $request->session()->get('currentBranch'),
        );

        return redirect()->route('purchaseOrders.fromRequests.result', $submission->idempotency_key);
    }

    public function result(Request $request, string $idempotencyKey): Response {
        $branchId   = $request->session()->get('currentBranch');
        $submission = PurchaseOrderBatchSubmission::query()
            ->where('user_id', $request->user()->id)
            ->where('branch_id', $branchId)
            ->where('idempotency_key', $idempotencyKey)
            ->firstOrFail();
        $orders = PurchaseOrder::query()
            ->where('created_by_id', $request->user()->id)
            ->where('branch_id', $branchId)
            ->whereIn('id', $submission->purchase_order_ids)
            ->with('supplier')
            ->withCount('items')
            ->get()->keyBy('id');
        $purchaseOrders = array_map(function (string $id) use ($orders): array {
            $order = $orders->get($id);
            abort_unless($order, 404);

            return [
                'id'          => $order->id,
                'code'        => $order->code,
                'supplier'    => $order->supplier?->name,
                'items_count' => $order->items_count,
                'url'         => route('purchaseOrders.show', $order),
            ];
        }, $submission->purchase_order_ids);

        return Inertia::render('Purchase/PurchaseOrders/FromRequests/Result', [
            'purchaseOrders' => $purchaseOrders,
        ]);
    }
}
