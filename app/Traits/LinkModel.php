<?php

namespace App\Traits;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\Models\Scopes\DataTableScope;
use App\Models\User\Permission;
use Closure;
use Exception;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionClass;
use ReflectionMethod;

trait LinkModel {
  protected static function bootLinkModel() {
    static::addGlobalScope(new DataTableScope);
  }
  /**
   * Jika model ini untuk form yang submitable
   * @var bool
   */
  // protected static bool $is_submitable;
  public function isSubmitable() {
    return static::$is_submitable ?? false;
  }
  protected function getArrayableAppends() {
    $this->appends = array_unique(array_merge(
      $this->appends,
      ['route'],
      \method_exists(static::class, "templateLink") ? ['templateLink'] : []
    ));
    return parent::getArrayableAppends();
  }
  protected function getTemplateLinkAttribute(): string {
    if (!\method_exists(static::class, "templateLink"))
      return "";
    return static::templateLink();
  }
  protected function getRouteAttribute() {
    return Str::plural($this->getNameClass());
  }

  public function getNameClass() {
    return Str::camel(Str::afterLast(static::class, '\\'));
  }

  public static function getTableName() {
    return with(new static)->getTable();
  }

  private static function parseColumnType(array $dataColumn, array $casts) {
    $definition = $dataColumn['type'];
    // Regex:
    // - Group 1: nama tipe (varchar, int, enum, dll)
    // - Group 2: isi di dalam kurung (bisa angka atau opsi enum/set)
    // - Group 3: unsigned (opsional)
    preg_match('/^([a-zA-Z]+)(?:\((.*?)\))?(?:\s+unsigned)?$/i', $definition, $matches);

    $type   = strtolower($matches[1] ?? 'unknown');
    $inside = $matches[2] ?? '';
    $unsigned = str_contains(strtolower($definition), "unsigned");

    $length = 0;
    $precision = 0;
    $scale = 0;
    $options = [];

    if ($inside !== '') {
      if (in_array($type, ["enum", "set"])) {
        // Pecah opsi enum/set jadi array
        preg_match_all("/'([^']*)'/", $inside, $optMatches);
        $options = $optMatches[1] ?? [];
      } elseif (preg_match('/^(\d+)(?:,(\d+))?$/', $inside, $numMatch)) {
        // Numeric (precision, scale)
        $length    = (int)($numMatch[1] ?? 0);
        $precision = $length;
        $scale     = (int)($numMatch[2] ?? 0);
      }
    }
    // Mapping pakai match
    $phpType = match ($type) {
      "int", "tinyint", "smallint", "mediumint", "bigint", "decimal", "float", "double", "real", "year" => "number",
      "varchar", "char", "text", "tinytext", "mediumtext", "longtext", "enum", "set" => "string",
      "date" => "date",
      "datetime", "timestamp" => "datetime",
      "time" => "time",
      "blob", "binary", "varbinary" => "binary",
      default => "mixed"
    };

    $cast = $casts[$dataColumn['name']] ?? null;
    if ($cast) {
      if ($cast == "hashed" || str_starts_with($cast, 'encrypted')) {
        return null;
      } else if (str_starts_with($cast, 'decimal')) {
        $phpType = "number";
      } else if (\in_array($cast, [
        'array',
        'json',
        'collection',
        'boolean',
        'immutable_date',
        'immutable_datetime',
        'date',
        'datetime',
        'timestamp',
        'time',
        'year',
        'integer',
        "decimal",
        "float",
        "double",
        "real",
        'string',
        Json::class,
        FormStatusCast::class
      ])) {
        $phpType = match ($cast) {
          Json::class => "json",
          FormStatusCast::class => "formStatus",
          'integer', "decimal", "float", "double", "real", 'year' => "number",
          'immutable_date', 'date' => "date",
          'immutable_datetime', 'datetime', 'timestamp', => "datetime",
          'time',  => "time",
          default => $cast
        };
      }
    }

    return [
      // "db_type"   => $type,
      'name' => $dataColumn['name'],
      // "length"    => $length,    // alias precision untuk decimal/float
      // "precision" => $precision, // panjang digit total
      // "scale"     => $scale,     // digit setelah koma (0 kalau tidak ada)
      "type"  => $phpType,
      "options"   => $options
    ];
  }

