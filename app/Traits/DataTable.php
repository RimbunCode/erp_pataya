<?php

namespace App\Traits;

use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Log;
use App\Models\Core\ModelConnection;
use App\Models\Core\PrintTemplate;
use App\Models\Core\Tag;
use App\Models\Core\Todo;
use App\Models\User\Permission;
use App\Services\Core\BufferedAttachmentService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

/**
 * @method static void dataTable(\Illuminate\Http\Request $request)
 * @method void dataTable(\Illuminate\Http\Request $request)
 */
trait DataTable {
    use HasExampleData;

    public function initializeDataTable() {
        $this->mergeCasts([
            'have_transactions' => 'boolean',
        ]);
    }

    public static function bootDataTable() {
        self::saved(function ($model) {
            if (! $model->deleted_at) {
                return;
            }
            ModelConnection::where(column: function ($query) use ($model) {
                $query->where(function ($query) use ($model) {
                    $query->where('model_type', \get_class($model));
                    $query->where('model_id', $model->id);
                });
                $query->orWhere(function ($query) use ($model) {

                    $query->where('reference_type', \get_class($model));
                    $query->where('reference_id', $model->id);
                });
            })
                ->update([
                    'deleted_at' => now(),
                ]);
        });

        static::created(function ($model) {
            if (! app()->bound('request')) {
                return;
            }
            // Jangan attach ke entitas attachment itu sendiri. File use DataTable;
            // tanpa guard ini, membuat File saat request punya `files`/`filesId`
            // akan memicu attach → uploadFile → buat File lagi → rekursi tak henti.
            if ($model instanceof File) {
                return;
            }
            // Model bisa opt-out dari auto-attach dengan $skipAttachmentOnCreate = true.
            if (property_exists($model, 'skipAttachmentOnCreate') && $model->skipAttachmentOnCreate) {
                return;
            }
            $request = request();
            if (
                ! $request->hasAny(['buffered_tags', 'buffered_files', 'filesId', 'buffered_assignees'])
                && ! $request->hasFile('files')
            ) {
                return;
            }
            BufferedAttachmentService::attach($model, $request);
        });
    }

    public function fillForUpdate(array $attributes, bool $fillOnly = false) {
        $this->recordLogs();

        $this->fill($attributes);
        if ($fillOnly) {
            return $this;
        }

        if ($this->isDirty()) {
            $this->fireModelEvent('saving', true);
            $this->fireModelEvent('updating', true);
        }

        return $this->save();
    }

