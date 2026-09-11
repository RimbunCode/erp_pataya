<?php

namespace App\Services\Purchase;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Models\Purchase\ItemRequestCoverage;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Utils;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Deteksi kebutuhan Item yang shortage — spec item-request-auto-detect.
 *
 * Daftar Item Request dihitung ON-DEMAND (query, bukan tabel materialized) dari
 * tiga Source Document: SalesOrderItem/InternalOrderItem berstatus `draft`
 * (dokumen yang gagal/akan gagal submit karena kurang stok — lihat Requirement
 * 1.0 requirements.md) dan AssetServiceConsumedItem milik Work Order aktif.
 */
class ItemRequestService {
    public const SOURCE_SALES_ORDER    = 'sales_order';
    public const SOURCE_INTERNAL_ORDER = 'internal_order';
    public const SOURCE_ASSET_SERVICE  = 'asset_service';

    /**
     * @param  array{warehouse_ids?: array, branch_ids?: array, source_types?: array}  $filters
     * @return Collection<int, array>
     */
    public function getShortageRows(array $filters = []): Collection {
        $rows = collect();

        if ($this->wantsSourceType($filters, self::SOURCE_SALES_ORDER)) {
            $rows = $rows->merge($this->salesOrderItemRows($filters));
        }
        if ($this->wantsSourceType($filters, self::SOURCE_INTERNAL_ORDER)) {
            $rows = $rows->merge($this->internalOrderItemRows($filters));
        }
        if ($this->wantsSourceType($filters, self::SOURCE_ASSET_SERVICE)) {
            $rows = $rows->merge($this->assetServiceConsumedItemRows($filters));
        }

        return $rows->filter(fn (array $row) => $row['shortage_quantity'] > 0)->values();
    }

    private function wantsSourceType(array $filters, string $type): bool {
        return empty($filters['source_types']) || \in_array($type, $filters['source_types']);
    }

    /**
     * Validasi ULANG tiap selection terhadap shortage TERKINI (jangan percaya
     * angka dari client — race condition: baris bisa sudah di-cover user lain
     * sejak halaman di-load), simpan payload tervalidasi ke session dengan
     * token single-use, return token (Requirement 3.1, 4.6, NFR2).
     *
     * @param  array<array{source_type: string, source_id: string, quantity: float}>  $selections
     */
    public function stageBatch(array $selections): string {
        $currentRows = $this->getShortageRows()->keyBy(fn (array $row) => "{$row['source_type']}|{$row['source_id']}");

        $validated = [];
        foreach ($selections as $selection) {
            $sourceType = $selection['source_type'] ?? null;
            $sourceId   = $selection['source_id'] ?? null;
            $row        = $currentRows->get("{$sourceType}|{$sourceId}");
            if (! $row) {
                // Baris tidak lagi shortage (sudah di-cover pihak lain) atau
                // source_type/id tidak valid — skip diam-diam, bukan error keras.
                continue;
            }

            // Clamp: quantity yang diminta tidak boleh melebihi shortage AKTUAL.
            $quantity = min((float) ($selection['quantity'] ?? 0), $row['shortage_quantity']);
            if ($quantity <= 0) {
                continue;
            }

            $validated[] = [
                'source_type' => $sourceType,
                'source_id'   => $sourceId,
                'quantity'    => $quantity,
            ];
        }

        $token = (string) Str::ulid();
        session()->put("item_request_batch.{$token}", $validated);

        return $token;
    }

    /**
     * Dipanggil dari PurchaseRequestController/PurchaseOrderController::create()
     * case 'itemRequestBatch'. Single-use — key session dihapus setelah dibaca.
     * Token tidak ditemukan/expired -> array kosong (bukan exception, lihat
     * design.md §Error Handling).
     *
     * @return array<int, array>
     */
    public function resolveBatch(string $token): array {
        $selections = session()->pull("item_request_batch.{$token}", []);
        if (empty($selections)) {
            return [];
        }

        return \collect($selections)
            ->map(fn (array $selection) => $this->buildPrefillItem($selection['source_type'], $selection['source_id'], $selection['quantity']))
            ->filter()
            ->values()
            ->all();
    }

    private function buildPrefillItem(string $sourceType, string $sourceId, float $quantity): ?array {
        if (! \in_array($sourceType, [SalesOrderItem::class, InternalOrderItem::class, AssetServiceConsumedItem::class], true)) {
            return null;
        }

        $isAssetService = $sourceType === AssetServiceConsumedItem::class;
        $source         = $sourceType::with($isAssetService ? ['item', 'itemUnit'] : ['item', 'unit'])->find($sourceId);
        if (! $source) {
            return null;
        }

        return [
            'id'                 => Utils::generateRandom(5),
            'item'               => $source->item,
            'quantity'           => $quantity,
            'unit'               => $isAssetService ? $source->itemUnit : $source->unit,
            'referenceable'      => $source,
            'referenceable_type' => $sourceType,
            'referenceable_id'   => $source->id,
        ];
    }

