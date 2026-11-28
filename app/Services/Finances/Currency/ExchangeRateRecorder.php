<?php

namespace App\Services\Finances\Currency;

use App\Enums\RateType;
use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ImmutableRateException;
use App\Exceptions\Finances\InvalidExchangeRateException;
use App\Models\Core\Currency;
use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\Providers\RateImportReport;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Validasi dan penulisan baris kurs, dipakai bersama oleh penyedia kurs (Finance Fase 4, Requirement 1.2-1.4).
 *
 * Aturan: `from != to`, kedua kode mata uang ada, tipe dikenal, tanggal `YYYY-MM-DD`, `rate` desimal > 0 dengan paling
 * banyak 8 digit desimal dan di bawah 10^12 (`decimal(20,8)`). Pencatatan idempoten per kunci unik
 * `(from, to, type, date)`: kurs identik dilewati (`unchanged`); kurs berbeda mengubah baris hanya bila belum dirujuk
 * transaksi (Requirement 1.3), selain itu galat.
 */
final class ExchangeRateRecorder {
    public const CREATED          = 'created';
    public const UPDATED          = 'updated';
    public const UNCHANGED        = 'unchanged';
    private const REQUIRED_FIELDS = ['from_currency_code', 'to_currency_code', 'rate_type', 'rate', 'rate_date'];

    /** Batas atas bagian bulat `decimal(20,8)`. */
    private const MAX_INTEGER_DIGITS = 12;

    /** @var array<string, bool> */
    private array $currencyExists = [];

    /**
     * Validasi satu baris dan kembalikan nilai ternormalisasi.
     *
     * @param  array<string, mixed>  $row
     * @return array{from: string, to: string, type: RateType, rate: string, date: string}
     *
     * @throws InvalidExchangeRateException
     */
    public function validate(array $row): array {
        $errors = [];

        foreach (self::REQUIRED_FIELDS as $field) {
            $value = $row[$field] ?? null;
            if ($value === null || (\is_string($value) && trim($value) === '')) {
                $errors[$field] = __('finances/exchangeRate.errors.missing_field', ['field' => $field]);
            }
        }
        if ($errors !== []) {
            throw new InvalidExchangeRateException($errors);
        }

        // Dinormalkan SEBELUM cek `from === to`, kunci duplikat, dan pencarian baris lama: collation MySQL `_ci` dan
        // SQLite membedakan huruf besar/kecil secara berbeda.
        $from = strtoupper(trim((string) $row['from_currency_code']));
        $to   = strtoupper(trim((string) $row['to_currency_code']));
        foreach (['from_currency_code' => $from, 'to_currency_code' => $to] as $field => $code) {
            if (! $this->currencyExists($code)) {
                $errors[$field] = __('finances/exchangeRate.errors.unknown_currency', ['code' => $this->short($code)]);
            }
        }
        if ($from === $to) {
            $errors['to_currency_code'] = __('finances/exchangeRate.errors.same_currency');
        }

        $type = $row['rate_type'] instanceof RateType ? $row['rate_type'] : RateType::tryFrom(trim((string) $row['rate_type']));
        if ($type === null) {
            $errors['rate_type'] = __('finances/exchangeRate.errors.invalid_type', ['type' => $this->short((string) $row['rate_type'])]);
        }

        $date = $this->parseDate($row['rate_date']);
        if ($date === null) {
            $errors['rate_date'] = __('finances/exchangeRate.errors.invalid_date', ['date' => \is_scalar($row['rate_date']) ? $this->short((string) $row['rate_date']) : '']);
        }

        $rate = $this->validateRate($row['rate'], $errors);

        if ($errors !== []) {
            throw new InvalidExchangeRateException($errors);
        }

        return ['from' => $from, 'to' => $to, 'type' => $type, 'rate' => $rate, 'date' => $date];
    }

