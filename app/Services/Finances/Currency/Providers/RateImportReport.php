<?php

namespace App\Services\Finances\Currency\Providers;

/**
 * Laporan pencatatan kurs per baris (Finance Fase 4, Requirement 1.4): jumlah dibuat, diubah, tidak berubah (idempoten),
 * dan galat per baris. `$errors` berisi `['line' => nomor baris, 'message' => pesan]`.
 */
final class RateImportReport {
    public int $created   = 0;
    public int $updated   = 0;
    public int $unchanged = 0;

    /** @var list<array{line: int, message: string}> */
    public array $errors = [];

    public function addError(int $line, string $message): void {
        $this->errors[] = ['line' => $line, 'message' => $message];
    }

    public function hasErrors(): bool {
        return $this->errors !== [];
    }
}
