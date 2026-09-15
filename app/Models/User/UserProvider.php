<?php

namespace App\Models\User;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class UserProvider extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'attributes' => Json::class,
    ];

    public static function templateLink() {
        return ':provider - :user.name';
    }

    public function user() {
        return $this->belongsTo(User::class);
    }
}
