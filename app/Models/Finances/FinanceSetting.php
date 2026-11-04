<?php

namespace App\Models\Finances;

use App\Models\Core\ModuleSetting;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FinanceSetting extends ModuleSetting {
    use HasFactory;

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
        ];
    }

    protected static function defaults(): array {
        return [
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
            // PRD D-25 `finance_enforce_fiscal_period`; Q-P1-2: nonaktif dulu, diaktifkan manual.
            'enforce_fiscal_period' => false,
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
}
