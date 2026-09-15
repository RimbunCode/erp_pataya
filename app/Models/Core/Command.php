<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Command extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'route_params' => Json::class,
        'meta'         => Json::class,
    ];

    public static function templateLink() {
        return ':title';
    }
}
