<?php

namespace App\Models\Core;

use App\Models\Model;

class Currency extends Model {
  protected $primaryKey    = 'code';
  public    $incrementing  = false;
  protected $keyType       = 'string';
  protected $guarded       = [];
  public    $translateKey  = 'core.currency';
  protected $configColumns = [
    'code' => [
      'show'  => true,
      'order' => 0,
    ],
    'name' => [
      'show'  => true,
      'order' => 1,
    ],
  ];

  public static function templateLink() {
    return ":name <span class='uppercase'>(:code)</span>";
  }

  public static function convertMoney(float $amount, float $exchangeRate = 1) {
    return $amount * $exchangeRate;
  }
}
