<?php

namespace App\Services\Finances\Posting\AccountPanel;

/**
 * Pembantu tanpa pengetahuan model bisnis untuk membaca kolom catatan akun dokumen menjadi `RecordedAccount` (Finance
 * Fase 2, Task 12.4). Hanya membaca; penulisan kolom itu milik `PostedAccountRecorder` (Task 12.1).
 */
final class RecordedColumns {
    /**
     * Akun tercatat untuk satu peran tingkat dokumen; kosong bila kolom null.
     *
     * @return list<RecordedAccount>
     */
    public static function single(?string $role, mixed $accountId): array {
        if ($role === null || $accountId === null || $accountId === '') {
            return [];
        }

        return [new RecordedAccount($role, (string) $accountId)];
    }

    /**
     * Akun tercatat untuk peran per baris: dikelompokkan dari kolom akun tiap baris (jumlah baris per akun). Bila tidak
     * ada baris yang tercatat, memakai kolom header (`$headerAccountId`) bila ada.
     *
     * @param  iterable<mixed>  $lineAccountIds  nilai kolom akun tiap baris dokumen
     * @return list<RecordedAccount>
     */
    public static function perLine(string $role, iterable $lineAccountIds, mixed $headerAccountId = null): array {
        $counts = [];
        foreach ($lineAccountIds as $accountId) {
            if ($accountId !== null && $accountId !== '') {
                $counts[(string) $accountId] = ($counts[(string) $accountId] ?? 0) + 1;
            }
        }

        if ($counts === []) {
            return self::single($role, $headerAccountId);
        }

        $rows = [];
        foreach ($counts as $accountId => $lines) {
            $rows[] = new RecordedAccount($role, (string) $accountId, $lines);
        }

        return $rows;
    }
}