    /**
     * Dipanggil dari PurchaseRequestService/PurchaseOrderService setelah item
     * PR/PO tersimpan — mencatat quantity yang di-cover dari suatu baris
     * shortage (Requirement 4.1). Dibungkus lockForUpdate mencegah race
     * condition dua user membuat PR/PO dari baris shortage sama (Req 4.6, NFR2).
     */
    public function recordCoverage(Model $coveringItem, string $sourceType, string $sourceId, float $quantity): void {
        DB::transaction(function () use ($coveringItem, $sourceType, $sourceId, $quantity) {
            ItemRequestCoverage::where('source_type', $sourceType)
                ->where('source_id', $sourceId)
                ->lockForUpdate()
                ->get();

            ItemRequestCoverage::create([
                'source_type'      => $sourceType,
                'source_id'        => $sourceId,
                'covering_type'    => $coveringItem::class,
                'covering_id'      => $coveringItem->id,
                'quantity_covered' => $quantity,
                'created_by_id'    => Auth::id(),
            ]);
        });
    }

    /**
     * SalesOrderItem/InternalOrderItem milik dokumen `draft` yang bukan hasil
     * referensi ke AssetService (Requirement 1.5 — dihindari double-count dgn
     * assetServiceConsumedItemRows()).
     */
    private function salesOrderItemRows(array $filters): Collection {
        return $this->draftDocumentItemRows(SalesOrderItem::class, 'salesOrder', $filters);
    }

    private function internalOrderItemRows(array $filters): Collection {
        return $this->draftDocumentItemRows(InternalOrderItem::class, 'internalOrder', $filters);
    }

    /**
     * @param  class-string<SalesOrderItem|InternalOrderItem>  $itemClass
     */
    private function draftDocumentItemRows(string $itemClass, string $parentRelation, array $filters): Collection {
        $query = $itemClass::query()
            ->whereHas($parentRelation, function ($q) use ($filters) {
                $q->whereJsonContains('status', FormStatus::DRAFT->value);
                if (! empty($filters['branch_ids'])) {
                    $q->whereIn('branch_id', $filters['branch_ids']);
                }
            })
            ->whereHas('item', fn ($q) => $q->where('is_stock_item', true))
            ->where(function ($q) {
                $q->whereNull('referenceable_type')
                    ->orWhereNotIn('referenceable_type', [AssetService::class, AssetServiceConsumedItem::class]);
            })
            ->with(['item', 'unit', "{$parentRelation}.branch", 'sourceWarehouse']);

        if (! empty($filters['warehouse_ids'])) {
            $query->whereIn('source_warehouse_id', $filters['warehouse_ids']);
        }

        $items = $query->get();
        if ($items->isEmpty()) {
            return collect();
        }

        $stocks      = $this->stockMap($items->pluck('item_id'), $items->pluck('source_warehouse_id'));
        $coveredMap  = $this->coveredQuantityMap($itemClass, $items->pluck('id')->all());
        $sourceLabel = $itemClass === SalesOrderItem::class ? self::SOURCE_SALES_ORDER : self::SOURCE_INTERNAL_ORDER;

        return $items->map(function ($item) use ($stocks, $coveredMap, $sourceLabel, $itemClass, $parentRelation) {
            $stockKey          = "{$item->item_id}-{$item->source_warehouse_id}";
            $availableQuantity = $stocks->get($stockKey)?->ready_quantity ?? 0.0;
            $requiredQuantity  = (float) $item->quantity;
            $coveredQuantity   = $coveredMap[$item->id] ?? 0.0;
            $document          = $item->{$parentRelation};

            return $this->makeRow(
                sourceType: $itemClass,
                sourceId: $item->id,
                itemVariantId: $item->item_id,
                itemName: $item->item?->item_name,
                itemUnitId: $item->item_unit_id,
                warehouseIds: [$item->source_warehouse_id],
                warehouseNames: [$item->sourceWarehouse?->name],
                branchId: $document?->branch_id,
                branchName: $document?->branch?->name,
                requiredQuantity: $requiredQuantity,
                coveredQuantity: $coveredQuantity,
                availableQuantity: $availableQuantity,
                sourceLabel: $sourceLabel,
                sourceDocument: $document ? [
                    'id'        => $document->id,
                    'code'      => $document->code,
                    'thisModel' => $document->thisModel,
                    'route'     => $document->route,
                ] : null,
                itemDocument: $this->documentRef($item->item),
                branchDocument: $this->documentRef($document?->branch),
                warehouseDocuments: [$this->documentRef($item->sourceWarehouse)],
            );
        });
    }

