<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdditionalCost extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $with    = ['expenseAccount'];

  public function referenceable() {
    return $this->morphTo();
  }

  public function expenseAccount() {
    return $this->belongsTo(Account::class, 'expense_account_id');
  }
  public string $translateKey = 'finances.additionalCost';
}
