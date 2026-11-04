<?php

namespace App\Enums;

/**
 * Status jurnal (Finance Fase 1, Requirement 1.1).
 *
 * - Posted: jurnal aktif.
 * - Reversed: sudah dibalik oleh jurnal pembalik (`reversed_by_journal_id`).
 * - Voided: seluruh barisnya di-soft-delete oleh perilaku cancel legacy `Submitable` (Requirement 8.6); dihapus
 *   pada Fase 2 ketika cancel diganti reversal.
 */
enum JournalStatus: string {
    case Posted   = 'posted';
    case Reversed = 'reversed';
    case Voided   = 'voided';
}
