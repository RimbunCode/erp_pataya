<?php

namespace App\Http\Controllers\Finances;

use App\Enums\RateType;
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
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman master Kurs (Finance Fase 4, Requirement 1.5, 11.4): daftar, tambah/koreksi manual, dan impor CSV.
 *
 * Izin `ExchangeRate`: `select` (daftar), `write` (tambah dan koreksi), `import` (impor CSV). Penulisan hanya lewat
 * penyedia kurs (`ManualProvider`/`CsvImportProvider`), yang sendiri TIDAK memeriksa izin; pemeriksaan ada di
 * konstruktor kelas dasar lewat `enforcePermission()`. Nama metode sengaja bukan `store`/`update`/`destroy` karena izin
 * `create`/`delete` tidak ada pada model ini. Kurs tidak dapat dihapus lewat halaman ini.
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
            default => parent::enforcePermission($method),
        };
    }

    public function index(Request $request): Response {
        $this->setBreadcrumbs();
        ExchangeRate::dataTable($request);

        return Inertia::render('Finances/ExchangeRates/Index', [
            'canWrite'      => $this->hasPermission('write'),
            'canImport'     => $this->hasPermission('import'),
            'rateTypes'     => RateType::values(),
            'importMaxMb'   => CsvImportProvider::MAX_BYTES / 1024 / 1024,
            'importColumns' => CsvImportProvider::COLUMNS,
        ]);
    }

    /**
     * Tambah kurs. Bila pasangan, tipe, dan tanggal sudah ada, nilainya dikoreksi hanya bila belum dirujuk transaksi
     * (Requirement 1.3); kurs identik tidak berubah.
     */
    public function save(ExchangeRateRequest $request, ManualProvider $provider): RedirectResponse {
        $result = $this->record($provider, $request->validated(), $request);

        return back()->with('success', __('finances/exchangeRate.messages.' . $result));
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

        $report = $provider->importString(
            $content === false ? '' : $content,
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
    private function record(ManualProvider $provider, array $row, Request $request): string {
        try {
            return $provider->store($row, null, $request->user()?->getKey());
        } catch (InvalidExchangeRateException $e) {
            throw ValidationException::withMessages($e->errors);
        } catch (ImmutableRateException $e) {
            throw ValidationException::withMessages(['rate' => $e->getMessage()]);
        }
    }
}
