<?php

namespace App\Http\Requests\Sales\Rules;

use App\Services\Core\PermissionChecker;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * Aturan bersama untuk baris di luar dokumen sumber pada Delivery Note dan Sales Invoice
 * (spec delivery-note-sales-invoice-off-source-items): izin khusus, Asset bebas harus aktif
 * dan belum ada di dokumen submitted sejenis, serta baris sumber harus milik dokumen header.
 */
final class OffSourceItemRules {
    /** Nama aksi izin tambahan pada model dokumen (lihat `extraPermissions()`). */
    public const PERMISSION = 'manage_off_source_items';

    /**
     * Baris bebas (ItemVariant/Asset di luar dokumen sumber) hanya boleh dibuat user dengan
     * izin `manage_off_source_items` pada model dokumen: harga dan pajak baris bebas berasal
     * dari input, bukan dari dokumen sumber.
     *
     * @param  list<int|string>  $freeRowIndexes
     */
    public static function validatePermission(Validator $validator, FormRequest $request, string $model, array $freeRowIndexes): void {
        if ($freeRowIndexes === [] || PermissionChecker::forUser($request)->canAction($model, self::PERMISSION)) {
            return;
        }

        foreach ($freeRowIndexes as $index) {
            $validator->errors()->add("items.{$index}.asset", __('sales/offSource.permission_required'));
        }
    }

    /**
     * Asset bebas harus berstatus `active` dan belum ada di dokumen submitted lain sejenis
     * (bukan retur, belum dibatalkan).
     *
     * @param  array<int|string,string>  $assetIdByIndex  index baris => asset id
     * @param  string  $itemsTable  mis. `delivery_note_items`
     * @param  string  $documentsTable  mis. `delivery_notes`
     * @param  string  $documentKey  kolom FK item ke dokumen, mis. `delivery_note_id`
     */
    public static function validateFreeAssets(Validator $validator, array $assetIdByIndex, string $itemsTable, string $documentsTable, string $documentKey): void {
        if ($assetIdByIndex === []) {
            return;
        }

        $ids    = array_values(array_unique($assetIdByIndex));
        $active = DB::table('assets')->whereIn('id', $ids)->whereJsonContains('status', 'active')->pluck('id')->flip();
        $used   = DB::table($itemsTable . ' as i')
            ->join($documentsTable . ' as d', 'd.id', '=', "i.{$documentKey}")
            ->whereIn('i.asset_id', $ids)
            ->whereNotNull('d.submitted_at')
            ->whereNull('d.canceled_at')
            ->whereNull('d.return_against_id')
            ->whereNull('d.deleted_at')
            ->whereNull('i.deleted_at')
            ->pluck('i.asset_id')
            ->flip();

        foreach ($assetIdByIndex as $index => $assetId) {
            if (! $active->has($assetId)) {
                $validator->errors()->add("items.{$index}.asset.id", __('sales/offSource.asset_not_active'));
            } elseif ($used->has($assetId)) {
                $validator->errors()->add("items.{$index}.asset.id", __('sales/offSource.asset_already_used'));
            }
        }
    }

    /**
     * Baris sumber harus milik dokumen header: `$sourceOwnerByIndex` berisi, per baris SO,
     * id dokumen pemilik yang sebenarnya (dari DB) dan `$headerId` id header yang dikirim.
     *
     * @param  array<int|string,?string>  $sourceOwnerByIndex  index baris => id dokumen pemilik baris sumber
     * @param  string  $errorField  mis. `referenceable_id` atau `sales_order_item.id`
     */
    public static function validateSourceBelongsToHeader(Validator $validator, array $sourceOwnerByIndex, ?string $headerId, string $errorField): void {
        if (blank($headerId)) {
            return;
        }

        foreach ($sourceOwnerByIndex as $index => $owner) {
            if ($owner !== null && $owner !== $headerId) {
                $validator->errors()->add("items.{$index}.{$errorField}", __('sales/offSource.source_not_in_header'));
            }
        }
    }
}