    /**
     * Mencatat satu baris (create, update bila belum dirujuk, atau lewati bila identik).
     *
     * @param  array<string, mixed>  $row
     * @param  bool  $insertOnly  true = hanya membuat baris baru; kunci yang sudah ada melempar `InvalidExchangeRateException` (`already_exists`)
     * @return self::CREATED|self::UPDATED|self::UNCHANGED
     *
     * @throws InvalidExchangeRateException
     * @throws ImmutableRateException bila kurs sudah dirujuk dan nilainya berbeda
     */
    public function record(array $row, string $source, ?string $sourceRef = null, ?string $createdById = null, bool $insertOnly = false): string {
        $data = $this->validate($row);

        try {
            return $this->write($data, $source, $sourceRef, $createdById, $insertOnly);
        } catch (UniqueConstraintViolationException) {
            if ($insertOnly) {
                throw $this->alreadyExists();
            }

            // Penulis lain menyisipkan kunci yang sama di antara pencarian dan insert: ulangi sebagai jalur "existing".
            return $this->write($data, $source, $sourceRef, $createdById);
        }
    }

    /**
     * @param  array{from: string, to: string, type: RateType, rate: string, date: string}  $data
     * @return self::CREATED|self::UPDATED|self::UNCHANGED
     */
    private function write(array $data, string $source, ?string $sourceRef, ?string $createdById, bool $insertOnly = false): string {
        return DB::transaction(function () use ($data, $source, $sourceRef, $createdById, $insertOnly): string {
            $existing = ExchangeRate::query()
                ->where('from_currency_code', $data['from'])
                ->where('to_currency_code', $data['to'])
                ->where('rate_type', $data['type']->value)
                ->where('rate_date', $data['date'])
                ->lockForUpdate()
                ->first();

            if ($existing !== null && $insertOnly) {
                throw $this->alreadyExists();
            }

            if ($existing === null) {
                (new ExchangeRate)->forceFill([
                    'from_currency_code' => $data['from'],
                    'to_currency_code'   => $data['to'],
                    'rate_type'          => $data['type'],
                    'rate'               => $data['rate'],
                    'rate_date'          => $data['date'],
                    'source'             => $source,
                    'source_ref'         => $sourceRef,
                    'created_by_id'      => $createdById,
                ])->save();

                return self::CREATED;
            }

            if (Decimal::compare($existing->rate, $data['rate']) === 0) {
                return self::UNCHANGED;
            }

            if ($existing->isReferenced()) {
                throw ImmutableRateException::referenced();
            }

            // Koreksi tercatat di audit log dengan nilai lama (pola `TaxRuleVersionService`: event `AuditableModelSaved`).
            $before = $this->auditable($existing);
            $existing->forceFill(['rate' => $data['rate'], 'source' => $source, 'source_ref' => $sourceRef])->save();
            event(new AuditableModelSaved($existing, 'updated', $before, $this->auditable($existing)));

            return self::UPDATED;
        });
    }

    /**
     * Mencatat banyak baris; setiap baris dilaporkan sendiri (baris valid tetap tersimpan walau baris lain galat).
     * Pasangan/tipe/tanggal yang sama lebih dari sekali dalam satu masukan dilaporkan galat pada kemunculan berikutnya.
     *
     * @param  iterable<int, array<string, mixed>>  $rows  kunci = nomor baris sumber
     */
    public function ingest(iterable $rows, string $source, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        $this->currencyExists = [];
        $report               = new RateImportReport;
        $seen                 = [];

        foreach ($rows as $line => $row) {
            try {
                $data = $this->validate($row);
                $key  = implode('|', [$data['from'], $data['to'], $data['type']->value, $data['date']]);
                if (isset($seen[$key])) {
                    $report->addError((int) $line, __('finances/exchangeRate.errors.duplicate_in_file', ['first' => $seen[$key]]));

                    continue;
                }
                $seen[$key] = (int) $line;

                match ($this->record($row, $source, $sourceRef, $createdById)) {
                    self::CREATED => $report->created++,
                    self::UPDATED => $report->updated++,
                    default       => $report->unchanged++,
                };
            } catch (InvalidExchangeRateException $e) {
                $report->addError((int) $line, implode(' ', $e->errors));
            } catch (ImmutableRateException) {
                $report->addError((int) $line, __('finances/exchangeRate.errors.referenced_conflict'));
            } catch (QueryException $e) {
                // Hanya pelanggaran constraint (SQLSTATE 23xxx: FK/unique/not-null) menjadi galat baris; detail SQL tidak
                // dibocorkan ke laporan. Galat lain (koneksi, deadlock, skema) naik agar tidak tertelan diam-diam.
                if (! $this->isConstraintViolation($e)) {
                    throw $e;
                }
                $report->addError((int) $line, __('finances/exchangeRate.errors.database_error'));
            }
        }

        return $report;
    }

