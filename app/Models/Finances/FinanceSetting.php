<?php

namespace App\Models\Finances;

use App\Enums\PostingDocumentType;
use App\Models\Core\ModuleSetting;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Validation\Rule;

class FinanceSetting extends ModuleSetting {
    use HasFactory;

    /** Eksekusi posting GL (D-1 opsi C, 2026-11-21): `inline` = dalam transaksi dokumen, `queue` = lewat antrean. */
    public const POSTING_EXECUTION_INLINE = 'inline';

    public const POSTING_EXECUTION_QUEUE = 'queue';
    public const POSTING_EXECUTIONS      = [self::POSTING_EXECUTION_INLINE, self::POSTING_EXECUTION_QUEUE];

    /**
     * Kolom tanggal cutover posting diskon terpisah per jenis dokumen (Finance Fase 2, Requirement 14.1): nama logis
     * `finance_discount_split_from.{type}`. Null = tidak aktif.
     */
    public const DISCOUNT_SPLIT_COLUMNS = [
        'sales_invoice'    => 'discount_split_from_sales_invoice',
        'purchase_invoice' => 'discount_split_from_purchase_invoice',
    ];

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
            'posting_executions'             => 'array',
            'tax_split_from'                 => 'array',
            'company_is_pkp'                 => 'boolean',
            'tax_engine_calc_enabled'        => 'boolean',
        ];
    }

    /**
     * Tanggal cutover posting diskon terpisah (`Y-m-d`) untuk jenis dokumen itu, atau null bila tidak aktif atau jenis
     * dokumen tidak mengenal posting diskon.
     *
     * Kolom sengaja TIDAK memakai cast `date`: halaman setting mengirim atribut apa adanya ke Inertia dan form mengirim
     * ulang seluruh nilai awal saat simpan, sehingga cast akan menghasilkan timestamp ISO yang ditolak `date_format:Y-m-d`.
     */
    public function discountSplitFrom(PostingDocumentType $type): ?string {
        $column = self::DISCOUNT_SPLIT_COLUMNS[$type->value] ?? null;
        $value  = $column === null ? null : $this->{$column};

        return $value === null || $value === '' ? null : substr((string) $value, 0, 10);
    }

    protected static function defaults(): array {
        return [
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
            // PRD D-25 `finance_enforce_fiscal_period`; Q-P1-2: nonaktif dulu, diaktifkan manual.
            'enforce_fiscal_period' => false,
            // D-1 opsi C (2026-11-21): posting GL sinkron untuk semua jenis dokumen; `queue` hanya lewat sakelar.
            'posting_executions' => array_fill_keys(PostingDocumentType::values(), self::POSTING_EXECUTION_INLINE),
            // Requirement 14.1: posting diskon terpisah nonaktif sampai tanggal cutover diisi.
            'discount_split_from_sales_invoice'    => null,
            'discount_split_from_purchase_invoice' => null,
            // Finance Fase 3, Requirement 7.5: cutover pemisahan baris pajak per jenis dokumen; kosong = tidak aktif.
            'tax_split_from' => array_fill_keys(self::TAX_SPLIT_DOCUMENT_TYPES, null),
            // Finance Fase 3, Requirement 7.9 (`finance_company_is_pkp`, default true; menunggu D-12/Q-P3-2).
            'company_is_pkp' => true,
            // Finance Fase 3, Requirement 2.7 (`finance_tax_engine_calc_enabled`): true sejak migrasi Bagian B
            // (`2026_11_27_100001`); baris setting yang dibuat sesudahnya ikut aktif.
            'tax_engine_calc_enabled' => true,
        ];
    }

    public static function rules(): array {
        return [
            // Kolom NOT NULL default 0: null harus ditolak validasi (422), bukan lolos lalu 500.
            'tax_invoice_serial_range_start' => ['sometimes', 'required', 'integer', 'min:0'],
            'tax_invoice_serial_range_end'   => ['sometimes', 'required', 'integer', 'min:0'],
            'tax_invoice_serial_last_used'   => ['sometimes', 'required', 'integer', 'min:0'],
            'enforce_fiscal_period'          => ['sometimes', 'required', 'boolean'],
            // Requirement 14.1: kosong = nonaktif. Validasi peran `discount` terpetakan (14.4) ada di SettingsService.
            'discount_split_from_sales_invoice'    => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'discount_split_from_purchase_invoice' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }

    public static function readonlyColumns(): array {
        // Maintained exclusively by TaxInvoiceSerialAllocator (Requirement 7.6).
        return ['tax_invoice_serial_last_used'];
    }

    /**
     * Kolom yang tidak muncul di halaman Finance Settings dan tidak dapat ditulis lewat form pengaturan umum:
     * `posting_executions` hanya ditulis `PostingExecutionService` (izin `switch_posting_mode`). Setting
     * `posting_modes` dihapus 2026-11-22 (Q-P2-23, opsi A): engine selalu aktif.
     *
     * @return array<string, mixed>
     */
    public static function internalRules(): array {
        return [
            'posting_executions'   => ['required', 'array:' . implode(',', PostingDocumentType::values())],
            'posting_executions.*' => ['string', Rule::in(self::POSTING_EXECUTIONS)],
            // Setting Tax Engine (Fase 3): ditulis hanya oleh service/migrasi khusus, bukan halaman setting umum.
            'tax_split_from'          => ['required', 'array:' . implode(',', self::TAX_SPLIT_DOCUMENT_TYPES)],
            'tax_split_from.*'        => ['nullable', 'date_format:Y-m-d'],
            'company_is_pkp'          => ['required', 'boolean'],
            'tax_engine_calc_enabled' => ['required', 'boolean'],
        ];
    }
}
