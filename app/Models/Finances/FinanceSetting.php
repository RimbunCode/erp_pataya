<?php

namespace App\Models\Finances;

use App\Enums\PostingDocumentType;
use App\Models\Core\ModuleSetting;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Validation\Rule;

class FinanceSetting extends ModuleSetting {
    use HasFactory;

    public const POSTING_MODE_OFF    = 'off';
    public const POSTING_MODE_SHADOW = 'shadow';
    public const POSTING_MODE_ON     = 'on';
    public const POSTING_MODES       = [self::POSTING_MODE_OFF, self::POSTING_MODE_SHADOW, self::POSTING_MODE_ON];

    /**
     * Jenis dokumen yang memiliki cutover pemisahan baris pajak (`finance_tax_split_from.{type}`, Requirement 7.5).
     *
     * @var list<string>
     */
    public const TAX_SPLIT_DOCUMENT_TYPES = ['sales_invoice', 'purchase_invoice'];

    public string $translateKey = 'finances.setting';

    // Dedicated module so role profiles in AdministratorSeeder cannot
    // implicitly open this page to non-admin roles (Requirement 9.4).
    // Access is granted explicitly in ModuleSettingPermissionSeeder.
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton'                      => 'boolean',
            'tax_invoice_serial_range_start' => 'integer',
            'tax_invoice_serial_range_end'   => 'integer',
            'tax_invoice_serial_last_used'   => 'integer',
            'enforce_fiscal_period'          => 'boolean',
            'posting_modes'                  => 'array',
            'tax_split_from'                 => 'array',
            'company_is_pkp'                 => 'boolean',
            'tax_engine_calc_enabled'        => 'boolean',
        ];
    }

    protected static function defaults(): array {
        return [
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
            // PRD D-25 `finance_enforce_fiscal_period`; Q-P1-2: nonaktif dulu, diaktifkan manual.
            'enforce_fiscal_period' => false,
            // Finance Fase 2, Requirement 6.1: semua jenis dokumen `off` sampai ada keputusan eksplisit per jenis.
            'posting_modes' => array_fill_keys(PostingDocumentType::values(), self::POSTING_MODE_OFF),
            // Finance Fase 3, Requirement 7.5: cutover pemisahan baris pajak per jenis dokumen; kosong = tidak aktif.
            'tax_split_from' => array_fill_keys(self::TAX_SPLIT_DOCUMENT_TYPES, null),
            // Finance Fase 3, Requirement 7.9 (`finance_company_is_pkp`, default true; menunggu D-12/Q-P3-2).
            'company_is_pkp' => true,
            // Finance Fase 3, Requirement 2.7 (`finance_tax_engine_calc_enabled`): false sampai migrasi Bagian B.
            'tax_engine_calc_enabled' => false,
        ];
    }

    public static function rules(): array {
        return [
            // Kolom NOT NULL default 0: null harus ditolak validasi (422), bukan lolos lalu 500.
            'tax_invoice_serial_range_start' => ['sometimes', 'required', 'integer', 'min:0'],
            'tax_invoice_serial_range_end'   => ['sometimes', 'required', 'integer', 'min:0'],
            'tax_invoice_serial_last_used'   => ['sometimes', 'required', 'integer', 'min:0'],
            'enforce_fiscal_period'          => ['sometimes', 'required', 'boolean'],
        ];
    }

    public static function readonlyColumns(): array {
        // Maintained exclusively by TaxInvoiceSerialAllocator (Requirement 7.6).
        return ['tax_invoice_serial_last_used'];
    }

    /**
     * Kolom yang tidak muncul di halaman Finance Settings dan tidak dapat ditulis lewat form pengaturan umum:
     * `posting_modes` hanya ditulis `PostingModeService` (izin `switch_posting_mode`, Requirement 6.8).
     *
     * @return array<string, mixed>
     */
    public static function internalRules(): array {
        return [
            'posting_modes'   => ['required', 'array:' . implode(',', PostingDocumentType::values())],
            'posting_modes.*' => ['string', Rule::in(self::POSTING_MODES)],
            // Setting Tax Engine (Fase 3): ditulis hanya oleh service/migrasi khusus, bukan halaman setting umum.
            'tax_split_from'          => ['required', 'array:' . implode(',', self::TAX_SPLIT_DOCUMENT_TYPES)],
            'tax_split_from.*'        => ['nullable', 'date_format:Y-m-d'],
            'company_is_pkp'          => ['required', 'boolean'],
            'tax_engine_calc_enabled' => ['required', 'boolean'],
        ];
    }
}
