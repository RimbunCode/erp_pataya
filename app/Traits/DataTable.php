<?php

namespace App\Traits;

use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Tag;
use App\Models\Scopes\DataTableScope;
use App\Models\Service\WorkOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Core\FormatingSeriesService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log as FacadesLog;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * @method static void dataTable(\Illuminate\Http\Request $request)
 * @method void dataTable(\Illuminate\Http\Request $request)
 */
trait DataTable {
  protected $defaultConfigColumns = [];

  public function initializeDataTable() {
    $this->mergeCasts([
      'have_transactions' => 'boolean',
    ]);
    $this->defaultConfigColumns = array_merge($this->defaultConfigColumns, [
      'created_at'        => [
        'title' => __('core/form.created_at'),
      ],
      'updated_at'        => [
        'title' => __('core/form.updated_at'),
      ],
      'deleted_at'        => [
        'title' => __('core/form.deleted_at'),
      ],
      'submitted_at'      => [
        'title' => __('core/form.submitted_at'),
      ],
      'logs'              => [
        'title'  => __('core/form.logs'),
        'filter' => [
          'type' => 'comment',
        ],
      ],
      'tags'              => [
        'title' => __('core/form.tags'),
      ],
      'files'             => [
        'title' => __('core/form.files'),
      ],
      'have_transactions' => [
        'ignore' => true,
      ],
    ]);
  }

