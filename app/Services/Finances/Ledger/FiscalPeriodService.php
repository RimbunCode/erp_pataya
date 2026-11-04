<?php

namespace App\Services\Finances\Ledger;

use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Models\Core\CoreSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Services\Core\Setting\SettingsService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Tahun dan periode fiskal dasar (Finance Fase 1, Requirement 6). Hanya status `open`/`closed`; penutupan penuh
 * (checklist, jurnal penutup, urutan wajib) adalah Fase 6.
 *
 * "Hari" sebuah jurnal ditentukan dalam zona waktu perusahaan (`CoreSetting.timezone`, default `Asia/Jakarta`;
 * keputusan pemilik produk Q-P1-5, 2026-11-04), bukan zona penyimpanan `transaction_date` (APP_TIMEZONE, UTC).
 * Transaksi 00.30 WIB tanggal 1 (= 17.30 UTC tanggal terakhir bulan sebelumnya) masuk periode bulan WIB. Basis yang
 * sama dipakai pemecahan per hari pada backfill (D-8). Setting dibaca lewat `SettingsService::getForRead()`: tanpa
 * memo (tidak basi di worker/tes yang mengubah setting) dan tanpa efek samping membuat baris singleton
 * `CoreSetting` di dalam transaksi posting; harganya satu query ringan per pemanggilan. Izin `close_period`/`reopen_period` ditegakkan di controller (Task 10.1), bukan di service
 * ini.
 */
final class FiscalPeriodService {
    public function __construct(private readonly SettingsService $settings) {}

    /**
     * Zona waktu perusahaan (`CoreSetting.timezone`); kosong jatuh ke `config('app.timezone')`.
     */
    public function companyTimezone(): string {
        $timezone = $this->settings->getForRead(CoreSetting::class)->timezone;

        return \is_string($timezone) && $timezone !== '' ? $timezone : (string) config('app.timezone');
    }

    /**
     * Tanggal kalender (`Y-m-d`) dari sebuah instan dalam zona waktu perusahaan.
     */
    public function businessDay(CarbonInterface $date): string {
        return $date->copy()->setTimezone($this->companyTimezone())->toDateString();
    }

    /**
     * Periode yang mencakup tanggal itu, atau null bila tidak ada periode terdefinisi.
     *
     * Dengan `$lockForShare` baris periode dibaca ulang dengan kunci bersama (record lock lewat primary key) agar
     * penutupan periode yang bersamaan (`close()` memakai `lockForUpdate`) menunggu posting yang sedang berjalan,
     * dan posting sesudah penutupan melihat status `closed` (P-8).
     */
    public function resolve(CarbonInterface $date, bool $lockForShare = false): ?FiscalPeriod {
        return $this->resolveBusinessDay($this->businessDay($date), $lockForShare);
    }

    /**
     * Pencarian periode untuk hari bisnis yang sudah dihitung (satu konversi zona per pemanggilan publik).
     */
    private function resolveBusinessDay(string $day, bool $lockForShare): ?FiscalPeriod {
        $period = FiscalPeriod::query()
            ->whereDate('start_date', '<=', $day)
            ->whereDate('end_date', '>=', $day)
            ->orderBy('start_date')
            ->first();

        if ($period !== null && $lockForShare) {
            return FiscalPeriod::query()->whereKey($period->getKey())->sharedLock()->first();
        }

        return $period;
    }

    /**
     * @throws ClosedPeriodException bila periode `closed` atau tidak ditemukan
     */
    public function assertOpen(CarbonInterface $date, bool $lockForShare = false): FiscalPeriod {
        $day    = $this->businessDay($date);
        $period = $this->resolveBusinessDay($day, $lockForShare);

        if ($period === null) {
            throw ClosedPeriodException::notDefined($day);
        }
        if (! $period->isOpen()) {
            throw ClosedPeriodException::closed($period->name, $day);
        }

        return $period;
    }

    /**
     * Tahun kalender berisi 12 periode bulanan, semua `open`. Idempoten: tahun yang sudah ada dikembalikan dan
     * periode yang hilang dilengkapi.
     *
     * @throws ValidationException bila rentang tahun tumpang-tindih dengan tahun fiskal lain, atau tahun bernama sama
     *                             sudah ada dengan rentang non-kalender (tidak dilengkapi dengan periode bulanan kalender)
     */
    public function generateYear(int $year): FiscalYear {
        $name  = (string) $year;
        $start = CarbonImmutable::create($year, 1, 1)->startOfDay();
        $end   = CarbonImmutable::create($year, 12, 31)->startOfDay();

        return DB::transaction(function () use ($name, $start, $end, $year): FiscalYear {
            $fiscalYear = FiscalYear::query()->where('name', $name)->first();

            if ($fiscalYear === null) {
                $fiscalYear = $this->createYear($name, $start, $end);
            } elseif ($fiscalYear->start_date->toDateString() !== $start->toDateString() || $fiscalYear->end_date->toDateString() !== $end->toDateString()) {
                throw ValidationException::withMessages(['year' => __('finances/fiscalYear.errors.not_calendar_year', [
                    'name'  => $name,
                    'start' => $fiscalYear->start_date->toDateString(),
                    'end'   => $fiscalYear->end_date->toDateString(),
                ])]);
            }

            for ($month = 1; $month <= 12; $month++) {
                $periodName = sprintf('%d-%02d', $year, $month);
                $monthStart = CarbonImmutable::create($year, $month, 1)->startOfDay();

                if (FiscalPeriod::query()->where('fiscal_year_id', $fiscalYear->id)->where('name', $periodName)->exists()) {
                    continue;
                }

                $this->createPeriod($fiscalYear, $periodName, $monthStart, $monthStart->endOfMonth()->startOfDay());
            }

            return $fiscalYear;
        });
    }