    /** Mode insert-only (form Tambah, Requirement 1.5): kunci yang sudah ada ditolak, bukan dikoreksi diam-diam. */
    private function alreadyExists(): InvalidExchangeRateException {
        return new InvalidExchangeRateException(['rate_date' => __('finances/exchangeRate.errors.already_exists')]);
    }

    /** Nilai sel masukan dipotong (maks 50 karakter) sebelum masuk pesan galat agar laporan tidak membengkak. */
    private function short(string $value): string {
        return mb_strlen($value) > 50 ? mb_substr($value, 0, 50) . '…' : $value;
    }

    private function isConstraintViolation(QueryException $e): bool {
        $state = (string) ($e->errorInfo[0] ?? $e->getCode());

        return str_starts_with($state, '23');
    }

    /**
     * @return array<string, mixed>
     */
    private function auditable(ExchangeRate $rate): array {
        return [
            'from_currency_code' => $rate->from_currency_code,
            'to_currency_code'   => $rate->to_currency_code,
            'rate_type'          => $rate->rate_type->value,
            'rate_date'          => $rate->rate_date->toDateString(),
            'rate'               => $rate->rate,
            'source'             => $rate->source,
            'source_ref'         => $rate->source_ref,
        ];
    }

    private function currencyExists(string $code): bool {
        // `isset` salah untuk nilai false: cache hanya hasil "ada" (mata uang yang baru dibuat tidak boleh tetap
        // dianggap tidak ada, dan kode tak dikenal tidak boleh lolos pada kemunculan berikutnya).
        if (($this->currencyExists[$code] ?? false) === true) {
            return true;
        }

        $exists = Currency::query()->withoutGlobalScopes()->whereKey($code)->exists();
        if ($exists) {
            $this->currencyExists[$code] = true;
        }

        return $exists;
    }

    private function parseDate(mixed $value): ?string {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (! \is_string($value)) {
            return null;
        }

        $value = trim($value);

        // Kalender ketat: `YYYY-MM-DD` dan tanggal yang benar-benar ada (mis. 2026-02-30 ditolak).
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts) || ! checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            return null;
        }

        return $value;
    }

    /**
     * @param  array<string, string>  $errors
     */
    private function validateRate(mixed $value, array &$errors): string {
        try {
            $rate = Decimal::normalize(\is_int($value) || \is_float($value) ? $value : (string) $value);
        } catch (\InvalidArgumentException) {
            $errors['rate'] = __('finances/exchangeRate.errors.rate_invalid_format');

            return '0';
        }

        if (str_starts_with($rate, '-') || Decimal::compare($rate, '0') === 0) {
            $errors['rate'] = __('finances/exchangeRate.errors.rate_not_positive');
        } elseif (Decimal::scale($rate) > ExchangeRate::RATE_SCALE) {
            $errors['rate'] = __('finances/exchangeRate.errors.rate_invalid_format');
        } elseif (\strlen(explode('.', $rate)[0]) > self::MAX_INTEGER_DIGITS) {
            $errors['rate'] = __('finances/exchangeRate.errors.rate_out_of_range');
        }

        return $rate;
    }
}
