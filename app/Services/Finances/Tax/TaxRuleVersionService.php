<?php

namespace App\Services\Finances\Tax;

use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\InvalidTaxRuleVersionException;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Core\Setting\SettingsService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Siklus hidup versi aturan pajak (Finance Fase 3, Requirement 2): buat draft, ubah draft, salin menjadi versi
 * baru, aktifkan, pensiunkan, hapus draft. Hanya versi `draft` yang dapat diubah atau dihapus; versi
 * `active`/`retired` tidak diedit di tempat (perubahan lewat versi baru dengan tanggal berlaku baru). Satu-satunya
 * perubahan pada versi `active` adalah penutupan `effective_to` saat versi penerus diaktifkan (Requirement 2.3).
 *
 * Izin (`write`/`manage_rule_versions`) ditegakkan di controller, bukan di service ini (pola
 * `PostingProfileService`). Perubahan tercatat lewat `AuditableModelSaved` (Requirement 2.5).
 *
 * Tidak boleh mengimpor model Sales/Purchase/Inventory (P-9).
 */
final class TaxRuleVersionService {
    private const MAX_ROLE_LENGTH = 64;
    private const MAX_DPP_PART    = 65535;
    private const ROLE_PATTERN    = '/^[a-z][a-z0-9_]*$/';
    private const MIGRATED_NOTE   = 'migrated; needs review';
    private const EPOCH           = '1970-01-01';

    /**
     * Atribut yang boleh diberikan pemanggil. Kolom lain (`tax_id`, `version`, `status`) diatur service.
     *
     * @var list<string>
     */
    private const ATTRIBUTES = [
        'effective_from', 'effective_to', 'rate', 'dpp_numerator', 'dpp_denominator', 'rounding_mode',
        'output_role', 'input_role', 'notes', 'created_by_id',
    ];

    /**
     * Membuat versi `draft` berikutnya untuk sebuah pajak.
     *
     * @param  array{effective_from: CarbonInterface|string, effective_to?: CarbonInterface|string|null, rate: float|int|string, dpp_numerator?: int, dpp_denominator?: int, rounding_mode?: string, output_role?: string, input_role?: string, notes?: string|null, created_by_id?: string|null}  $attributes
     *
     * @throws InvalidTaxRuleVersionException
     */
    public function createDraft(Tax|string $tax, array $attributes): TaxRuleVersion {
        $values = $this->normalize($attributes);
        $values['created_by_id'] ??= Auth::id();

        return DB::transaction(function () use ($tax, $values): TaxRuleVersion {
            $locked = $this->lockTax($tax);

            $version = TaxRuleVersion::forceCreate([
                ...$values,
                'tax_id'  => $locked->getKey(),
                'version' => $this->nextVersionNumber($locked),
                'status'  => TaxRuleVersion::STATUS_DRAFT,
            ]);

            // Audit `created` dipancarkan trait DataTable saat model dibuat; mengirimnya lagi menggandakan log.
            $this->flushResolver();

            return $version->refresh();
        });
    }

    /**
     * Mengubah versi `draft`. Hanya atribut yang disebut yang berubah.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function updateDraft(TaxRuleVersion $version, array $attributes): TaxRuleVersion {
        return DB::transaction(function () use ($version, $attributes): TaxRuleVersion {
            $locked = $this->lockDraft($version);
            $before = $this->snapshot($locked);

            $current = array_intersect_key($this->snapshot($locked), array_flip(self::ATTRIBUTES));
            $merged  = $this->normalize([...$current, ...$attributes]);
            $locked->forceFill($merged)->save();

            $this->audit($locked, 'updated', $before, $this->snapshot($locked->refresh()));
            $this->flushResolver();

            return $locked;
        });
    }

    /**
     * Menyalin versi menjadi versi baru berstatus `draft` dengan tanggal berlaku baru (Requirement 2.3). Versi
     * sumber diberi `effective_to` saat salinan diaktifkan.
     *
     * @param  array<string, mixed>  $overrides  atribut yang menggantikan nilai versi sumber (mis. `rate`, `dpp_numerator`)
     */
    public function createNewVersion(TaxRuleVersion $source, CarbonInterface|string $effectiveFrom, CarbonInterface|string|null $effectiveTo = null, array $overrides = []): TaxRuleVersion {
        $copyable = [
            'rate'            => $source->rate,
            'dpp_numerator'   => $source->dpp_numerator,
            'dpp_denominator' => $source->dpp_denominator,
            'rounding_mode'   => $source->rounding_mode,
            'output_role'     => $source->output_role,
            'input_role'      => $source->input_role,
            'notes'           => $source->notes,
        ];

        return $this->createDraft($source->tax_id, [
            ...$copyable,
            ...$overrides,
            'effective_from' => $effectiveFrom,
            'effective_to'   => $effectiveTo,
        ]);
    }

