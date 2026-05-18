<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;

class Preference extends Model {
    use DataTable;

    public const HIDE_PRIVATE_KEYS_SCOPE = 'hide_private_keys';
    protected const HIDDEN_KEYS          = [];
    protected const HIDDEN_KEY_PATTERNS  = [
        '%password%',
        '%token%',
        '%secret%',
        '%private_key%',
        '%api_key%',
        'mail%',
    ];

    protected static function booted(): void {
        static::addGlobalScope(self::HIDE_PRIVATE_KEYS_SCOPE, function (Builder $builder): void {
            $table = $builder->getModel()->getTable();

            if (\count(self::HIDDEN_KEYS) > 0) {
                $builder->whereNotIn("{$table}.key", self::HIDDEN_KEYS);
            }

            foreach (self::HIDDEN_KEY_PATTERNS as $pattern) {
                $builder->where("{$table}.key", 'not like', $pattern);
            }
        });
    }

    protected $primaryKey = 'key';
    public $incrementing  = false;
    protected $keyType    = 'string';
    protected $guarded    = [];
    protected $casts      = [
        'value' => Json::class,
    ];
    public $translateKey           = 'core.preference';
    protected array $configColumns = [
        'value' => [
            'show' => true,
        ],
    ];
}
