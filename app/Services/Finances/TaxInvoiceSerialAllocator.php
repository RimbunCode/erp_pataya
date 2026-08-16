<?php

namespace App\Services\Finances;

use App\Models\Core\Preference;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Alokasikan nomor seri Faktur Pajak Keluaran (SalesInvoice) dari range yang
 * sudah dikonfigurasi admin di Preference (tax_invoice_serial_range_start/end),
 * BUKAN generate bebas -- DJP yang mengalokasikan range nomor seri ke PKP,
 * sistem hanya boleh memakai nomor di dalam range tsb (Requirement 7.3).
 *
 * Format nomor seri: 2 digit kode transaksi + 1 digit kode status ('0' = normal,
 * '1' = pengganti) + 13 digit serial, mis. 010.000-26.00000001.
 */
class TaxInvoiceSerialAllocator {
    /**
     * Kode transaksi Faktur Pajak (2 digit pertama nomor seri), per PER-03/PJ/2022.
     * Lihat lang/{id,en}/finances/taxInvoice.php untuk label tiap kode.
     *
     * @var array<int, string>
     */
    public const array TRANSACTION_CODES = ['01', '02', '03', '04', '07', '08', '09', '10'];

    public function nextSerial(string $transactionCode, string $statusCode = '0'): string {
        if (! \in_array($transactionCode, self::TRANSACTION_CODES, true)) {
            throw ValidationException::withMessages([
                'tax_invoice_transaction_code' => 'Kode transaksi Faktur Pajak tidak valid.',
            ]);
        }

        return DB::transaction(function () use ($transactionCode, $statusCode) {
            $rangeStart   = Preference::where('key', 'tax_invoice_serial_range_start')->lockForUpdate()->value('value');
            $rangeEnd     = Preference::where('key', 'tax_invoice_serial_range_end')->value('value');
            $lastUsedPref = Preference::where('key', 'tax_invoice_serial_last_used')->lockForUpdate()->first();

            // 0 = sentinel "belum dikonfigurasi" (preferences.value NOT NULL, tidak bisa
            // pakai null sebagai sentinel) -- range asli DJP selalu mulai dari angka positif.
            if ($rangeStart === null || $rangeEnd === null || (int) $rangeStart <= 0 || (int) $rangeEnd <= 0) {
                throw ValidationException::withMessages([
                    'tax_invoice_serial_number' => 'Range nomor seri Faktur Pajak belum dikonfigurasi. Hubungi admin untuk mengisi tax_invoice_serial_range_start/end di Preferences.',
                ]);
            }

            $lastUsed = (int) ($lastUsedPref?->value ?? 0);
            $next     = max($lastUsed + 1, (int) $rangeStart);

            if ($next > (int) $rangeEnd) {
                throw ValidationException::withMessages([
                    'tax_invoice_serial_number' => 'Range nomor seri Faktur Pajak yang dialokasikan sudah habis. Hubungi admin untuk alokasi range baru dari DJP.',
                ]);
            }

            $lastUsedPref?->update(['value' => $next]) ?? Preference::create(['key' => 'tax_invoice_serial_last_used', 'value' => $next]);

            return \sprintf(
                '%s%s.%013d',
                $transactionCode,
                $statusCode,
                $next,
            );
        });
    }
}
