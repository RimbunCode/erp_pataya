<?php

namespace App\Enums;

/**
 * Tipe kurs pada master kurs (Finance Fase 4, Requirement 1.1). Kebijakan pemakaian per tipe (D-16): `transaction`
 * untuk invoice dan pembayaran, `closing` untuk revaluasi akhir periode (Fase 6); tipe lain tersedia sebagai data.
 */
enum RateType: string {
    case Spot        = 'spot';
    case Transaction = 'transaction';
    case Closing     = 'closing';
    case Contract    = 'contract';
    case Historical  = 'historical';

    /** @return list<string> */
    public static function values(): array {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }
}
