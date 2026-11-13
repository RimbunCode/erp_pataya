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
        ];
    }
}
