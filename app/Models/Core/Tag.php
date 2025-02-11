<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tag extends Model {
  use HasUlids, SoftDeletes, HasFactory;
  protected $guarded = ["id"];

  public function tagMorphs() {
    return $this->morphMany(Taggable::class, "taggable");
  }

  public function logs() {
    return $this->morphMany(Log::class, 'loggable');
  }
}
