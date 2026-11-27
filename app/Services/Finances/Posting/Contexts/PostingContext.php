<?php

namespace App\Services\Finances\Posting\Contexts;

use App\Enums\PostingDocumentType;
use Carbon\CarbonInterface;

/**
 * DTO netral-modul yang diserahkan modul bisnis ke Posting Engine (Finance Fase 2, Requirement 4.1). Hanya memuat
 * ID, tipe morph, angka bernama, akun master, dan baris beratribut barang; engine tidak mengenal model dokumen
 * (aturan ketergantungan P-8). Pabrik konteks hidup di domain pemilik dokumen.
 */
final readonly class PostingContext {
    public const VARIANT_NORMAL = 'normal';
    public const VARIANT_RETURN = 'return';

    /**
     * @param  array<string, float|int|string>  $amounts  jumlah bernama, mis. `['total' => 1500000.0, 'stock_total' => 0]`
     * @param  array<string, mixed>  $flags  mis. `['is_return' => true]`
     * @param  array<string, string>  $masterAccounts  peta peran => `accounts.id` dari konfigurasi master
     * @param  list<LineAttributes>  $lines  baris beratribut barang; kosong untuk dokumen tanpa barang
     * @param  array{type: string, id: string}|null  $party
     * @param  list<TaxComponentLine>  $taxComponents  komponen pajak invoice dari nilai tersimpan (Finance Fase 3); kosong = bentuk lama
     * @param  array{type: string, id: string}|null  $guardDocument  dokumen yang statusnya diperiksa guard cancel (default
     *                                                               sumber); mis. disposal aset memakai Sales Invoice
     */
    public function __construct(
        public PostingDocumentType $documentType,
        public string $sourceType,
        public string $sourceId,
        public CarbonInterface $transactionDate,
        public ?string $branchId,
        public array $amounts,
        public array $flags = [],
        public array $masterAccounts = [],
        public array $lines = [],
        public ?array $party = null,
        public ?string $description = null,
        public ?array $guardDocument = null,
        public array $ruleDocumentTypes = [],
        public array $taxComponents = [],
    ) {}

    /**
     * Tipe dokumen untuk mencocokkan kolom `document_type` aturan akun bersyarat bagi peran ini; default `documentType`.
     * `ruleDocumentTypes` (peta peran => tipe) dipakai mis. oleh pelepasan aset agar `revenue`/`discount` di-resolve
     * sebagai Sales Invoice (akun sama dengan jurnal SI sumber).
     */
    public function ruleTypeFor(string $role): PostingDocumentType {
        return $this->ruleDocumentTypes[$role] ?? $this->documentType;
    }

    /**
     * Tipe dokumen yang statusnya diperiksa guard cancel; default sumber (Q-P2-13).
     */
    public function guardType(): string {
        return $this->guardDocument['type'] ?? $this->sourceType;
    }

    public function guardId(): string {
        return (string) ($this->guardDocument['id'] ?? $this->sourceId);
    }

    public function isReturn(): bool {
        return (bool) ($this->flags['is_return'] ?? false);
    }

    /**
     * Varian dokumen untuk aturan akun bersyarat (Requirement 12.1): `return` bila berbendera `is_return`.
     */
    public function variant(): string {
        return $this->isReturn() ? self::VARIANT_RETURN : self::VARIANT_NORMAL;
    }

    public function amount(string $name): float {
        return (float) ($this->amounts[$name] ?? 0);
    }

    public function flag(string $name, mixed $default = null): mixed {
        return $this->flags[$name] ?? $default;
    }
}
