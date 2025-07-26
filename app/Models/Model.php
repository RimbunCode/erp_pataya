<?php

namespace App\Models;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Model as EloquentModel;

#[ObservedBy([\App\Observers\ModelObserver::class])]
class Model extends EloquentModel {
  use LinkModel;
}
