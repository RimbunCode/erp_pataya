<?php

namespace App\Traits;

use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Tag;
use App\Models\Scopes\DataTableScope;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log as FacadesLog;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * @method static void dataTable(\Illuminate\Http\Request $request)
 * @method void dataTable(\Illuminate\Http\Request $request)
 */
trait DataTable {
  public static function bootDataTable() {
    static::addGlobalScope(new DataTableScope);
  }
  public static function getTableName() {
    return with(new static)->getTable();
  }
  public static function codeRelations() {
    return with(new static)->codeRelations() ?? [];
  }

  /**
   * Jika model ini untuk form yang submitable
   * @var bool
   */
  // protected static bool $is_submitable;
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
    $module = static::$module ?? static::getModule();
    if (!$module) {
      \print_r("\e[39m" . static::class . " \e[91m(Module name not found)" . \PHP_EOL);
      return;
    }
    $tableName = static::getTableName();
    $alias = static::$alias ??
      \ucwords(str_replace(['_', '-'], ' ', $tableName));
    if (static::$is_submitable ?? false) {
      if (!Schema::hasColumns($tableName, ['created_by', 'status'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->string('status')->default('draft');
          $table->foreignUlid('created_by')->references('id')->on('users')->restrictOnDelete();
        });
      }
      FormatingSeries::updateOrCreate([
        'model' => static::class,
      ],  [
        'name' => Str::singular($alias),
        'format' => static::$defaultFormatCode ?? '{iiii}',
        'logs' => [
          static::$defaultFormatCode ?? '{iiii}' => [
            'current' => 0,
            'updated_at' => now()
          ]
        ]
      ]);
    } else {
      if (Schema::hasColumns($tableName, ['created_by', 'status'])) {
        Schema::table($tableName, function (Blueprint $table) {
          $table->dropColumn('created_by');
          $table->dropColumn('status');
        });
      }
    }
    Permission::updateOrCreate([
      'model' => static::class
    ], [
      'module' => $module,
      'name' => $alias,
      'permissions' => (static::$is_submitable ?? false) ? [...static::permissions(), 'submit', 'cancel', 'amend'] : static::permissions(),
      'is_submittable' => (static::$is_submitable ?? false),
    ]);
    print_r("\e[39m" . static::class . " \e[92m(SUCCESS)" . \PHP_EOL);
  }
  public function showDetail() {
    Inertia::share([
      'logs' => Inertia::defer(function () {
        return Log::with('user')
          ->where('loggable_type', static::class)
          ->where('loggable_id', operator: $this->id)
          ->orderByDesc('created_at')
          ->get();
      }, 'logs'),
      'tags' => Inertia::defer(function () {
        return $this->tags()
          ->get(['id', 'name']);
      }, 'tags'),
      'attachments' => Inertia::defer(function () {
        return $this->files()
          ->get(['id', 'name']);
      }, 'attachments')
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
