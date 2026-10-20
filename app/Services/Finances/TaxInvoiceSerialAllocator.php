<?php

namespace App\Services\Finances;

use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaxInvoiceSerialAllocator {
    /** @var array<int, string> */
    public const array TRANSACTION_CODES = ['01', '02', '03', '04', '07', '08', '09', '10'];

    public function __construct(private SettingsService $settings) {}

    public function nextSerial(string $transactionCode, string $statusCode = '0'): string {
        if (! in_array($transactionCode, self::TRANSACTION_CODES, true)) {
            throw ValidationException::withMessages([
                'tax_invoice_transaction_code' => 'Kode transaksi Faktur Pajak tidak valid.',
            ]);
        }

        return DB::transaction(function () use ($transactionCode, $statusCode): string {
            /** @var FinanceSetting $setting */
            $setting    = $this->settings->lockedCurrent(FinanceSetting::class);
            $rangeStart = (int) $setting->tax_invoice_serial_range_start;
            $rangeEnd   = (int) $setting->tax_invoice_serial_range_end;
            $lastUsed   = (int) $setting->tax_invoice_serial_last_used;

            if ($rangeStart <= 0 || $rangeEnd <= 0) {
                throw ValidationException::withMessages([
                    'tax_invoice_serial_number' => __('finances/setting.tax_invoice.range_not_configured'),
                ]);
            }

            $next = max($lastUsed + 1, $rangeStart);
            if ($next > $rangeEnd) {
                throw ValidationException::withMessages([
                    'tax_invoice_serial_number' => __('finances/setting.tax_invoice.range_exhausted'),
                ]);
            }

            $this->settings->advanceTaxInvoiceSerial($setting, $next);

            return sprintf('%s%s.%013d', $transactionCode, $statusCode, $next);
        });
    }
}
