<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Services\Core\Setting\SettingsService;
use App\Traits\DataTable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FormatingSeries extends Model {
    use DataTable, HasUlids;

    protected $table   = 'formating_series';
    protected $guarded = ['id'];
    protected $casts   = [
        'logs' => Json::class,
    ];

    public function getListOfCodeFormats() {
        $now             = Carbon::now()->addMonths(-3);
        $currentBranchId = Session::get('currentBranch');
        $branch          = Branch::find($currentBranchId)->first();
        $codeFormats     = [
            [
                'id'      => 'yyyy',
                'display' => "Year ({$now->translatedFormat('Y')})",
            ],
            [
                'id'      => 'yy',
                'display' => "Year ({$now->translatedFormat('y')})",
            ],
            [
                'id'      => 'mmmm',
                'display' => "Month ({$now->translatedFormat('F')})",
            ],
            [
                'id'      => 'mmm',
                'display' => "Month ({$now->translatedFormat('M')})",
            ],
            [
                'id'      => 'mm',
                'display' => "Month ({$now->translatedFormat('m')})",
            ],
            [
                'id'      => 'branch',
                'display' => "Branch ({$branch->name})",
            ],
        ];
        $model = $this->model;
        with(new $model, function ($objectModel) use (&$codeFormats) {
            if (method_exists($objectModel, 'codeRelations')) {
                $codeRelations = $objectModel->codeRelations() ?? [];
                foreach ($codeRelations as $codeRelation) {
                    $relation      = \explode(':', $codeRelation)[0];
                    $codeFormats[] = [
                        'id'      => $relation,
                        'display' => Str::headline($relation),
                    ];
                }
            }
        });

        return $codeFormats;
    }

    protected array $configColumns = [
        'name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'format' => [
            'show'  => true,
            'order' => 1,
        ],
    ];
    public string $translateKey = 'core.formatingSeries';

    public static function templateLink() {
        return 'Formating: :name';
    }

    private static function getCodeRelations(string $model) {
        $objectModel   = new $model;
        $codeRelations = collect(
            \method_exists($objectModel, 'codeRelations') ?
      $objectModel->codeRelations() : [],
        )->mapWithKeys(function ($value) {
            preg_replace_callback('/^([^:]+):([^\.]+)\.([^\.]+)$/', function ($matches) use (&$code, &$relation, &$key) {
                $code     = $matches[1];
                $relation = $matches[2];
                $key      = $matches[3];
            }, $value);

            return [
                $code => [
                    'relation' => $relation,
                    'key'      => $key,
                ],
            ];
        })->toArray();

        return $codeRelations;
    }

    /**
     * Hanya membuat seri bila belum ada; TIDAK PERNAH menulis pada seri yang sudah ada. Untuk jalur posting
     * (`JournalService`, keputusan A pemilik produk 2026-11-04): menulis ulang `logs` dari bacaan tanpa kunci akan
     * menimpa counter `generate()` yang baru dinaikkan proses lain (kode ganda). Aman dipanggil di dalam transaksi
     * luar, maka pembuatan seri ikut transaksi itu.
     *
     * @param  string  $alias  alias model (dijadikan tunggal untuk `name`)
     */
    public static function ensureExists(string $model, string $alias, string $format): void {
        if (static::where('model', $model)->withoutGlobalScope('exclude_example_data')->exists()) {
            return;
        }

        // `model` unik. `createOrFirst` memberi savepoint, tetapi fallback `first()`-nya adalah consistent read: di
        // dalam transaksi luar (REPEATABLE READ, snapshot sudah ditetapkan oleh `exists()` di atas) ia tidak melihat
        // baris yang baru di-commit proses lain. Maka pelanggaran unik ditangkap: artinya baris sudah ada, dan
        // `generate()` membacanya dengan `lockForUpdate` (current read) sehingga baris itu terlihat.
        try {
            static::query()->createOrFirst(['model' => $model], [
                'name'   => Str::singular($alias),
                'format' => $format,
                'logs'   => [
                    static::generateKeyLogsForInit($model, $format) => [],
                ],
            ]);
        } catch (UniqueConstraintViolationException) {
            return;
        }
    }

    /**
     * Jalur seeding (`DataTable::initPermissions()`): membuat seri bila belum ada; pada seri yang sudah ada
     * melengkapi kunci `logs`, dan pada lingkungan lokal menyamakan nama dan format dengan definisi model (perilaku
     * lama, tidak diubah). JANGAN dipakai di jalur posting: lihat `ensureExists()`.
     *
     * @param  string  $alias  alias model (dijadikan tunggal untuk `name`)
     */
    public static function ensureFor(string $model, string $alias, string $format): void {
        $formatingSeries = static::where('model', $model)
            ->withoutGlobalScope('exclude_example_data')
            ->first();
        if (! $formatingSeries) {
            static::create([
                'model'  => $model,
                'name'   => Str::singular($alias),
                'format' => $format,
                'logs'   => [
                    static::generateKeyLogsForInit($model, $format) => [],
                ],
            ]);

            return;
        }

        $logs = (array) $formatingSeries->logs;
        $key  = static::generateKeyLogsForInit($model, $format);
        if (! \array_key_exists($key, $logs)) {
            $logs[$key] = [];
        }
        if (app()->isLocal()) {
            $formatingSeries->update([
                'name'   => Str::singular($alias),
                'format' => $format,
                'logs'   => $logs,
            ]);
        } else {
            $formatingSeries->update(['logs' => $logs]);
        }
    }

    public static function generateKeyLogsForInit(string $model, string $format) {
        $codeRelations = static::getCodeRelations($model);
        $key           = [];
        preg_replace_callback('/@\[([myi]|(?:\w+))+\]/', function ($matches) use (&$key, $codeRelations) {
            $char = $matches[1];
            if (\in_array($char, ['m', 'i', 'y'])) {
                $key[] = $char;

                return;
            }
            $key[] = $codeRelations[$char]['relation'];
        }, $format);
        sort($key);

        return implode($key);
    }

    public function getKeyLogs(?array &$codeRelations = null) {
        $codeRelations = static::getCodeRelations($this->model);
        $key           = [];
        preg_replace_callback('/@\[([myi]|(?:\w+))+\]/', function ($matches) use (&$key, $codeRelations) {
            $char = $matches[1];
            if (\in_array($char, ['m', 'i', 'y'])) {
                $key[] = $char;

                return;
            }
            $key[] = $codeRelations[$char]['relation'];
        }, $this->format);

        sort($key);

        return implode($key);
    }

    /**
     * Summary of generate
     *
     * @param  Model|array  $data
     * @return string|null
     */
    public static function generate(string $model, mixed $data, bool $isDraft = false): string {
        if ($data instanceof Model && $data->amended_from_id !== null) {
            return $data->code;
        }

        // Counter dibaca-diubah-ditulis: tanpa kunci baris, dua proses
        // bersamaan membaca angka yang sama dan menghasilkan kode ganda.
        return DB::transaction(function () use ($model, $data, $isDraft): string {
            $ref           = FormatingSeries::where('model', $model)->lockForUpdate()->first();
            $codeRelations = [];
            $keyFormat     = $ref->getKeyLogs($codeRelations);

            $refKey = (array) ((array) $ref->logs)[$keyFormat];

            $timezone = app(SettingsService::class)->get(CoreSetting::class)->timezone ?? 'UTC';

            preg_match('/^(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $monthYear);
            preg_match('/^(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $year);
            $now = Carbon::now()->timezone($timezone);

            $selectTime = \count($monthYear) > 0 ? "{$now->month}/{$now->year}" : (\count($year) > 0 ? (string) $now->year : null);
            $selectKey  = $isDraft ? 'draft' : $selectTime ?? 0;

            if (! isset($refKey[$selectKey])) {
                $refKey[$selectKey] = [
                    'current'    => 0,
                    'updated_at' => now()->addDays(-1),
                ];
            }

            $refLatest   = $refKey[$selectKey];
            $lastUpdated = Carbon::parse($refLatest['updated_at']);

            if (\count($monthYear) > 0) {
                if ($now->year > $lastUpdated->year || $now->year >= $lastUpdated->year && $now->month > $lastUpdated->month) {
                    $refLatest['current'] = 1;
                } else {
                    $refLatest['current'] += 1;
                }
            } elseif (\count($year) > 0) {
                if ($now->year > $lastUpdated->year) {
                    $refLatest['current'] = 1;
                } else {
                    $refLatest['current'] += 1;
                }
            } else {
                $refLatest['current'] += 1;
            }

            // Validate that all custom tokens in the format are defined in codeRelations
            preg_match_all('/@\[(.*?)\]/', $ref->format, $tokenMatches);
            $builtInPattern = '/^(i+|yyyy|yy|mmmm|mmm|mm)$/';
            foreach ($tokenMatches[1] as $token) {
                if (preg_match($builtInPattern, $token)) {
                    continue;
                }
                if (! isset($codeRelations[$token])) {
                    throw ValidationException::withMessages([
                        'format' => ["Relation field '@[{$token}]' is not defined in codeRelations() for model {$model}."],
                    ]);
                }
            }

            if (! \is_array($data)) {
                $relations = \array_unique(\array_values(\array_map(fn ($item) => $item['relation'], $codeRelations)));
                $data->load($relations);
                $data = $data->toArray();
            }
            $pattern = '/@\[(.*?)\]/';
            $result  = preg_replace_callback($pattern, function ($matches) use ($isDraft, $codeRelations, $data, $now, $refLatest, $model) {
                $format = $matches[1];
                if ($format[0] == 'i') {
                    $rslt = str_pad($refLatest['current'], \strlen($format), '0', STR_PAD_LEFT);

                    return $isDraft ? "(DRAFT/$rslt)" : $rslt;
                }

                return match ($format) {
                    'yyyy'  => $now->translatedFormat('Y'),
                    'yy'    => $now->translatedFormat('y'),
                    'mmmm'  => $now->translatedFormat('F'),
                    'mmm'   => $now->translatedFormat('M'),
                    'mm'    => $now->translatedFormat('m'),
                    default => (function () use ($data, $codeRelations, $format, $model) {
                        if (! isset($codeRelations[$format])) {
                            throw new \Error("Relation field '@[{$format}]' is not defined in codeRelations() for model {$model}.");
                        }
                        $relation = $codeRelations[$format]['relation'];
                        $key      = $codeRelations[$format]['key'];
                        $value    = $data[$relation][$key] ?? null;
                        if ($value === null) {
                            throw new \Error("Relation '{$relation}.{$key}' could not be resolved for model {$model}. Ensure the relation is loaded and the field exists.");
                        }

                        return $value;
                    })(),
                };
            }, $ref->format);

            $refKey[$selectKey] = [
                'current'    => $refLatest['current'],
                'updated_at' => now(),
            ];
            $logs = [
                ...(array) $ref->logs,
                $keyFormat => $refKey,
            ];

            $ref->fill([
                'logs' => $logs,
            ]);
            $ref->save();

            return $result;
        });
    }
}
