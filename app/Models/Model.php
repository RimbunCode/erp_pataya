<?php

namespace App\Models;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;

class Model extends EloquentModel {
  use LinkModel;
}