    /**
     * Mengaktifkan versi `draft`. Seluruh versi pajak yang sama dikunci agar dua aktivasi serentak tidak lolos
     * pemeriksaan tumpang-tindih bersamaan.
     *
     * Bila versi ini menimpa tepat satu versi `active` yang mulai lebih awal (versi penerus, Requirement 2.3),
     * versi lama diberi `effective_to` = sehari sebelum `effective_from` versi ini. Irisan dengan versi aktif lain
     * ditolak (Requirement 2.2), begitu juga irisan yang meninggalkan celah tanpa aturan berlaku.
     *
     * @throws InvalidTaxRuleVersionException
     */
    public function activate(TaxRuleVersion $version): TaxRuleVersion {
        return DB::transaction(function () use ($version): TaxRuleVersion {
            $locked = TaxRuleVersion::query()->whereKey($version->getKey())->lockForUpdate()->firstOrFail();
            if (! $locked->isDraft()) {
                throw InvalidTaxRuleVersionException::notDraft($locked->status);
            }

            $siblings = TaxRuleVersion::query()
                ->where('tax_id', $locked->tax_id)
                ->where('status', TaxRuleVersion::STATUS_ACTIVE)
                ->orderBy('effective_from')
                ->lockForUpdate()
                ->get();

            $this->assertValid($locked);

            $from = $locked->effective_from->toDateString();
            $to   = $locked->effective_to?->toDateString();
            $this->assertDppFactorAllowed((int) $locked->dpp_numerator, (int) $locked->dpp_denominator);

            $overlapping = $siblings->filter(fn (TaxRuleVersion $other): bool => $this->overlaps(
                $from,
                $to,
                $other->effective_from->toDateString(),
                $other->effective_to?->toDateString(),
            ))->values();

            $before = $this->snapshot($locked);

            if ($overlapping->count() > 1) {
                $first = $overlapping->first();
                throw InvalidTaxRuleVersionException::overlap($first->version, $first->effective_from->toDateString(), $first->effective_to?->toDateString());
            }

            if ($overlapping->count() === 1) {
                $other = $overlapping->first();
                $this->assertCanSupersede($other, $from, $to);

                $oldState = $this->snapshot($other);
                $other->forceFill(['effective_to' => CarbonImmutable::parse($from)->subDay()->toDateString()])->save();
                $this->audit($other, 'updated', $oldState, $this->snapshot($other->refresh()));
            }

            $locked->forceFill(['status' => TaxRuleVersion::STATUS_ACTIVE])->save();
            $this->audit($locked, 'activated', $before, $this->snapshot($locked->refresh()));
            $this->flushResolver();

            return $locked;
        });
    }

    /**
     * Memensiunkan versi `active`: tidak lagi dipilih resolver. Riwayat dokumen dan jurnal tidak berubah; tanggal
     * yang tidak lagi dicakup versi aktif lain membuat resolver gagal tertutup (`NoEffectiveTaxRuleException`).
     */
    public function retire(TaxRuleVersion $version): TaxRuleVersion {
        return DB::transaction(function () use ($version): TaxRuleVersion {
            $locked = TaxRuleVersion::query()->whereKey($version->getKey())->lockForUpdate()->firstOrFail();
            if (! $locked->isActive()) {
                throw InvalidTaxRuleVersionException::notActive($locked->status);
            }

            $before = $this->snapshot($locked);
            $locked->forceFill(['status' => TaxRuleVersion::STATUS_RETIRED])->save();
            $this->audit($locked, 'retired', $before, $this->snapshot($locked->refresh()));
            $this->flushResolver();

            return $locked;
        });
    }

    /**
     * Menghapus versi `draft`.
     */
    public function deleteDraft(TaxRuleVersion $version): void {
        DB::transaction(function () use ($version): void {
            $locked = TaxRuleVersion::query()->whereKey($version->getKey())->lockForUpdate()->firstOrFail();
            if (! $locked->isDraft()) {
                throw InvalidTaxRuleVersionException::deleteNotDraft();
            }

            $before = $this->snapshot($locked);
            $locked->delete();
            $this->audit($locked, 'deleted', $before, []);
            $this->flushResolver();
        });
    }

