<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Services\Purchase\ItemRequestService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ItemRequestController extends Controller {
    public function __construct(Request $request, private ItemRequestService $itemRequestService) {
        // Item Request bukan 1 Eloquent model fisik (union SalesOrderItem/
        // InternalOrderItem/AssetServiceConsumedItem) -- model gate ini dipakai
        // base Controller untuk breadcrumb/Inertia::share('model'), TAPI
        // permission-nya sendiri di-skip di sini (lihat exceptPermission())
        // dan dicek manual per-method karena butuh lintas PurchaseRequest DAN
        // PurchaseOrder, sesuatu yang constructor base tidak dukung (cuma
        // bisa gate 1 model tetap).
        parent::__construct($request, PurchaseRequest::class);
    }

    /**
     * index() & stageBatch() melibatkan DUA model (PurchaseRequest DAN
     * PurchaseOrder) tergantung konteks -- gate otomatis base Controller
     * cuma bisa cek $this->model tunggal, jadi di-skip di sini dan dicek
     * manual (lihat requirePermissionToViewList()/
     * requirePermissionForDocumentType()) supaya user yang HANYA punya izin
     * salah satu (PR atau PO) tetap bisa pakai fitur ini sesuai izinnya.
     */
    protected function exceptPermission(string $method): ?bool {
        return match ($method) {
            'index', 'stageBatch' => true,
            default               => null,
        };
    }

    /**
     * Lihat daftar Item Request valid selama user punya izin `select` di
     * PurchaseRequest ATAU PurchaseOrder -- pada titik ini dia belum tentu
     * sudah memutuskan mau bikin PR atau PO.
     */
    private function requirePermissionToViewList(): void {
        try {
            PurchaseRequest::_checkPermission('select');

            return;
        } catch (HttpExceptionInterface) {
            // Tidak punya izin PurchaseRequest -- coba PurchaseOrder di bawah.
            // _checkPermission() sendiri yang abort(403) kalau ini juga gagal.
        }

        PurchaseOrder::_checkPermission('select');
    }

    /**
     * stageBatch() membuat SATU dokumen spesifik (ditentukan $documentType
     * dari payload) -- izin yang relevan HANYA `create` pada model TARGET
     * itu, BUKAN OR seperti requirePermissionToViewList(). User yang cuma
     * punya izin create PurchaseRequest TIDAK otomatis boleh membuat
     * PurchaseOrder lewat sini, begitu juga sebaliknya.
     */
    private function requirePermissionForDocumentType(string $documentType): void {
        $model = $documentType === 'purchaseRequest' ? PurchaseRequest::class : PurchaseOrder::class;
        $model::_checkPermission('create');
    }

    /**
     * Display a listing of shortage rows (spec item-request-auto-detect,
     * Requirement 1 & 2). BUKAN Model::dataTable() -- lihat design.md untuk
     * alasan (union 3 tabel berbeda struktur, bukan 1 Eloquent Builder).
     */
    public function index(Request $request) {
        $this->requirePermissionToViewList();

        // setBreadcrumbs() tanpa argumen memakai translateKey dari $this->model
        // (PurchaseRequest, dipakai murni untuk gating permission) -- breadcrumb-nya
        // salah jadi "Purchase Requests". Share manual dengan translateKey Item
        // Request sendiri, meniru persis bentuk yang dibuat setBreadcrumbs().
        Inertia::share(['breadcrumbs' => [['name' => 'purchase.itemRequest.title']]]);

        $filters = [
            'warehouse_ids' => (array) $request->input('warehouse_ids', []),
            'branch_ids'    => (array) $request->input('branch_ids', []),
            'source_types'  => (array) $request->input('source_types', []),
        ];

        $rows = $this->itemRequestService->getShortageRows($filters);

        $perPage     = max(1, (int) $request->input('show', 25));
        $currentPage = max(1, (int) $request->input('page', 1));
        $paginated   = new LengthAwarePaginator(
            $rows->forPage($currentPage, $perPage)->values(),
            $rows->count(),
            $perPage,
            $currentPage,
            ['path' => $request->url(), 'query' => $request->query()],
        );

        return Inertia::render('Purchase/ItemRequests/Index', [
            'rows'          => $paginated,
            'filterOptions' => [
                'warehouses'  => Warehouse::select('id', 'name')->orderBy('name')->get(),
                'branches'    => Branch::select('id', 'name')->orderBy('name')->get(),
                'sourceTypes' => [
                    ['value' => ItemRequestService::SOURCE_SALES_ORDER, 'label' => 'Sales Order'],
                    ['value' => ItemRequestService::SOURCE_INTERNAL_ORDER, 'label' => 'Internal Order'],
                    ['value' => ItemRequestService::SOURCE_ASSET_SERVICE, 'label' => 'Asset Service'],
                ],
            ],
            'appliedFilters' => $filters,
            // FQCN model target Buat PR/Buat PO -- FE gate visibility tombol
            // via canGlobal(documentModels.xxx, "create") (usePermission),
            // selaras exact dengan requirePermissionForDocumentType() di atas
            // (BUKAN OR, tiap tombol independen sesuai izin create modelnya).
            'documentModels' => [
                'purchaseRequest' => PurchaseRequest::class,
                'purchaseOrder'   => PurchaseOrder::class,
            ],
        ]);
    }

    /**
     * Stage baris terpilih (multi-select, lintas SO/IO/AssetService) lalu
     * redirect ke create PurchaseRequest/PurchaseOrder dengan prefill
     * (Requirement 3). Validasi ulang quantity terjadi di
     * ItemRequestService::stageBatch() sendiri (race condition/tampering).
     */
    public function stageBatch(Request $request) {
        $validated = $request->validate([
            'document_type'            => ['required', 'in:purchaseRequest,purchaseOrder'],
            'selections'               => ['required', 'array', 'min:1'],
            'selections.*.source_type' => ['required', 'string'],
            'selections.*.source_id'   => ['required', 'string'],
            'selections.*.quantity'    => ['required', 'numeric', 'min:0.0001'],
        ]);

        $this->requirePermissionForDocumentType($validated['document_type']);

        $token = $this->itemRequestService->stageBatch($validated['selections']);

        $routeName = $validated['document_type'] === 'purchaseRequest'
            ? 'purchaseRequests.create'
            : 'purchaseOrders.create';

        return redirect()->route($routeName, ['ref' => "itemRequestBatch/{$token}"]);
    }
}