    public function logForCreated() {
        if (get_class($this) == Log::class) {
            return;
        }
        $this->loadRelations();
        $keys            = $this->logableFields();
        $this->dataAfter = \array_replace(
            \array_fill_keys($keys, null),
            \array_intersect_key($this->toArray(), array_flip($keys)),
        );
        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->getKey(),
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user created this',
                'id' => ':user telah membuat ini',
            ],
            'data_before' => $this->dataBefore ?? null,
            'data_after'  => $this->dataAfter,
        ]);
    }

    public function logForUpdated() {
        if (get_class($this) == Log::class) {
            return;
        }
        if (! $this->dataBefore) {
            return;
        }
        $this->loadRelations();
        $keys            = $this->logableFields();
        $this->dataAfter = \array_replace(
            \array_fill_keys($keys, null),
            \array_intersect_key($this->toArray(), array_flip($keys)),
        );
        $this->dataBefore = \array_replace(
            \array_fill_keys($keys, null),
            \array_intersect_key($this->dataBefore, array_flip($keys)),
        );

        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->getKey(),
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user updated this',
                'id' => ':user memperbarui ini',
            ],
            'data_before' => $this->dataBefore,
            'data_after'  => $this->dataAfter,
        ]);
    }

    public function logForDeleted() {
        if (get_class($this) == Log::class) {
            return;
        }
        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->getKey(),
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user deleted this',
                'id' => ':user menghapus ini',
            ],
        ]);
    }

    public function logForRestore() {
        if (get_class($this) == Log::class) {
            return;
        }
        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->id,
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user restored this',
                'id' => ':user mengembalikan ini',
            ],
        ]);
    }

    public function logForSubmitted() {
        if (get_class($this) == Log::class) {
            return;
        }

        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->id,
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user submitted this',
                'id' => ':user telah mengajukan ini',
            ],
        ]);
    }

    public function logForCancelled() {
        if (get_class($this) == Log::class) {
            return;
        }
        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->id,
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user canceled this',
                'id' => ':user telah membatalkan',
            ],
        ]);
    }

    public function logForAmended() {
        if (get_class($this) == Log::class) {
            return;
        }
        Log::create([
            'user_id'       => Auth::user()->id,
            'loggable_id'   => $this->id,
            'loggable_type' => get_class($this),
            'activity'      => [
                'en' => ':user amended this',
                'id' => ':user telah mengembalikan ini',
            ],
        ]);
    }

    private array $dataBefore = [];

    private function recordLogs(): void {
        $this->loadRelations();
        $this->dataBefore = $this->toArray();
    }

    protected function getDefaultLogableField(array $except = []) {
        $except = array_merge($except, ['id', 'created_at', 'updated_at']);
        if ($this->exists) {
            $keys = array_keys($this->toArray());
        } else {
            $keysRelations = [];
            foreach (static::loadRelationsOnShow() ?? [] as $key => $value) {
                if (\is_int($key)) {
                    $keysRelations[] = $value;

                    continue;
                }
                $keysRelations[] = $key;
            }
            $keys = array_merge(
                Schema::getColumnListing($this->getTable()),
                array_keys($this->attributesToArray()),
                $keysRelations,
            );
        }

        return array_values(array_diff($keys, $except));
    }

    public function logableFields() {
        return $this->getDefaultLogableField();
    }

    /**
     * Eager load relations on the model.
     *
     * @param  array|string  $relations
     * @return $this
     */
    public function loadRelations($relations = []) {
        $toLoad = static::getRelationKeys(false, $relations);
        $this->load($toLoad);
    }

    /**
     * Berikan nama module untuk model ini
     *
     * @var string
     */
    // protected static string|null $module;
    /**
     * @var string
     */
    // protected static string|null $alias;
    /**
     * Custom permissions for this model
        select,
        read,
        write,
        create,
        delete,
        submit,
        cancel,
        amend,
        print,
        import,
        export,
        share,
     * @return string[]
     */
    final protected static function permissions(): array {
        return [
            'select',
            'read',
            'write',
            'create',
            'delete',
            'import',
            'export',
            'share',
        ];
    }

    /**
     * Permission key tambahan khusus model ini, di luar key standar dari
     * permissions(). Override di model, JANGAN override permissions()
     * itu sendiri (final, agar key standar tidak bisa hilang tak sengaja).
     *
     * @return string[]
     */
    protected static function extraPermissions(): array {
        return [];
    }

    private static function getShortName() {
        return substr(static::class, strrpos(static::class, '\\') + 1);
    }

    private static function getModule() {
        $shortName = static::getShortName();
        // Hapus prefix "App\Models\"
        $trimmed = str_replace('App\\Models\\', '', static::class);

        // Hapus bagian terakhir dari namespace (shortName)
        $list = explode('\\', $trimmed);
        array_pop($list); // Menghapus elemen terakhir

        $module = implode('\\', $list);

        return $module ?: null;
    }

    public static function initPermissions() {
        $tableName = static::getTableName();
        $nameModel = Str::afterLast(static::class, '\\');
        $alias     = static::$alias ??
            \ucwords(str_replace(['_', '-'], ' ', Str::snake($nameModel)));
        $module = static::$module ?? Str::afterLast(Str::beforeLast(static::class, '\\' . $nameModel), '\\');
        if (! $module) {
            \print_r("\e[39m" . static::class . " \e[91m(Module name not found) \e[39m" . \PHP_EOL);

            return;
        }

        // Add is_example column for example data system (Requirement 8.1)
        if (! Schema::hasColumn($tableName, 'is_example')) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->boolean('is_example')->default(false);
                $table->index('is_example');
            });
        }
        if ((static::$is_submitable ?? false) || (static::$generateCodeSeries ?? false)) {
            $formatingSeries = FormatingSeries::where('model', static::class)
                ->withoutGlobalScope('exclude_example_data')
                ->first();
            if (! $formatingSeries) {
                FormatingSeries::create([
                    'model'  => static::class,
                    'name'   => Str::singular($alias),
                    'format' => static::$defaultFormatCode ?? '@[iiii]',
                    'logs'   => [
                        FormatingSeries::generateKeyLogsForInit(static::class, static::$defaultFormatCode ?? '@[iiii]') => [],
                    ],
                ]);
            } else {
                $logs = (array) $formatingSeries->logs;
                $key  = FormatingSeries::generateKeyLogsForInit(static::class, static::$defaultFormatCode ?? '@[iiii]');
                if (! \array_key_exists($key, $logs)) {
                    $logs[$key] = [];
                }
                if (app()->isLocal()) {
                    $formatingSeries->update([
                        'name'   => Str::singular($alias),
                        'format' => static::$defaultFormatCode ?? '@[iiii]',
                        'logs'   => $logs,
                    ]);
                } else {
                    $formatingSeries->update(['logs' => $logs]);
                }
            }
            if (! Schema::hasColumn($tableName, 'code')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->string('code')->unique();
                });
            }
        }
        if (static::$is_submitable ?? false) {
            if (! Schema::hasColumn($tableName, 'branch_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
                });
            }

            if (! Schema::hasColumn($tableName, 'status')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->json('status')->nullable();
                });
            }
            if (! Schema::hasColumn($tableName, 'created_by_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignUlid('created_by_id')->references('id')->on('users')->restrictOnDelete();
                });
            }
            if (! Schema::hasColumn($tableName, 'submitted_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->timestamp('submitted_at')->nullable();
                });
            }
            if (! Schema::hasColumn($tableName, 'canceled_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->timestamp('canceled_at')->nullable();
                });
            }
            if (! Schema::hasColumn($tableName, 'revision_number')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedTinyInteger('revision_number')->default(0);
                });
            }
            if (! Schema::hasColumn($tableName, 'amended_from_id')) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $table->foreignUlid('amended_from_id')->nullable()->references('id')->on($tableName)->nullOnDelete();
                });
            }
            if (! Schema::hasColumn($tableName, 'additional_data')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->json('additional_data')->nullable();
                });
            }
            if (! Schema::hasColumn($tableName, 'submitted_format')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->string('submitted_format')->nullable();
                });
            }

            if (Schema::hasColumn($tableName, 'have_transactions')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('have_transactions');
                });
            }
        } else {
            if (app()->isLocal()) {
                // if (Schema::hasColumn($tableName, 'created_by_id')) {
                //   Schema::table($tableName, function (Blueprint $table) {
                //     $table->dropColumn('created_by_id');
                //   });
                // }
                if (Schema::hasColumn($tableName, 'submitted_at')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('submitted_at');
                    });
                }
                if (Schema::hasColumn($tableName, 'canceled_at')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('canceled_at');
                    });
                }
                if (Schema::hasColumn($tableName, 'revision_number')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('revision_number');
                    });
                }

                if (Schema::hasColumn($tableName, 'amended_from_id')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('amended_from_id');
                    });
                }
                if (Schema::hasColumn($tableName, 'additional_data')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('additional_data');
                    });
                }
                if (Schema::hasColumn($tableName, 'submitted_format')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('submitted_format');
                    });
                }
            }

            if (! Schema::hasColumn($tableName, 'have_transactions')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->boolean('have_transactions')->default(false);
                });
            }
        }
        if (static::$is_tree_view ?? false) {
            if (! Schema::hasColumn($tableName, 'parent_id')) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $table->foreignUlid('parent_id')->nullable()->references('id')->on($tableName)->nullOnDelete();
                });
            }
            if (! Schema::hasColumns($tableName, ['lft', 'rgt', 'depth'])) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedInteger('lft')->default(0);
                    $table->unsignedInteger('rgt')->default(0);
                    $table->unsignedInteger('depth')->default(0);
                    $table->index('lft', 'lft_index');
                    $table->index('rgt', 'rgt_index');
                    $table->index('depth', 'depth_index');
                    $table->index(['depth', 'lft'], 'idx_depth_lft');
                    $table->index(['parent_id', 'lft'], 'idx_parent_lft');
                });
            }
        } else {
            if (app()->isLocal()) {
                if (Schema::hasColumn($tableName, 'parent_id')) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropColumn('parent_id');
                    });
                }
                if (Schema::hasColumns($tableName, ['lft', 'rgt', 'depth'])) {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->dropIndex('lft_index');
                        $table->dropIndex('rgt_index');
                        $table->dropIndex('depth_index');
                        $table->dropIndex('idx_depth_lft');
                        $table->dropIndex('idx_parent_lft');
                        $table->dropColumn(['lft', 'rgt', 'depth']);
                    });
                }
            }
        }

        Permission::withoutGlobalScope('exclude_example_data')
            ->updateOrCreate([
                'model' => static::class,
            ], [
                'module'      => $module,
                'name'        => Str::plural($alias),
                'route'       => Str::plural(Str::camel($nameModel)),
                'permissions' => [
                    ...((static::$is_submitable ?? false) ? [...static::permissions(), 'submit', 'cancel', 'amend', 'print'] : static::permissions()),
                    ...static::extraPermissions(),
                ],
                'is_submitable'      => (static::$is_submitable ?? false),
                'allow_only_creator' => (static::$allow_only_creator ?? static::$is_submitable ?? false),
            ]);
        print_r("\e[39m" . static::class . " \e[92m(SUCCESS) \e[39m" . \PHP_EOL);
    }

    public function showDetail() {
        if (static::$is_submitable ?? false) {
            Inertia::share([
                'prints' => Inertia::defer(
                    fn () => PrintTemplate::where('model', static::class)->get(),
                ),
                'emailTemplates' => Inertia::defer(
                    fn () => EmailTemplate::where('model', static::class)->get(),
                ),
            ]);
        }
        Inertia::share([
            'translateKey' => $this->translateKey ?? null,
            'connections'  => Inertia::defer(
                function () {
                    $data = \collect(
                        ModelConnection::search(static::class, $this->getKey())
                            ->get()
                            ->toArray(),
                    )
                        ->groupBy('reference_type')
                        ->map(function ($connections) {
                            $reference_type = $connections[0]['reference_type'];
                            $model          = new $reference_type;
                            $nameModel      = Str::title(Str::replace('_', ' ', Str::snake(value: $model->getNameClass())));
                            $connections    = $connections->unique('reference_id');

                            return [
                                'reference_type' => $reference_type,
                                'model'          => $nameModel,
                                'count'          => count($connections),
                                'route'          => Str::plural($model->getNameClass()) . '.index',
                                'query'          => [],
                                'items'          => $connections->map(function ($connection) {
                                    $model = new $connection['reference_type'];

                                    return [
                                        ...((array) $connection),
                                        'route' => Str::plural($model->getNameClass()) . '.show',
                                    ];
                                }),
                            ];
                        })
                        ->values();

                    return $data;
                    // return \array_map
                    // ->map(function ($connection) {
                    //   $model = new $connection->reference_type;
                    //   return [
                    //     ...((array) $connection),
                    //     'model' => $model->getNameClass(),
                    //     'route' => Str::plural($model->getNameClass()).".index",
                    //     'query' => []
                    //   ];
                    //   });
                },
            ),
            'logs' => Inertia::defer(
                fn () => Log::with('user')
                    ->where('loggable_type', static::class)
                    ->where('loggable_id', operator: $this->id)
                    ->orderByDesc('created_at')
                    ->get(),
                'logs',
            ),
            'tags' => Inertia::defer(
                fn () => $this->tags()->get(['id', 'name']),
                'tags',
            ),
            'attachments' => Inertia::defer(
                fn () => $this->files()->get(['id', 'name']),
                'attachments',
            ),
            'assignees' => Inertia::defer(
                fn () => Todo::where('reference_type', static::class)
                    ->where('reference_id', $this->id)
                    ->with('allocatedTo:id,type,name')
                    ->get(['id', 'allocated_to_id', 'allocated_to_type', 'status'])
                    ->map(fn ($todo) => [
                        'id'              => $todo->id,
                        'allocated_to_id' => $todo->allocated_to_id,
                        'type'            => $todo->allocated_to_type,
                        'name'            => $todo->allocatedTo?->name,
                        'status'          => $todo->status,
                    ]),
                'assignees',
            ),
        ]);
    }

    public function logs() {
        return $this->morphMany(Log::class, 'loggable');
    }

    public function tags() {
        return $this->morphToMany(Tag::class, 'taggable')
            ->whereNull('taggables.deleted_at');
    }

    public function files() {
        return $this->morphToMany(File::class, 'fileable')
            ->whereNull('fileables.deleted_at');
    }

    public function syncRelationData(string $relation, array $data): void {
        // Pastikan payload relation tersedia, contoh: $data['items'].
        if (! isset($data[$relation]) || ! \is_array($data[$relation])) {
            return;
        }

        $rows = $data[$relation];
        // Ambil id yang valid ULID dari payload untuk menandai record existing.
        $existingIds = array_values(array_filter(
            array_column($rows, 'id'),
            fn ($id) => Ulid::isValid((string) $id),
        ));

        $relationQuery = $this->{$relation}();
        // Jika tidak ada id existing pada payload, hapus semua detail relation.
        // Jika ada, hapus hanya detail yang id-nya tidak ikut terkirim.
        if (empty($existingIds)) {
            $relationQuery->delete();
        } else {
            $relationQuery->whereNotIn('id', $existingIds)->delete();
        }

        // Hook formatter per relation, contoh `fillItemRelations` untuk `items`.
        $fillRelationMethod = 'fill' . Str::studly(Str::singular($relation)) . 'Relations';
        foreach ($rows as $row) {
            if (! \is_array($row)) {
                continue;
            }

            if (method_exists($this, $fillRelationMethod)) {
                $row = $this->{$fillRelationMethod}($row);
            } elseif (method_exists($this, 'fillItemRelations')) {
                $row = $this->fillItemRelations($row);
            }

            // Jika id valid ULID maka update, jika tidak maka create data baru.
            if (isset($row['id']) && Ulid::isValid((string) $row['id'])) {
                $relationQuery->find($row['id'])?->update($row);

                continue;
            }

            $relationQuery->create($row);
        }
    }

    /**
     * Summary of checkPermission
     *
     * @param  string|string[]  $action
     * @return bool
     */
    public function checkPermission($action, int $level = 0) {
        return static::_checkPermission($action, $level);
    }

    /**
     * Summary of _checkPermission
     *
     * @param  string|string[]  $action
     * @return bool
     */
    public static function _checkPermission(array|string $action, int $level = 0) {
        $permissions      = Session::get('permissions');
        $modelPermissions = $permissions[static::class] ?? null;
        $levelPermissions = $modelPermissions[$level] ?? null;
        if ($levelPermissions === null) {
            abort(403);
        }

        $allowed     = false;
        $onlyCreator = false;
        foreach ($levelPermissions as $levelPermission) {
            $check = \is_array($action)
                ? \array_any($action, fn ($value) => $levelPermission['permissions'][$value] ?? false)
                : ($levelPermission['permissions'][$action] ?? false);

            if ($levelPermission['only_creator'] && $check) {
                $allowed     = true;
                $onlyCreator = true;
            } elseif (! $levelPermission['only_creator'] && $check) {
                $allowed     = true;
                $onlyCreator = false;
            }
        }
        if (! $allowed) {
            abort(403);
        }

        return $onlyCreator;
    }
}