    /**
     * @throws ValidationException bila rentang tidak valid atau tumpang-tindih dengan tahun fiskal lain
     */
    public function createYear(string $name, CarbonInterface $start, CarbonInterface $end): FiscalYear {
        if ($end->toDateString() < $start->toDateString()) {
            throw ValidationException::withMessages(['end_date' => __('finances/fiscalYear.errors.invalid_range')]);
        }

        $overlap = FiscalYear::query()
            ->whereDate('start_date', '<=', $end->toDateString())
            ->whereDate('end_date', '>=', $start->toDateString())
            ->first();
        if ($overlap !== null) {
            throw ValidationException::withMessages(['start_date' => __('finances/fiscalYear.errors.overlap', ['name' => $overlap->name])]);
        }

        return FiscalYear::forceCreate([
            'name'       => $name,
            'start_date' => $start->toDateString(),
            'end_date'   => $end->toDateString(),
            'status'     => FiscalYear::STATUS_OPEN,
        ]);
    }

    /**
     * @throws ValidationException bila rentang tidak valid, di luar tahun fiskalnya, tumpang-tindih, atau nama ganda
     */
    public function createPeriod(FiscalYear $year, string $name, CarbonInterface $start, CarbonInterface $end): FiscalPeriod {
        $startDay = $start->toDateString();
        $endDay   = $end->toDateString();

        if ($endDay < $startDay) {
            throw ValidationException::withMessages(['end_date' => __('finances/fiscalPeriod.errors.invalid_range')]);
        }

        if ($startDay < $year->start_date->toDateString() || $endDay > $year->end_date->toDateString()) {
            throw ValidationException::withMessages(['start_date' => __('finances/fiscalPeriod.errors.outside_year', [
                'year'  => $year->name,
                'start' => $year->start_date->toDateString(),
                'end'   => $year->end_date->toDateString(),
            ])]);
        }

        $overlap = FiscalPeriod::query()
            ->whereDate('start_date', '<=', $endDay)
            ->whereDate('end_date', '>=', $startDay)
            ->first();
        if ($overlap !== null) {
            throw ValidationException::withMessages(['start_date' => __('finances/fiscalPeriod.errors.overlap', ['name' => $overlap->name])]);
        }

        if (FiscalPeriod::query()->where('fiscal_year_id', $year->id)->where('name', $name)->exists()) {
            throw ValidationException::withMessages(['name' => __('finances/fiscalPeriod.errors.duplicate_name', ['name' => $name])]);
        }

        return FiscalPeriod::forceCreate([
            'fiscal_year_id' => $year->id,
            'name'           => $name,
            'start_date'     => $startDay,
            'end_date'       => $endDay,
            'status'         => FiscalPeriod::STATUS_OPEN,
        ]);
    }

    /**
     * Menutup periode: mencatat siapa dan kapan (kolom) serta alasan (log audit, Requirement 14.2).
     * Menutup periode yang sudah tertutup adalah no-op.
     */
    public function close(FiscalPeriod $period, ?string $reason = null): FiscalPeriod {
        return $this->changeStatus($period, FiscalPeriod::STATUS_CLOSED, 'closed', $reason);
    }

    /**
     * Membuka kembali periode. Membuka periode yang sudah terbuka adalah no-op.
     */
    public function open(FiscalPeriod $period, ?string $reason = null): FiscalPeriod {
        return $this->changeStatus($period, FiscalPeriod::STATUS_OPEN, 'reopened', $reason);
    }

    private function changeStatus(FiscalPeriod $period, string $status, string $action, ?string $reason): FiscalPeriod {
        return DB::transaction(function () use ($period, $status, $action, $reason): FiscalPeriod {
            $locked = FiscalPeriod::query()->whereKey($period->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === $status) {
                return $locked;
            }

            $before = ['status' => $locked->status, 'closed_at' => $locked->closed_at?->toIso8601String(), 'closed_by_id' => $locked->closed_by_id];

            $locked->status       = $status;
            $locked->closed_at    = $status === FiscalPeriod::STATUS_CLOSED ? now() : null;
            $locked->closed_by_id = $status === FiscalPeriod::STATUS_CLOSED ? Auth::id() : null;
            $locked->save();

            event(new AuditableModelSaved($locked, $action, $before, [
                'status'       => $locked->status,
                'closed_at'    => $locked->closed_at?->toIso8601String(),
                'closed_by_id' => $locked->closed_by_id,
                'reason'       => $reason,
            ]));

            return $locked;
        });
    }
}