    /**
     * AssetServiceConsumedItem milik AssetService (Work Order) yang masih
     * aktif — Work Order tidak submit-block terhadap stok (docs/modules/
     * service.md), jadi TIDAK ada filter status `draft` di sini, murni
     * "belum selesai/dibatalkan" (Requirement 1.4).
     */
    private function assetServiceConsumedItemRows(array $filters): Collection {
        $query = AssetServiceConsumedItem::query()
            ->whereDoesntHave('assetService', function ($q) {
                $q->whereJsonContains('status', FormStatus::COMPLETED->value)
                    ->orWhereJsonContains('status', FormStatus::CANCELED->value);
            })
            ->whereHas('item', fn ($q) => $q->where('is_stock_item', true))
            ->with(['item', 'itemUnit', 'assetService']);

        $items = $query->get();
        if ($items->isEmpty()) {
            return collect();
        }

        $coveredMap = $this->coveredQuantityMap(AssetServiceConsumedItem::class, $items->pluck('id')->all());

        $rows = collect();
        foreach ($items as $item) {
            $asset  = $item->assetService?->resolvedAsset();
            $branch = $asset?->branch();
            if (! $branch) {
                // Data tidak lengkap (AssetService tanpa Asset/Location/Branch
                // ter-resolve) — skip, bukan error fatal (design.md §Error Handling).
                continue;
            }
            if (! empty($filters['branch_ids']) && ! \in_array($branch->id, $filters['branch_ids'])) {
                continue;
            }

            $warehouses = Warehouse::where('branch_id', $branch->id)->get();
            if (! empty($filters['warehouse_ids'])) {
                $warehouses = $warehouses->whereIn('id', $filters['warehouse_ids']);
                if ($warehouses->isEmpty()) {
                    continue;
                }
            }

            $availableQuantity = $warehouses->isEmpty()
                ? 0.0
                : (float) Stock::where('item_variant_id', $item->item_id)
                    ->whereIn('warehouse_id', $warehouses->pluck('id'))
                    ->sum('ready_quantity');

            $document = $item->assetService;

            $rows->push($this->makeRow(
                sourceType: AssetServiceConsumedItem::class,
                sourceId: $item->id,
                itemVariantId: $item->item_id,
                itemName: $item->item?->item_name,
                itemUnitId: $item->item_unit_id,
                warehouseIds: $warehouses->pluck('id')->all(),
                warehouseNames: $warehouses->pluck('name')->all(),
                branchId: $branch->id,
                branchName: $branch->name,
                requiredQuantity: (float) $item->quantity,
                coveredQuantity: $coveredMap[$item->id] ?? 0.0,
                availableQuantity: $availableQuantity,
                sourceLabel: self::SOURCE_ASSET_SERVICE,
                sourceDocument: $document ? [
                    'id'        => $document->id,
                    'code'      => $document->code,
                    'thisModel' => $document->thisModel,
                    'route'     => $document->route,
                ] : null,
                itemDocument: $this->documentRef($item->item),
                branchDocument: $this->documentRef($branch),
                warehouseDocuments: $warehouses->map(fn (Warehouse $warehouse) => $this->documentRef($warehouse))->all(),
            ));
        }

        return $rows;
    }

