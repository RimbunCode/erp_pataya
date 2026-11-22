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
        ];
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
     * `posting_executions` hanya ditulis `PostingExecutionService` (izin `switch_posting_mode`). Setting
     * `posting_modes` dihapus 2026-11-22 (Q-P2-23, opsi A): engine selalu aktif.
     *
     * @return array<string, mixed>
     */
    public static function internalRules(): array {
        return [
            'posting_executions'   => ['required', 'array:' . implode(',', PostingDocumentType::values())],
            'posting_executions.*' => ['string', Rule::in(self::POSTING_EXECUTIONS)],
        ];
    }
}