    /**
     * Versi 1 hasil backfill (`finance:init-tax-rules`, Requirement 6.1): berlaku sejak `1970-01-01` tanpa batas
     * akhir, `rate` disalin dari `taxes.rate`, faktor DPP `11/12` (menyamai kolom generated dokumen saat ini),
     * `per_line`, langsung `active`, dan ditandai `needs review`. Idempoten di tingkat pemanggil: tidak membuat
     * versi bila pajak sudah punya versi apa pun (Requirement 6.2).
     */
    public function createInitialVersion(Tax $tax): TaxRuleVersion {
        return DB::transaction(function () use ($tax): TaxRuleVersion {
            $draft = $this->createDraft($tax, [
                'effective_from'  => self::EPOCH,
                'effective_to'    => null,
                'rate'            => $tax->rate,
                'dpp_numerator'   => TaxRuleVersion::LEGACY_DPP_NUMERATOR,
                'dpp_denominator' => TaxRuleVersion::LEGACY_DPP_DENOMINATOR,
                'rounding_mode'   => TaxRuleVersion::ROUNDING_PER_LINE,
                'notes'           => self::MIGRATED_NOTE,
            ]);

            return $this->activate($draft);
        });
    }

    /**
     * Guard F-17 (Requirement 2.7): selama `finance_tax_engine_calc_enabled` false (sebelum Bagian B), versi `active`
     * wajib berfaktor ekuivalen 11/12, karena kolom hitung dokumen invoice mengalikan 11/12 tetap dan aturan data
     * tidak boleh menyimpang dari angka yang benar-benar dihitung dokumen.
     *
     * @throws InvalidTaxRuleVersionException
     */
    public function assertDppFactorAllowed(int $numerator, int $denominator): void {
        if ($this->calcEnabled()) {
            return;
        }

        // Pecahan ekuivalen (22/24) menghasilkan angka yang sama dengan 11/12, jadi dibandingkan silang.
        if ($numerator * TaxRuleVersion::LEGACY_DPP_DENOMINATOR !== TaxRuleVersion::LEGACY_DPP_NUMERATOR * $denominator) {
            throw InvalidTaxRuleVersionException::dppFactorLocked($numerator, $denominator);
        }
    }

    /**
     * Resolver menyimpan cache per request/job; perubahan versi harus terlihat pada pemanggilan berikutnya.
     */
    private function flushResolver(): void {
        app(TaxRuleResolver::class)->flush();
    }

