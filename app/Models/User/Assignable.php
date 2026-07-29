<?php

namespace App\Models\User;

use App\Models\Model;

class Assignable extends Model {
    protected $table        = 'assignables';
    public    $timestamps   = false;
    public    $incrementing = false;
    protected $keyType      = 'string';

    public static function templateLink() {
        return '<title>:name (:type)</title><b>:name</b><br/><span>:type</span>';
    }
}