  private static function getColumnConfig(&$columns, $key): array {
    foreach ($columns as $keyCol => $column) {
      if (\is_numeric($keyCol) && $column == $key) {
        unset($columns[$keyCol]);
        return [];
      }
      if (\is_string($keyCol) && $keyCol == $key) {
        if (\is_array($column)) {
          unset($columns[$key]);
          return $column;
        }
        unset($columns[$key]);
        return [];
      }
    }
    return [];
  }
  private static function mergeConfigColumns(array ...$configs) {
    $newConfigs = [];
    foreach ($configs as $config) {
      foreach ($config as $key => $value) {
        $newKey = \is_string($key) ? $key : $value;
        $newValue = is_array($value) ? $value : [];

        $newConfigs[$newKey] = array_merge(($newConfigs[$newKey] ?? []), $newValue);
      }
    }
    return $newConfigs;
  }

  public static function getColumns(...$excepts) {
    $instance = new static();
    $columns = Schema::getColumns($instance->getTable());
    $casts = $instance->getCasts();
    $hidden = [...$instance->getHidden(), ...$instance->getGuarded()];
    $appends = $instance->getAppends();
    $configColumns = static::mergeConfigColumns(
      $instance->defaultConfigColumns ?? [],
      $instance->configColumns ?? [],
    );
    $translateKey = $instance->translateKey ?? null;

    $newColumns = [];

    foreach ($columns as $value) {
      if (in_array($value['name'], $hidden))
        continue;

      $col = static::parseColumnType($value, $casts);
      $config = static::getColumnConfig($configColumns, $value['name']);

      if (isset($config['ignore']) && $config['ignore']) {
        continue;
      }
      if ($col) {
        $newColumns[$col["name"]] = [
          ...$col,
          ...$config,
          'primaryKey' => $instance->getKeyName(),
          'titleTrans' => $translateKey ? ($translateKey . ".columns." . $col['name']) : null
        ];
      }
    }

    foreach ($appends as $value) {
      if (in_array($value, $hidden))
        continue;
      $config = static::getColumnConfig($configColumns, $value);

      if (isset($config['ignore']) && $config['ignore']) {
        continue;
      }
      $newColumns[$value] = [
        "name" => $value,
        "type" => "attribute",
        "sortable" => false,
        'primaryKey' => $instance->getKeyName(),
        'titleTrans' => $translateKey ? $translateKey . ".columns." . $value : null,
        ...$config
      ];
    }

    foreach ($configColumns as $key => $relation) {
      $key = \is_string($key) ? $key : $relation;
      $config = \is_array($relation) ? $relation : [];

      if (! method_exists($instance, $key))
        continue;

      $rel = $instance->$key();
      if (!$rel instanceof Relation) {
        throw new Exception("Relation $key not found");
      }

      $classRelation = \get_class($rel->getRelated());
      $type = "relations";
      if (in_array($classRelation, $excepts)) {
        continue;
      }
      if ($rel instanceof BelongsTo) {
        unset($newColumns[$rel->getForeignKeyName()]);
        $type = "relation";
        $route = $rel->getRelated()->route;
      } else if ($rel instanceof HasOne || $rel instanceof MorphOne) {
        $type = "relation";
      }
      if (isset($config['ignore']) && $config['ignore']) {
        continue;
      }
      $newKey = Str::snake($key);
      $newColumns[$newKey] = [
        "name" => $newKey,
        "type" => $type,
        "nameOfFunction" => $key,
        "related" => $classRelation,
        "route" => isset($route) ? "$route.show" : null,
        'primaryKey' => $rel->getRelated()->getKeyName(),
        'sortable' => false,
        'titleTrans' => $translateKey ? "$translateKey.columns.$newKey" : null,
        "columns" => $classRelation::getColumns(static::class, ...$excepts ?? []),
        ...$config,
      ];
    }

    \usort($newColumns, fn($a, $b) => $a["name"] <=> $b["name"]);

    return $newColumns;
  }
}
