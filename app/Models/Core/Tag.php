<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tag extends Model {
  use HasUlids, SoftDeletes, HasFactory;
  protected $guarded       = ["id"];
  public    $translateKey  = 'core.tag';
  protected $configColumns = [
    'name'        => [
      'show'  => true,
      'order' => 0,
    ],
    'description' => [
      'show'  => true,
      'order' => 1,
    ],
    'tagMorphs',
    'logs',
  ];

  public function tagMorphs() {
    return $this->morphMany(Taggable::class, "taggable");
  }

  public function logs() {
    return $this->morphMany(Log::class, 'loggable');
  }
}
