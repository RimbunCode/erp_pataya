<?php

namespace App\Http\Requests\Finances\Rules;

use App\Enums\FormStatus;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Validasi retur invoice (Sales/Purchase):
 * - invoice yang diretur harus sudah di-approve (bukan draft/pending/dibatalkan/retur);
 * - tiap baris retur wajib menunjuk baris asal (`return_against_item_id`) milik invoice itu;
 * - sumber baris (SO/PO item, item, asset, satuan) harus sama dengan baris asal;
 * - total kuantitas retur per baris asal tidak boleh melebihi `quantity − returned_quantity`.
 *
 * Pengecekan sisa diulang saat approve (`assertRemainingOnApprove`) di bawah lock.
 */
final class ReturnAgainstItemRules {
    /** Status invoice yang sudah di-approve dan boleh diretur. */
    private const array RETURNABLE_STATUSES = [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID, FormStatus::PAID];

    /**
     * @param  array<int|string,mixed>  $rows  payload `items`
     * @param  string  $itemsTable  mis. `sales_invoice_items`
     * @param  string  $documentKey  FK baris ke invoice, mis. `sales_invoice_id`
     * @param  string  $documentsTable  mis. `sales_invoices`
     * @param  array<string,string>  $bind  path field baris payload => kolom baris asal yang harus sama
     */
    public static function validate(Validator $validator, array $rows, ?string $returnAgainstId, string $itemsTable, string $documentKey, string $documentsTable = '', array $bind = []): void {
        $sourceIds = [];
        foreach ($rows as $index => $row) {
            $sourceId = $row['return_against_item_id'] ?? null;
            if (blank($returnAgainstId)) {
                if (filled($sourceId)) {
                    $validator->errors()->add("items.{$index}.return_against_item_id", __('finances/returnAgainst.not_a_return'));
                }

                continue;
            }
            if (blank($sourceId)) {
                $validator->errors()->add("items.{$index}.return_against_item_id", __('finances/returnAgainst.source_required'));

                continue;
            }
            $sourceIds[$index] = $sourceId;
        }

        if ($returnAgainstId !== null && $returnAgainstId !== '' && $documentsTable !== '' && ! self::isReturnable($documentsTable, $returnAgainstId)) {
            $validator->errors()->add('return_against.id', __('finances/returnAgainst.invoice_not_returnable'));
        }

        if ($sourceIds === []) {
            return;
        }

        $sources = DB::table($itemsTable)
            ->whereIn('id', array_unique($sourceIds))
            ->whereNull('deleted_at')
            ->get()
            ->keyBy('id');

        $requested = [];
        foreach ($sourceIds as $index => $sourceId) {
            $source = $sources->get($sourceId);
            if (! $source || $source->{$documentKey} !== $returnAgainstId) {
                $validator->errors()->add("items.{$index}.return_against_item_id", __('finances/returnAgainst.item_not_in_invoice'));

                continue;
            }

            foreach ($bind as $path => $column) {
                $value = data_get($rows[$index], $path);
                if (filled($value) && $value !== ($source->{$column} ?? null)) {
                    $validator->errors()->add("items.{$index}.{$path}", __('finances/returnAgainst.row_mismatch'));
                }
            }

            $requested[$sourceId] = ($requested[$sourceId] ?? 0) + (float) ($rows[$index]['quantity'] ?? 0);
            $remaining            = (float) $source->quantity - (float) $source->returned_quantity;
            if ($requested[$sourceId] > $remaining + 0.0001) {
                $validator->errors()->add("items.{$index}.quantity", __('finances/returnAgainst.quantity_exceeds_remaining', ['max' => $remaining]));
            }
        }
    }

    /**
     * Cek ulang saat approve (di dalam transaksi): kunci baris asal lalu pastikan sisa masih
     * cukup, supaya dua retur pending tidak sama-sama lolos dari batas.
     *
     * @throws ValidationException
     */
    public static function assertRemainingOnApprove(string $itemsTable, string $sourceId, float $quantity): void {
        $source    = DB::table($itemsTable)->where('id', $sourceId)->lockForUpdate()->first(['quantity', 'returned_quantity']);
        $remaining = $source ? (float) $source->quantity - (float) $source->returned_quantity : 0.0;

        if ($quantity > $remaining + 0.0001) {
            throw ValidationException::withMessages([
                'items' => __('finances/returnAgainst.quantity_exceeds_remaining', ['max' => $remaining]),
            ]);
        }
    }

    private static function isReturnable(string $documentsTable, string $id): bool {
        $query = DB::table($documentsTable)
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->whereNull('canceled_at')
            ->whereNull('return_against_id');

        return $query->where(function ($status): void {
            foreach (self::RETURNABLE_STATUSES as $allowed) {
                $status->orWhereJsonContains('status', $allowed->value);
            }
        })->exists();
    }
}