    /**
     * @param  ?array{id: string, code: ?string, thisModel: string, route: string}  $sourceDocument
     *                                                                                               Dokumen sumber (SalesOrder/InternalOrder/AssetService) untuk kolom
     *                                                                                               "source" FE -- linkable ke halaman show-nya, digate permission `read`
     *                                                                                               per-model di FE (pola sama dengan kolom relation Table2.jsx).
     * @param  ?array{id: string, thisModel: string, route: string}  $itemDocument  Sama seperti
     *                                                                              $sourceDocument, tapi utk kolom Item (ItemVariant) -- Requirement dari
     *                                                                              user: pola linkable+permission-gated berlaku ke SEMUA kolom relasi,
     *                                                                              bukan cuma Source.
     * @param  ?array{id: string, thisModel: string, route: string}  $branchDocument  Sama, utk kolom Branch.
     * @param  array<int, ?array{id: string, thisModel: string, route: string}>  $warehouseDocuments  Sama,
     *                                                                                                utk kolom Warehouse -- array krn baris AssetService bisa multi-warehouse
     *                                                                                                (indeks selaras dgn $warehouseIds/$warehouseNames).
     */
    private function makeRow(
        string $sourceType,
        string $sourceId,
        ?string $itemVariantId,
        ?string $itemName,
        ?string $itemUnitId,
        array $warehouseIds,
        array $warehouseNames,
        ?string $branchId,
        ?string $branchName,
        float $requiredQuantity,
        float $coveredQuantity,
        float $availableQuantity,
        string $sourceLabel,
        ?array $sourceDocument,
        ?array $itemDocument,
        ?array $branchDocument,
        array $warehouseDocuments = [],
    ): array {
        $shortageQuantity = max(0.0, ($requiredQuantity - $coveredQuantity) - $availableQuantity);

        return [
            'source_type'         => $sourceType,
            'source_id'           => $sourceId,
            'source_label'        => $sourceLabel,
            'source_document'     => $sourceDocument,
            'item_variant_id'     => $itemVariantId,
            'item_name'           => $itemName,
            'item_unit_id'        => $itemUnitId,
            'item_document'       => $itemDocument,
            'warehouse_ids'       => $warehouseIds,
            'warehouse_names'     => $warehouseNames,
            'warehouse_documents' => $warehouseDocuments,
            'branch_id'           => $branchId,
            'branch_name'         => $branchName,
            'branch_document'     => $branchDocument,
            'required_quantity'   => $requiredQuantity,
            'covered_quantity'    => $coveredQuantity,
            'available_quantity'  => $availableQuantity,
            'shortage_quantity'   => $shortageQuantity,
        ];
    }

    /**
     * Bentuk payload minimal utk kolom FE yang linkable+permission-gated (pola
     * kolom "relation" Table2.jsx) -- id/thisModel/route dari accessor bawaan
     * `LinkModel` trait, TANPA query tambahan (model sudah eager-loaded oleh
     * caller).
     */
    private function documentRef(?Model $model): ?array {
        if (! $model) {
            return null;
        }

        return [
            'id'        => $model->id,
            'thisModel' => $model->thisModel,
            'route'     => $model->route,
        ];
    }

    /** Ambil semua Stock terkait sekaligus (hindari N+1 — NFR1). */
    private function stockMap(Collection $itemVariantIds, Collection $warehouseIds): Collection {
        return Stock::whereIn('item_variant_id', $itemVariantIds->filter()->unique())
            ->whereIn('warehouse_id', $warehouseIds->filter()->unique())
            ->get()
            ->keyBy(fn (Stock $stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
    }

    /**
     * SUM quantity_covered per source item, HANYA dari coverage yang
     * covering-nya (PurchaseRequestItem/PurchaseOrderItem) masih terhubung ke
     * dokumen SUDAH submitted (bukan draft) dan non-canceled/non-rejected
     * (Requirement 4.1, 4.5). PR/PO draft belum dianggap komitmen nyata --
     * baris shortage tetap tampil sampai dokumen benar-benar disubmit.
     *
     * @param  string[]  $sourceIds
     * @return array<string, float>
     */
    private function coveredQuantityMap(string $sourceType, array $sourceIds): array {
        if (empty($sourceIds)) {
            return [];
        }

        $coverages = ItemRequestCoverage::query()
            ->where('source_type', $sourceType)
            ->whereIn('source_id', $sourceIds)
            ->with(['covering' => function ($morphTo) {
                $morphTo->morphWith([
                    PurchaseRequestItem::class => ['purchaseRequest'],
                    PurchaseOrderItem::class   => ['purchaseOrder'],
                ]);
            }])
            ->get();

        $map = [];
        foreach ($coverages as $coverage) {
            if (! $this->isCoveringActive($coverage)) {
                continue;
            }
            $map[$coverage->source_id] = ($map[$coverage->source_id] ?? 0.0) + (float) $coverage->quantity_covered;
        }

        return $map;
    }

    private function isCoveringActive(ItemRequestCoverage $coverage): bool {
        $covering = $coverage->covering;
        if (! $covering) {
            return false;
        }

        $parent = match ($coverage->covering_type) {
            PurchaseRequestItem::class => $covering->purchaseRequest,
            PurchaseOrderItem::class   => $covering->purchaseOrder,
            default                    => null,
        };
        if (! $parent) {
            return false;
        }

        $statuses = (array) $parent->status;

        return ! \in_array(FormStatus::DRAFT, $statuses, true)
            && ! \in_array(FormStatus::CANCELED, $statuses, true)
            && ! \in_array(FormStatus::REJECTED, $statuses, true);
    }
}
