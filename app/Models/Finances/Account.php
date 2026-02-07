<?php

namespace App\Models\Finances;

use App\Models\Core\Currency;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\TreeView;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Account extends Model {
  use DataTable, HasUlids, SoftDeletes, TreeView;
  protected $guarded = ['id'];
  protected $casts   = [
    'is_group'    => 'boolean',
    'is_disabled' => 'boolean',
    'is_contra'   => 'boolean',
  ];

  protected static function loadRelationsOnShow() {
    return [
      'parent_account',
      'currency',
    ];
  }
  public $keyBreadcrumb = "code";

  public function code(): Attribute {
    return new Attribute(get: function () {
      return "{$this->account_number} - {$this->account_name}";
    });
  }
  protected $appends = ['code'];

  public static function templateLink() {
    return ":account_number - :account_name";
  }
  public    $translateKey  = 'finances.account';
  protected $configColumns = [
    'code'           => [
      'show'   => true,
      'order'  => 0,
      'isLink' => true,
    ],
    'is_group'       => [
      'show'  => true,
      'order' => 1,
    ],
    'parent_account' => [
      'show'  => true,
      'order' => 2,
    ],
    'is_disabled'    => [
      'show'  => true,
      'order' => 3,
    ],
    'account_type'   => [
      'valueTrans' => 'finances.account.columns.account_type.options',
    ],
    'root_type'      => [
      'valueTrans' => 'finances.account.columns.root_type.options',
    ],
    'balance_type'   => [
      'valueTrans' => 'finances.account.columns.balance_type.options',
    ],
    'report_type'    => [
      'valueTrans' => 'finances.account.columns.report_type.options',
    ],

  ];

  public function currency() {
    return $this->belongsTo(Currency::class);
  }

  public function parent_account() {
    return $this->belongsTo(Account::class, 'parent_id');
  }

  public function generalLedgerEntries() {
    return $this->hasMany(GeneralLedger::class, 'account_id');
  }
}
