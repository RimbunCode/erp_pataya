<?php

namespace App\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Models\Asset\Asset;
use App\Models\Core\GlPostingStatus;
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

            $asset      = $line->asset;
            $parentItem = $line->salesInvoiceItem;

            $proportionPrice = $parentItem->quantity > 0
                ? ($parentItem->price / $parentItem->quantity) * $line->quantity
                : 0;
            $proportionBook = $asset->asset_quantity > 0
                ? $asset->bookValue() * ($line->quantity / $asset->asset_quantity)
                : 0;
            $gainLoss = $proportionPrice - $proportionBook;

            $branchId = $asset->branch()?->id;
            $accounts = $asset->assetCategory?->accounts()
                ->where('branch_id', $branchId)
                ->first();

            if (! $accounts) {
                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            if (abs($gainLoss) > 0.0001) {
                $fixedAccount    = $accounts->fixedAssetAccount()->lockForUpdate()->first();
                $gainLossAccount = $accounts->gainLossDisposalAccount()->lockForUpdate()->first();

                if (! $gainLossAccount) {
                    throw new LogicException("gain_loss_disposal_account_id belum diisi untuk AssetCategoryAccount Asset {$asset->id}.");
                }

                if ($gainLoss >= 0) {
                    $fixedAccount->generalLedgerEntries()->create([
                        'against_account_id' => $gainLossAccount->id,
                        'debit'              => 0,
                        'credit'             => $gainLoss,
                        'transaction_date'   => now(),
                        'referenceable_type' => Asset::class,
                        'referenceable_id'   => $asset->id,
                    ]);
                    $gainLossAccount->generalLedgerEntries()->create([
                        'against_account_id' => $fixedAccount->id,
                        'debit'              => $gainLoss,
                        'credit'             => 0,
                        'transaction_date'   => now(),
                        'referenceable_type' => Asset::class,
                        'referenceable_id'   => $asset->id,
                    ]);
                } else {
                    $loss = abs($gainLoss);
                    $gainLossAccount->generalLedgerEntries()->create([
                        'against_account_id' => $fixedAccount->id,
                        'debit'              => 0,
                        'credit'             => $loss,
                        'transaction_date'   => now(),
                        'referenceable_type' => Asset::class,
                        'referenceable_id'   => $asset->id,
                    ]);
                    $fixedAccount->generalLedgerEntries()->create([
                        'against_account_id' => $gainLossAccount->id,
                        'debit'              => $loss,
                        'credit'             => 0,
                        'transaction_date'   => now(),
                        'referenceable_type' => Asset::class,
                        'referenceable_id'   => $asset->id,
                    ]);
                }
            }

            GlPostingStatus::create([
                'referenceable_type' => $line::class,
                'referenceable_id'   => $line->id,
                'status'             => FormStatus::POSTED->value,
                'posted_at'          => now(),
            ]);

            $line->update(['processed_at' => now()]);
        });
    }

    public function failed(AssetSoldViaInvoice $event, Throwable $e): void {
        GlPostingStatus::create([
            'referenceable_type' => $event->line::class,
            'referenceable_id'   => $event->line->id,
            'status'             => FormStatus::FAILED->value,
            'retry_count'        => 1,
            'last_error'         => $e->getMessage(),
        ]);
    }
}
