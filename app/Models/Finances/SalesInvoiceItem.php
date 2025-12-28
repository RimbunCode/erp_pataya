<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoiceItem extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];
}
