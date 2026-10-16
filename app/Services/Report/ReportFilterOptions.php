<?php

namespace App\Services\Report;

use App\Models\Asset\Asset;
use App\Models\Inventory\Category;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Scopes\DataTableScope;
use App\Models\User\User;
use Illuminate\Support\Facades\DB;

/**
 * Pilihan dropdown filter laporan (Req 2). Gudang dibatasi cabang dengan aturan
 * yang sama seperti tabel dan KPI, supaya dropdown tidak menawarkan gudang yang
 * datanya nanti tidak muncul di laporan.
 */
final class ReportFilterOptions {
    /**
     * @return list<array{value: string, label: string}>
     */
    public function warehouses(): array {
        $query = Warehouse::query();
        DataTableScope::applyBranchFilter($query);

        return $query
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Warehouse $warehouse) => ['value' => (string) $warehouse->id, 'label' => $warehouse->name])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function items(): array {
        return ItemVariant::query()
            ->orderBy('code')
            ->get(['id', 'code', 'item_name'])
            ->map(fn (ItemVariant $item) => ['value' => (string) $item->id, 'label' => "{$item->code} - {$item->item_name}"])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function customers(): array {
        return Customer::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Customer $customer) => ['value' => (string) $customer->id, 'label' => $customer->name])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function suppliers(): array {
        return Supplier::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Supplier $supplier) => ['value' => (string) $supplier->id, 'label' => $supplier->name])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function assets(): array {
        return Asset::query()
            ->orderBy('asset_name')
            ->get(['id', 'code', 'asset_name'])
            ->map(fn (Asset $asset) => ['value' => (string) $asset->id, 'label' => "{$asset->code} - {$asset->asset_name}"])
            ->values()
            ->all();
    }

    /**
     * Jenis servis yang pernah dipakai. Nilainya tulis bebas, jadi diambil dari data.
     *
     * @return list<array{value: string, label: string}>
     */
    public function serviceTypes(): array {
        // Kolom type di-cast ke enum pada AssetService; nilai mentah diambil lewat query builder
        // supaya yang dikirim ke filter tetap string yang sama dengan kolom view.
        return DB::table('asset_services')
            ->whereNull('deleted_at')
            ->whereNotNull('type')
            ->distinct()
            ->orderBy('type')
            ->pluck('type')
            ->map(fn (string $type) => ['value' => $type, 'label' => $type])
            ->values()
            ->all();
    }

    /**
     * Pengguna sebagai PIC. Aktivitas tanpa PIC tidak masuk daftar ini; filter kosong
     * (Semua) sudah mencakupnya.
     *
     * @return list<array{value: string, label: string}>
     */
    public function users(): array {
        return User::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => ['value' => (string) $user->id, 'label' => $user->name])
            ->values()
            ->all();
    }

    /**
     * Status aktivitas yang pernah dipakai. Nilainya tulis bebas, jadi diambil dari data.
     *
     * @return list<array{value: string, label: string}>
     */
    public function activityStatuses(): array {
        return DB::table('asset_service_activities')
            ->whereNull('deleted_at')
            ->whereNotNull('status')
            ->distinct()
            ->orderBy('status')
            ->pluck('status')
            ->map(fn (string $status) => ['value' => $status, 'label' => $status])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function categories(): array {
        return Category::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Category $category) => ['value' => (string) $category->id, 'label' => $category->name])
            ->values()
            ->all();
    }
}
