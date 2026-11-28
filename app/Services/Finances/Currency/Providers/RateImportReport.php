<?php

namespace App\Services\Finances\Currency\Providers;

/**
 * Laporan pencatatan kurs per baris (Finance Fase 4, Requirement 1.4): jumlah dibuat, diubah, tidak berubah (idempoten),
 * dan galat per baris. `$errors` berisi `['line' => nomor baris, 'message' => pesan]`, dibatasi `MAX_ERRORS` entri agar
 * berkas dengan jutaan baris rusak tidak menghabiskan memori; sisanya hanya dihitung di `$omittedErrors`.
 */
final class RateImportReport {
    public const MAX_ERRORS = 1000;

    public int $created   = 0;
    public int $updated   = 0;
    public int $unchanged = 0;

    /** Jumlah galat tambahan di luar `MAX_ERRORS` yang tidak dirinci. */
    public int $omittedErrors = 0;

    /** @var list<array{line: int, message: string}> */
    public array $errors = [];

    public function addError(int $line, string $message): void {
        if (\count($this->errors) >= self::MAX_ERRORS) {
            $this->omittedErrors++;

            return;
        }

        $this->errors[] = ['line' => $line, 'message' => $message];
    }

    /** Apakah daftar galat rinci sudah penuh (`MAX_ERRORS`); galat berikutnya hanya dihitung di `$omittedErrors`. */
    public function isFull(): bool {
        return \count($this->errors) >= self::MAX_ERRORS;
    }

    public function hasErrors(): bool {
        return $this->errors !== [] || $this->omittedErrors > 0;
    }

    /** Total galat termasuk yang tidak dirinci. */
    public function errorCount(): int {
        return \count($this->errors) + $this->omittedErrors;
    }
}
