<?php

namespace App\Http\Controllers\Finances;

use App\Enums\RateType;
use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ImmutableRateException;
use App\Exceptions\Finances\InvalidExchangeRateException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\ExchangeRateImportRequest;
use App\Http\Requests\Finances\ExchangeRateRequest;
use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\ExchangeRateRecorder;
use App\Services\Finances\Currency\Providers\CsvImportProvider;
use App\Services\Finances\Currency\Providers\ManualProvider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Halaman master Kurs (Finance Fase 4, Requirement 1.5, 11.4): daftar, tambah/koreksi manual, dan impor CSV.
 *
 * Izin `ExchangeRate`: `select` (daftar), `write` (tambah dan koreksi), `import` (impor CSV), `delete` (hapus kurs yang belum dirujuk). Penulisan hanya lewat
 * penyedia kurs (`ManualProvider`/`CsvImportProvider`), yang sendiri TIDAK memeriksa izin; pemeriksaan ada di
 * konstruktor kelas dasar lewat `enforcePermission()`. Nama metode sengaja bukan `store`/`update`/`destroy` karena izin
 * `create` tidak ada pada model ini dan kelas dasar memetakan `destroy` ke hapus massal.
 *
 * Impor menerima HANYA berkas unggahan (tidak pernah path dari input); isinya dibaca di memori dan `source_ref` berasal
 * dari nama berkas yang disanitasi.
 */
class ExchangeRateController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, ExchangeRate::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'save', 'correct' => 'write',
            'remove' => 'delete',
            default  => parent::enforcePermission($method),
        };
    }

    public function index(Request $request): Response {
        $this->setBreadcrumbs();
        ExchangeRate::dataTable($request);

        return Inertia::render('Finances/ExchangeRates/Index', [
            'canWrite'      => $this->hasPermission('write'),
            'canImport'     => $this->hasPermission('import'),
            'canDelete'     => $this->hasPermission('delete'),
            'rateTypes'     => RateType::values(),
            'importMaxMb'   => CsvImportProvider::MAX_BYTES / 1024 / 1024,
            'importColumns' => CsvImportProvider::COLUMNS,
        ]);
    }

    /**
     * Tambah kurs. Pasangan, tipe, dan tanggal yang sudah ada DITOLAK (keputusan pemilik produk 2026-11-28): nilainya
     * diubah lewat aksi Koreksi. Impor CSV tetap upsert.
     */
    public function save(ExchangeRateRequest $request, ManualProvider $provider): RedirectResponse {
        $data = $request->validated();

        $result = $this->record($provider, $data, $request, insertOnly: true);

        return back()->with('success', __('finances/exchangeRate.messages.' . $result));
    }

    /**
     * Hapus kurs yang belum dirujuk transaksi (keputusan pemilik produk 2026-11-28). Dibaca ulang dengan kunci baris
     * agar status "dirujuk" tidak basi; nilai yang dihapus tercatat di audit log.
     */
    public function remove(ExchangeRate $exchangeRate): RedirectResponse {
        DB::transaction(function () use ($exchangeRate): void {
            $rate = ExchangeRate::query()->whereKey($exchangeRate->getKey())->lockForUpdate()->firstOrFail();
            if ($rate->isReferenced()) {
                throw ValidationException::withMessages(['rate' => __('finances/exchangeRate.errors.immutable_referenced')]);
            }

            $before = [
                'from_currency_code' => $rate->from_currency_code,
                'to_currency_code'   => $rate->to_currency_code,
                'rate_type'          => $rate->rate_type->value,
                'rate_date'          => $rate->rate_date->toDateString(),
                'rate'               => $rate->rate,
                'source'             => $rate->source,
                'source_ref'         => $rate->source_ref,
            ];

            try {
                $rate->delete();
            } catch (ImmutableRateException $e) {
                throw ValidationException::withMessages(['rate' => $e->getMessage()]);
            }
            event(new AuditableModelSaved($rate, 'deleted', $before));
        });

        return back()->with('success', __('finances/exchangeRate.messages.deleted'));
    }

    /**
     * Koreksi nilai kurs yang belum dirujuk. Pasangan, tipe, dan tanggal diambil dari baris pada URL (bukan dari input).
     */
    public function correct(ExchangeRateRequest $request, ExchangeRate $exchangeRate, ManualProvider $provider): RedirectResponse {
        $result = $this->record($provider, [
            'from_currency_code' => $exchangeRate->from_currency_code,
            'to_currency_code'   => $exchangeRate->to_currency_code,
            'rate_type'          => $exchangeRate->rate_type->value,
            'rate_date'          => $exchangeRate->rate_date->toDateString(),
            'rate'               => $request->validated('rate'),
        ], $request);

        return back()->with('success', __('finances/exchangeRate.messages.' . $result));
    }

    /**
     * Impor CSV dari berkas unggahan. Baris valid tersimpan walau baris lain galat; laporan per baris dikirim sebagai
     * flash `importReport`.
     */
    public function import(ExchangeRateImportRequest $request, CsvImportProvider $provider): RedirectResponse {
        $file    = $request->file('file');
        $content = @file_get_contents($file->getRealPath(), false, null, 0, CsvImportProvider::MAX_BYTES + 1);

        if ($content === false) {
            throw ValidationException::withMessages(['file' => __('finances/exchangeRate.errors.csv_unreadable')]);
        }

        $report = $provider->importString(
            $content,
            self::sanitizeSourceRef($file->getClientOriginalName()),
            $request->user()?->getKey(),
        );

        return back()->with('importReport', [
            'created'       => $report->created,
            'updated'       => $report->updated,
            'unchanged'     => $report->unchanged,
            'errors'        => $report->errors,
            'omittedErrors' => $report->omittedErrors,
            'errorCount'    => $report->errorCount(),
        ]);
    }

    /**
     * Nama berkas unggahan menjadi `source_ref`: hanya nama dasar, tanpa karakter kontrol, tanpa awalan yang dibaca
     * spreadsheet sebagai rumus (`=`, `+`, `-`, `@`, tab, CR), UTF-8 valid, dan maksimal 200 karakter.
     */
    public static function sanitizeSourceRef(?string $name): string {
        $name = str_replace('\\', '/', (string) $name);
        $name = basename($name);
        $name = mb_convert_encoding($name, 'UTF-8', 'UTF-8');
        $name = (string) preg_replace('/[\x00-\x1F\x7F\x{0080}-\x{009F}]/u', '', $name);
        $name = ltrim($name, "=+-@ \t\r\n");
        $name = mb_substr($name, 0, 200);

        return $name === '' ? 'import.csv' : $name;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return ExchangeRateRecorder::CREATED|ExchangeRateRecorder::UPDATED|ExchangeRateRecorder::UNCHANGED
     */
    private function record(ManualProvider $provider, array $row, Request $request, bool $insertOnly = false): string {
        try {
            return $provider->store($row, null, $request->user()?->getKey(), $insertOnly);
        } catch (InvalidExchangeRateException $e) {
            throw ValidationException::withMessages($e->errors);
        } catch (ImmutableRateException $e) {
            throw ValidationException::withMessages(['rate' => $e->getMessage()]);
        }
    }

    private function hasPermission(string $action): bool {
        try {
            ExchangeRate::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
