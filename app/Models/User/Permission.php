<?php

namespace App\Models\User;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Permission extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'permissions'        => Json::class,
        'is_submitable'      => 'boolean',
        'allow_only_creator' => 'boolean',
    ];
    protected $appends             = ['translateKey'];
    protected array $configColumns = [
        'translateKey' => [
            'dependsOn' => ['model'],
        ],
        'model' => [
            'linkable' => true,
        ],
    ];

    public static function templateLink() {
        return '<title>:name</title><b>:name</b><br/><span>:module</span>';
    }

    protected function getTranslateKeyAttribute() {
        $model = $this->model;
        if (! is_string($model) || ! class_exists($model)) {
            return null;
        }

        return (new $model)->translateKey;
    }
}