  public function fillForUpdate(array $attributes, bool $fillOnly = false) {
    $this->recordLogs();
    if ($fillOnly) {
      return $this->fill($attributes);
    }
    $this->fill($attributes);

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
      'loggable_id'   => $this->id,
      'loggable_type' => get_class($this),
      'activity'      => [
        'en' => ':user created this',
        'id' => ':user telah membuat ini',
      ],
      'data_before'   => $this->dataBefore ?? null,
      'data_after'    => $this->dataAfter,
    ]);
  }

  public function logForUpdated() {
    if (get_class($this) == Log::class) {
      return;
    }
    if (!$this->dataBefore) {
      return;
    }
    $this->loadRelations();
    $keys             = $this->logableFields();
    $this->dataAfter  = \array_replace(
      \array_fill_keys($keys, null),
      \array_intersect_key($this->toArray(), array_flip($keys)),
    );
    $this->dataBefore = \array_replace(
      \array_fill_keys($keys, null),
      \array_intersect_key($this->dataBefore, array_flip($keys)),
    );

    Log::create([
      'user_id'       => Auth::user()->id,
      'loggable_id'   => $this->id,
      'loggable_type' => get_class($this),
      'activity'      => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ],
      'data_before'   => $this->dataBefore,
      'data_after'    => $this->dataAfter,
    ]);
  }

  public function logForDeleted() {
    if (get_class($this) == Log::class) {
      return;
    }
    Log::create([
      'user_id'       => Auth::user()->id,
      'loggable_id'   => $this->id,
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
        $this->attributesToArray(),
        $keysRelations,
      );
    }
    return array_values(array_diff($keys, $except));
  }

  protected static function loadRelationsOnShow() {
    return [];
  }

  protected function logableFields() {
    return $this->getDefaultLogableField();
  }

  /**
   * Eager load relations on the model.
   *
   * @param  array|string $relations
   * @return $this
   */
  public function loadRelations($relations = []) {
    $defaultRelations = static::loadRelationsOnShow() ?? [];
    $relations        = array_merge($defaultRelations, is_string($relations) ? [$relations] : ($relations ?? []));

    $toLoad = [];

    foreach ($relations as $key => $relation) {
      $relationName = is_int($key) ? $relation : $key;

      if (!method_exists($this, $relationName)) {
        $toLoad[$key] = $relation;
        continue;
      }

      $result = $this->$relationName();

      if ($result instanceof Relation) {
        $toLoad[$key] = $relation;
      } else {
        $this->setRelation($relationName, $result);
      }
    }
    $this->load($toLoad);
  }

  /**
   * Berikan nama module untuk model ini
   * @var string
   */
  // protected static string|null $module;
  /**
   *
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
  protected static function permissions(): array {
    return [
      'select',
      'read',
      'write',
      'create',
      'delete',
      'print',
      'import',
      'export',
      'share',
    ];
  }

  private static function getShortName() {
    return substr(static::class, strrpos(static::class, '\\') + 1);
  }

  private static function getModule() {
    $shortName = static::getShortName();
    // Hapus prefix "App\Models\"
    $trimmed = str_replace("App\\Models\\", "", static::class);

    // Hapus bagian terakhir dari namespace (shortName)
    $list = explode("\\", $trimmed);
    array_pop($list); // Menghapus elemen terakhir

    $module = join("\\", $list);

    return $module ?: null;
  }

  public static function initPermissions() {
    $tableName = static::getTableName();
    $nameModel = Str::afterLast(static::class, '\\');
    $alias     = static::$alias ??
      \ucwords(str_replace(['_', '-'], ' ', Str::snake($nameModel)));
    $module    = static::$module ?? Str::afterLast(Str::before(static::class, '\\' . $nameModel), "\\");
    if (!$module) {
      \print_r("\e[39m" . static::class . " \e[91m(Module name not found) \e[39m" . \PHP_EOL);
      return;
    }
    if (static::$is_submitable ?? false) {
      if (!Schema::hasColumns($tableName, ['branch_id'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
        });
      }
      if (!Schema::hasColumns($tableName, ['created_by'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->foreignUlid('created_by')->references('id')->on('users')->restrictOnDelete();
          $table->timestamp('submitted_at')->nullable();
        });
      }

      if (!Schema::hasColumns($tableName, ['code'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->string('code')->unique();
        });
      }
      if (!Schema::hasColumns($tableName, ['status'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->string('status')->default('draft');
        });
      }
      if (!Schema::hasColumns($tableName, ['submitted_at'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->timestamp('submitted_at')->nullable();
        });
      }

      if (!Schema::hasColumns($tableName, ['code'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->string('code')->unique();
        });
      }

      if (Schema::hasColumns($tableName, ['have_transactions'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->dropColumn('have_transactions');
        });
      }

      $formatingSeries = FormatingSeries::where('model', static::class)->first();
      if (!$formatingSeries) {
        FormatingSeries::create([
          'model'  => static::class,
          'name'   => Str::singular($alias),
          'format' => static::$defaultFormatCode ?? '@[iiii]',
          'logs'   => [
            (new FormatingSeriesService())->getKeyLogsForInit(static::class, static::$defaultFormatCode ?? '@[iiii]') => [
              'current'    => 0,
              'updated_at' => now(),
            ],
          ],
        ]);
      } else {
        $logs = (array) $formatingSeries->logs;
        $key  = (new FormatingSeriesService())->getKeyLogsForInit(static::class, static::$defaultFormatCode ?? '@[iiii]');
        if (!\array_key_exists($key, $logs)) {
          $logs[$key] = [
            'current'    => 0,
            'updated_at' => now(),
          ];
        }
        $formatingSeries->update([
          'name'   => Str::singular($alias),
          'format' => static::$defaultFormatCode ?? '@[iiii]',
          'logs'   => $logs,
        ]);
      }
    } else {
      if (Schema::hasColumns($tableName, ['branch_id', 'created_by', 'status', "submitted_at"])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->dropColumn('branch_id');
          $table->dropColumn('created_by');
          $table->dropColumn('status');
          $table->dropColumn('submitted_at');
        });
      }

      if (!Schema::hasColumns($tableName, ['have_transactions'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->boolean('have_transactions')->default(false);
        });
      }
    }
    Permission::updateOrCreate([
      'model' => static::class,
    ], [
      'module'        => $module,
      'name'          => Str::plural($alias),
      'route'         => Str::plural(Str::camel($nameModel)),
      'permissions'   => (static::$is_submitable ?? false) ? [...static::permissions(), 'submit', 'cancel', 'amend'] : static::permissions(),
      'is_submitable' => (static::$is_submitable ?? false),
    ]);
    print_r("\e[39m" . static::class . " \e[92m(SUCCESS) \e[39m" . \PHP_EOL);
  }

  public function showDetail() {
    Inertia::share([
      'translateKey' => $this->translateKey ?? null,
      'connections'  => Inertia::defer(function () {

        $data = \collect(ModelConnection::search(static::class, $this->getKey())
          ->get()
          ->toArray())
          ->groupBy('reference_type')
          ->mapWithKeys(function ($connections) {
            $reference_type = $connections[0]["reference_type"];
            $model = new $reference_type;
            return [
              [
                'reference_type' => $reference_type,
                'model'          => Str::title(Str::replace("_", " ", Str::snake($model->getNameClass()))),
                'count'          => count($connections),
                'route'          => Str::plural($model->getNameClass()) . ".index",
                'query'          => [],
                'items'          => $connections->map(function ($connection) {
                  $model = new $connection["reference_type"];
                  return [
                    ...((array) $connection),
                    'route' => Str::plural($model->getNameClass()) . ".show",
                  ];
                }),
              ],
            ];
          });
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
      }),
      'logs'         => Inertia::defer(function () {
        return Log::with('user')
          ->where('loggable_type', static::class)
          ->where('loggable_id', operator: $this->id)
          ->orderByDesc('created_at')
          ->get();
      }, 'logs'),
      'tags'         => Inertia::defer(function () {
        return $this->tags()
          ->get(['id', 'name']);
      }, 'tags'),
      'attachments'  => Inertia::defer(function () {
        return $this->files()
          ->get(['id', 'name']);
      }, 'attachments'),
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
}
