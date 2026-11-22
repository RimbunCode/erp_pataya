<?php

namespace App\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Models\Core\GlPostingStatus;
use App\Services\Asset\Accounting\AssetPostingContextFactory;
use App\Services\Finances\Posting\PostingGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

class PostAssetDisposalGainLoss implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(AssetSoldViaInvoice $event): void {
        DB::transaction(function () use ($event) {
            $line = $event->line->fresh();
            if (! $line || $line->processed_at) {
                return;
            }

            // Baris RETUR tidak memposting pelepasan (T-7): pemulihan aset karena retur diputuskan terpisah. Status `skipped`
            // tanpa `processed_at`, sama dengan jalur Sales Invoice dibatalkan.
            if ($line->salesInvoice?->return_against_id !== null) {
                GlPostingStatus::updateOrCreate(
                    ['referenceable_type' => $line::class, 'referenceable_id' => $line->id],
                    ['status' => FormStatus::SKIPPED->value],
                );

                return;
            }

            $asset = $line->asset;

            // Bentuk baku (T-7): hasil penjualan = DPP baris dikurangi diskon (basic_amount - discount_amount, TANPA pajak
            // yang masih menyatu di pendapatan sampai Fase 3, F-03), bukan harga satuan. Harga perolehan dan akumulasi
            // penyusutan (jadwal terposting + saldo awal) proporsional terhadap qty baris / qty aset. Jadwal penyusutan
            // tidak dikurangi setelah penjualan sebagian (risiko terpisah, dicatat di spek).
            $ratio       = (float) $asset->asset_quantity > 0 ? (float) $line->quantity / (float) $asset->asset_quantity : 0.0;
            $proceeds    = (float) $line->basic_amount - (float) $line->discount_amount;
            $cost        = (float) $asset->total_asset_cost * $ratio;
            $accumulated = $asset->accumulatedDepreciation() * $ratio;

            $branchId = $asset->branch()?->id;
            $accounts = $asset->assetCategory?->accounts()
                ->where('branch_id', $branchId)
                ->first();

            if (! $accounts) {
                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            // Gateway Posting Engine (Finance Fase 2, Task 7.1; closure legacy dihapus Task 14.1). Dokumen penjaga guard
            // cancel adalah Sales Invoice sumber baris (Q-P2-13), bukan aset. Kunci idempotensi per baris invoice
            // (`disposal:{sales_invoice_item_id}`, Q-P1-6) dipegang rule engine.
            $outcome = app(PostingGateway::class)->post(
                app(AssetPostingContextFactory::class)->disposal($line, $asset, $accounts, $proceeds, $cost, $accumulated, now()),
            );

            if ($outcome->isSkipped()) {
                // Q-P2-13: Sales Invoice dibatalkan sebelum job berjalan. Baris status disposal dibuat di sini (tidak ada baris
                // `pending` sebelumnya) dengan status `skipped` (tidak pernah `posted`; baris `failed` dari percobaan sebelumnya menjadi `skipped`).
                // `processed_at` sengaja tidak diisi: tidak ada posting yang diproses.
                GlPostingStatus::updateOrCreate(
                    ['referenceable_type' => $line::class, 'referenceable_id' => $line->id],
                    ['status' => FormStatus::SKIPPED->value],
                );

                return;
            }

            // Upsert dengan kunci yang sama dengan `failed()` dan jalur `skipped` (satu baris per disposal): baris `failed`
            // dari percobaan sebelumnya menjadi `posted` saat retry berhasil, bukan berdampingan dengan baris baru (M-9,
            // disetujui pemilik produk 2026-11-14; pengecualian Requirement 6.2).
            GlPostingStatus::updateOrCreate(
                ['referenceable_type' => $line::class, 'referenceable_id' => $line->id],
                ['status' => FormStatus::POSTED->value, 'posted_at' => now()],
            );

            $line->update(['processed_at' => now()]);
        });
    }

    public function failed(AssetSoldViaInvoice $event, Throwable $e): void {
        // Kunci sama dengan jalur `skipped`: queue:retry berulang tidak membuat baris FAILED ganda. Kegagalan pertama
        // tetap membuat baris dengan `retry_count` 1 (perilaku `off` tidak berubah).
        $row = GlPostingStatus::firstOrNew([
            'referenceable_type' => $event->line::class,
            'referenceable_id'   => $event->line->id,
        ]);

        // Baris TERMINAL tidak boleh ditimpa menjadi FAILED: worker yang mati sebelum ack lalu job diambil lagi dengan
        // MaxAttemptsExceeded memanggil `failed()` tanpa menjalankan `handle()`, padahal disposal sudah `posted`/`skipped`.
        $status = $row->status instanceof \BackedEnum ? $row->status->value : $row->status;
        if ($row->exists && \in_array($status, [FormStatus::POSTED->value, FormStatus::SKIPPED->value], true)) {
            return;
        }
        if ($event->line->newQuery()->whereKey($event->line->getKey())->whereNotNull('processed_at')->exists()) {
            return;
        }

        $row->status      = FormStatus::FAILED->value;
        $row->retry_count = $row->exists ? ((int) $row->retry_count) + 1 : 1;
        $row->last_error  = $e->getMessage();
        $row->save();
    }
}
