<?php

namespace App\Models\Finances;

use App\Enums\RateType;
use App\Exceptions\Finances\ImmutableRateException;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Kurs bertipe per pasangan mata uang dan tanggal (Finance Fase 4, Requirement 1). Satu baris unik per
 * `(from_currency_code, to_currency_code, rate_type, rate_date)`; `rate` adalah jumlah `to` untuk 1 unit `from`.
 *
 * Seluruh kolom dijaga dari mass assignment: hanya `ExchangeRateService`/penyedia kurs yang menulis (lewat
 * `forceFill`/`forceCreate`) setelah validasi (Requirement 1.2). Kurs yang sudah dirujuk transaksi tidak dapat
 * diubah atau dihapus (Requirement 1.3, `ImmutableRateException`).
 *
 * Penanda "sudah dirujuk" memakai kolom `have_transactions` (disetel saat dokumen merujuk kurs; pengikatan ke
 * dokumen dilakukan Task 4). Hasil kebalikan (`ExchangeRateService::get`) berupa instans yang tidak tersimpan
 * dengan `$inverseOf` terisi; instans itu tidak dapat disimpan (`save()` melempar `LogicException`).
 */
class ExchangeRate extends Model {
    use DataTable, HasUlids;

    public const SOURCE_MANUAL   = 'manual';
    public const SOURCE_IMPORT   = 'import';
    public const SOURCE_PROVIDER = 'provider';

    /** @var list<string> */
    public const SOURCES = [self::SOURCE_MANUAL, self::SOURCE_IMPORT, self::SOURCE_PROVIDER];

    /** Skala `rate` di database (`decimal(20,8)`). */
    public const RATE_SCALE = 8;

    /**
     * Baris sumber bila instans ini hasil kebalikan `1/rate` yang tidak tersimpan (Requirement 2.2); null untuk kurs
     * langsung. Bukan atribut database.
     */
    public ?self $inverseOf = null;

    /** @var list<string> */
    protected $guarded = ['*'];

    public string $translateKey = 'finances.exchangeRate';
    protected $casts            = [
        'rate_type' => RateType::class,
        // Cast hanya untuk MEMBACA (Carbon). Penulisan dinormalkan `Y-m-d` oleh `setRateDateAttribute`, sehingga nilai
        // tersimpan polos tanggal (tanpa jam) di SQLite maupun MySQL dan `where('rate_date', '<=', $day)` serta kunci
        // unik bertepatan dengan tanggal yang sama.
        'rate_date' => 'date:Y-m-d',
        // Sama di SQLite (test) dan MySQL `decimal(20,8)`: selalu string "15500.00000000".
        'rate'              => 'decimal:8',
        'have_transactions' => 'boolean',
    ];

    /**
     * Izin Requirement 1.5: `select`, `read`, `write`, `import` (`import` lewat `extraPermissions`).
     *
     * @return string[]
     */
    protected static function permissions() {
        return [
            'select',
            'read',
            'write',
        ];
    }

    protected static function extraPermissions(): array {
        return ['import'];
    }

    protected $configColumns = [
        'from_currency_code' => [
            'order' => 0,
            'show'  => true,
        ],
        'to_currency_code' => [
            'order' => 1,
            'show'  => true,
        ],
        'rate_type' => [
            'order'      => 2,
            'show'       => true,
            'valueTrans' => 'finances.exchangeRate.columns.rate_type.options',
            'groupable'  => true,
        ],
        'rate' => [
            'order' => 3,
            'type'  => 'numeric',
            'show'  => true,
        ],
        'rate_date' => [
            'order' => 4,
            'show'  => true,
        ],
        'source' => [
            'order'      => 5,
            'show'       => true,
            'valueTrans' => 'finances.exchangeRate.columns.source.options',
            'groupable'  => true,
        ],
        'created_by_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':from_currency_code/:to_currency_code :rate_type :rate_date';
    }

    /**
     * Lookup generik (`ModelController`) wajib memeriksa izin `select`: kurs bukan data master umum.
     */
    public static function lookupRequiresSelectPermission(): bool {
        return true;
    }

    protected static function booted(): void {
        // Hasil kebalikan hanya untuk dibaca; menyimpannya akan membuat baris kurs palsu.
        static::saving(function (self $rate): void {
            if ($rate->isInverse()) {
                throw new \LogicException('An inverse exchange rate result is read-only and cannot be saved.');
            }
        });
        // Requirement 1.3: kurs yang sudah dirujuk tidak diubah atau dihapus. Dibaca dari nilai ASLI baris, sehingga
        // menandai kurs sebagai dirujuk (false -> true) tetap diizinkan.
        static::updating(function (self $rate): void {
            if ($rate->getOriginal('have_transactions')) {
                throw ImmutableRateException::referenced();
            }
        });
        static::deleting(function (self $rate): void {
            if ($rate->getOriginal('have_transactions')) {
                throw ImmutableRateException::referenced();
            }
        });
    }

    /**
     * Menormalkan tanggal kurs ke string `Y-m-d` (Carbon/DateTime memakai `toDateString()`; string dipotong ke 10 karakter
     * pertama bila berbentuk tanggal-jam).
     */
    public function setRateDateAttribute(mixed $value): void {
        if ($value instanceof \DateTimeInterface) {
            $value = $value instanceof CarbonInterface ? $value->toDateString() : $value->format('Y-m-d');
        } elseif (\is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            $value = substr($value, 0, 10);
        }

        $this->attributes['rate_date'] = $value;
    }

    /** Apakah ini hasil kebalikan (`to -> from = 1/rate`) dari baris tersimpan lain (Requirement 2.2). */
    public function isInverse(): bool {
        return $this->inverseOf !== null;
    }

    /** Apakah kurs sudah dirujuk transaksi (immutable, Requirement 1.3). */
    public function isReferenced(): bool {
        return (bool) $this->have_transactions;
    }

    public function canDelete() {
        return ! $this->isReferenced();
    }

    public function fromCurrency(): BelongsTo {
        return $this->belongsTo(Currency::class, 'from_currency_code', 'code');
    }

    public function toCurrency(): BelongsTo {
        return $this->belongsTo(Currency::class, 'to_currency_code', 'code');
    }

    public function createdBy(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
