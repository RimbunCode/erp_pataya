<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Currency extends Model {
  /** @use HasFactory<\Database\Factories\Core\CurrencyFactory> */
  use HasFactory, HasUlids;
}
