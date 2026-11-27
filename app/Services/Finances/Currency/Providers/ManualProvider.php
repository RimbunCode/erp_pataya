<?php

namespace App\Services\Finances\Currency\Providers;

use App\Exceptions\Finances\ImmutableRateException;
use App\Exceptions\Finances\InvalidExchangeRateException;
use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\ExchangeRateRecorder;

/**
 * Penyedia kurs input manual dari UI (Finance Fase 4, Requirement 1.4): tanpa jaringan, `source = manual`.
 */
final class ManualProvider implements ExchangeRateProvider {
    public function __construct(private readonly ExchangeRateRecorder $recorder) {}

    public function source(): string {
        return ExchangeRate::SOURCE_MANUAL;
    }

    public function ingest(iterable $rows, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        return $this->recorder->ingest($rows, $this->source(), $sourceRef, $createdById);
    }

    /**
     * Mencatat satu kurs dan melempar bila ditolak (untuk form UI).
     *
     * @param  array<string, mixed>  $row
     * @return ExchangeRateRecorder::CREATED|ExchangeRateRecorder::UPDATED|ExchangeRateRecorder::UNCHANGED
     *
     * @throws InvalidExchangeRateException
     * @throws ImmutableRateException
     */
    public function store(array $row, ?string $sourceRef = null, ?string $createdById = null): string {
        return $this->recorder->record($row, $this->source(), $sourceRef, $createdById);
    }
}
