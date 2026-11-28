<?php

namespace App\Services\Finances\Accounting;

use App\Services\Finances\Currency\Decimal;
use App\Services\Finances\Ledger\ForeignAmount;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use Illuminate\Database\Eloquent\Model;

/**
 * Mengonversi nilai dokumen mata uang asing ke mata uang dasar untuk konteks posting (Finance Fase 4, Requirement 8.1-8.2).
 * Memakai kurs TERSIMPAN pada dokumen (`exchange_rate`, nilai dasar per 1 unit asing) dan `exchange_rate_id`, bukan
 * pencarian ulang ke `FxEngine`, agar posting yang diantrekan dan panel pratinjau deterministik dan sama dengan jejak
 * dokumen. Aritmetika `Decimal` (BigDecimal).
 *
 * - `base()`: dibulatkan HALF_UP ke minor unit dasar (total, komponen potong): dipakai bagian yang HARUS pas.
 * - `raw()`: tidak dibulatkan (baris pendapatan/beban/pajak/diskon): sisa pembulatan antarbaris diserap `PostingService`
 *   pada baris pendapatan/beban (Requirement 8.2).
 *
 * `fromDocument()` null untuk dokumen mata uang dasar (atau data mata uang/kurs tak lengkap): pemanggil memakai angka apa
 * adanya, persis seperti sebelumnya.
 */
final class DocumentFxScaler {
    private function __construct(
        private readonly string $currencyCode,
        private readonly string $rate,
        private readonly ?string $exchangeRateId,
        private readonly int $minorUnit,
    ) {}

    public static function fromDocument(Model $document): ?self {
        $currency = $document->currency_code ?? null;
        $rate     = $document->exchange_rate ?? null;
        if ($currency === null || $currency === '' || $rate === null || (float) $rate <= 0) {
            return null;
        }

        [$baseCode, $minorUnit] = app(JournalService::class)->baseCurrency();
        if ($baseCode === null || (string) $baseCode === (string) $currency) {
            return null;
        }

        $id = $document->exchange_rate_id ?? null;

        return new self((string) $currency, Decimal::normalize($rate), $id === null ? null : (string) $id, $minorUnit);
    }

    public function base(float $amount): float {
        return (float) Decimal::roundHalfUp(Decimal::multiply(Decimal::normalize($amount), $this->rate), $this->minorUnit);
    }

    public function raw(float $amount): float {
        return (float) Decimal::multiply(Decimal::normalize($amount), $this->rate);
    }

    /** Jumlah asing untuk baris piutang/utang (jumlah apa adanya di mata uang dokumen). */
    public function foreign(float $amount): ForeignAmount {
        return new ForeignAmount($this->currencyCode, Decimal::normalize($amount), $this->rate, $this->exchangeRateId);
    }

    /**
     * @param  array<string, float|int|string>  $amounts
     * @return array<string, float>
     */
    public function rawAmounts(array $amounts): array {
        return array_map(fn (float|int|string $amount): float => $this->raw((float) $amount), $amounts);
    }

    /**
     * @param  list<LineAttributes>  $lines
     * @return list<LineAttributes>
     */
    public function lines(array $lines): array {
        return array_map(fn (LineAttributes $line): LineAttributes => new LineAttributes(
            $this->rawAmounts($line->amounts),
            $line->itemType,
            $line->isStockItem,
            $line->itemCategoryId,
            $line->lineId,
        ), $lines);
    }

    /**
     * Komponen pajak penambah dikonversi mentah (bagian baris ikut); komponen potong (`withholding`) dibulatkan per
     * komponen dengan sisa ke komponen terakhir sehingga Σ potongan dasar = base(Σ potongan asing). Dengan begitu
     * `receivable/payable = base(total) - Σ potongan` tetap dalam satu minor unit dari base(total - Σ potongan).
     *
     * @param  list<TaxComponentLine>  $components
     * @return list<TaxComponentLine>
     */
    public function components(array $components): array {
        $withholdingForeign = array_sum(array_map(static fn (TaxComponentLine $component): float => $component->withholding ? $component->amount : 0.0, $components));
        $remaining          = $this->base($withholdingForeign);
        $lastWithholding    = null;
        foreach ($components as $index => $component) {
            if ($component->withholding) {
                $lastWithholding = $index;
            }
        }

        $result = [];
        foreach ($components as $index => $component) {
            if ($component->withholding) {
                $amount    = $index === $lastWithholding ? $remaining : min($remaining, $this->base($component->amount));
                $remaining = round($remaining - $amount, 6);
                $result[]  = $this->rebuild($component, $amount, $component->lineShares);

                continue;
            }

            $result[] = $this->rebuild($component, $this->raw($component->amount), $this->rawAmounts($component->lineShares));
        }

        return $result;
    }

    /**
     * @param  array<string, float>  $lineShares
     */
    private function rebuild(TaxComponentLine $component, float $amount, array $lineShares): TaxComponentLine {
        return new TaxComponentLine(
            $component->ruleVersionId,
            $component->role,
            $amount,
            $component->isCreditable,
            $component->classified,
            $lineShares,
            $component->taxId,
            $component->withholding,
        );
    }
}