    private function calcEnabled(): bool {
        return (bool) app(SettingsService::class)->get(FinanceSetting::class)->tax_engine_calc_enabled;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{effective_from: string, effective_to: string|null, rate: string, dpp_numerator: int, dpp_denominator: int, rounding_mode: string, output_role: string, input_role: string, notes: string|null, created_by_id: string|null}
     */
    private function normalize(array $attributes): array {
        $unknown = array_diff(array_keys($attributes), self::ATTRIBUTES);
        if ($unknown !== []) {
            throw InvalidTaxRuleVersionException::unknownAttribute((string) reset($unknown));
        }

        $from = $this->date($attributes['effective_from'] ?? throw InvalidTaxRuleVersionException::invalidRange());
        $to   = ($attributes['effective_to'] ?? null) === null ? null : $this->date($attributes['effective_to']);
        $this->assertRange($from, $to);

        $rate = $attributes['rate'] ?? null;
        if (! is_numeric($rate) || (float) $rate < 0 || (float) $rate > 100) {
            throw InvalidTaxRuleVersionException::invalidRate();
        }

        $numerator   = $this->dppPart($attributes['dpp_numerator'] ?? 1);
        $denominator = $this->dppPart($attributes['dpp_denominator'] ?? 1);

        $rounding = (string) ($attributes['rounding_mode'] ?? TaxRuleVersion::ROUNDING_PER_LINE);
        if (! \in_array($rounding, TaxRuleVersion::ROUNDING_MODES, true)) {
            throw InvalidTaxRuleVersionException::invalidRounding($rounding);
        }

        $notes = $attributes['notes'] ?? null;

        return [
            'effective_from'  => $from,
            'effective_to'    => $to,
            'rate'            => number_format((float) $rate, 4, '.', ''),
            'dpp_numerator'   => $numerator,
            'dpp_denominator' => $denominator,
            'rounding_mode'   => $rounding,
            'output_role'     => $this->role($attributes['output_role'] ?? TaxRuleVersion::DEFAULT_OUTPUT_ROLE),
            'input_role'      => $this->role($attributes['input_role'] ?? TaxRuleVersion::DEFAULT_INPUT_ROLE),
            'notes'           => $notes === null || $notes === '' ? null : (string) $notes,
            'created_by_id'   => $attributes['created_by_id'] ?? null,
        ];
    }

    /**
     * Validasi ulang saat aktivasi (rentang dan nilai tidak berubah sejak draft, tetapi aturan dapat berubah).
     */
    private function assertValid(TaxRuleVersion $version): void {
        $this->assertRange($version->effective_from->toDateString(), $version->effective_to?->toDateString());
        $this->dppPart($version->dpp_numerator);
        $this->dppPart($version->dpp_denominator);
    }

    private function dppPart(mixed $value): int {
        if (! \is_int($value) && ! (is_string($value) && ctype_digit($value))) {
            throw InvalidTaxRuleVersionException::invalidDppFactor();
        }

        $int = (int) $value;
        if ($int < 1 || $int > self::MAX_DPP_PART) {
            throw InvalidTaxRuleVersionException::invalidDppFactor();
        }

        return $int;
    }

    private function role(mixed $value): string {
        $role = \is_string($value) ? $value : '';
        if ($role === '' || mb_strlen($role) > self::MAX_ROLE_LENGTH || preg_match(self::ROLE_PATTERN, $role) !== 1) {
            throw InvalidTaxRuleVersionException::invalidRole(\is_string($value) ? $value : '');
        }

        return $role;
    }

    /**
     * Versi baru yang akan menutup versi lama: harus mulai sesudah versi lama mulai (agar tanggal yang sudah
     * di-resolve versi lama tidak berpindah ke tarif baru) dan tidak boleh berakhir lebih awal dari versi lama
     * (selisihnya menjadi celah tanpa aturan berlaku).
     */
    private function assertCanSupersede(TaxRuleVersion $old, string $from, ?string $to): void {
        $oldFrom = $old->effective_from->toDateString();
        $oldTo   = $old->effective_to?->toDateString();

        if ($from <= $oldFrom) {
            throw InvalidTaxRuleVersionException::versionStartsBeforePrevious($oldFrom);
        }

        if ($to !== null && ($oldTo === null || $to < $oldTo)) {
            throw InvalidTaxRuleVersionException::versionEndsBeforePrevious($oldTo);
        }
    }

    private function lockTax(Tax|string $tax): Tax {
        $id = $tax instanceof Tax ? $tax->getKey() : $tax;

        // Termasuk pajak terhapus lunak: dokumen lama masih merujuknya dan memerlukan versi untuk penjelasannya.
        return Tax::query()->withTrashed()->whereKey($id)->lockForUpdate()->first()
            ?? throw InvalidTaxRuleVersionException::unknownTax();
    }

    private function nextVersionNumber(Tax $tax): int {
        return (int) TaxRuleVersion::query()->where('tax_id', $tax->getKey())->max('version') + 1;
    }

    private function lockDraft(TaxRuleVersion $version): TaxRuleVersion {
        $locked = TaxRuleVersion::query()->whereKey($version->getKey())->lockForUpdate()->firstOrFail();
        if (! $locked->isDraft()) {
            throw InvalidTaxRuleVersionException::notDraft($locked->status);
        }

        return $locked;
    }

    private function date(CarbonInterface|string $value): string {
        return $value instanceof CarbonInterface ? $value->toDateString() : CarbonImmutable::parse($value)->toDateString();
    }

    private function assertRange(string $from, ?string $to): void {
        if ($to !== null && $to < $from) {
            throw InvalidTaxRuleVersionException::invalidRange();
        }
    }

    private function overlaps(string $fromA, ?string $toA, string $fromB, ?string $toB): bool {
        return ($toB === null || $fromA <= $toB) && ($toA === null || $fromB <= $toA);
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(TaxRuleVersion $version): array {
        return [
            'tax_id'          => $version->tax_id,
            'version'         => $version->version,
            'status'          => $version->status,
            'effective_from'  => $version->effective_from?->toDateString(),
            'effective_to'    => $version->effective_to?->toDateString(),
            'rate'            => $version->rate,
            'dpp_numerator'   => $version->dpp_numerator,
            'dpp_denominator' => $version->dpp_denominator,
            'rounding_mode'   => $version->rounding_mode,
            'output_role'     => $version->output_role,
            'input_role'      => $version->input_role,
            'notes'           => $version->notes,
            'created_by_id'   => $version->created_by_id,
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(TaxRuleVersion $version, string $action, array $before, array $after): void {
        event(new AuditableModelSaved($version, $action, $before, $after));
    }
}
