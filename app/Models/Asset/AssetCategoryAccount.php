<?php

namespace App\Models\Asset;

use App\Models\Core\Branch;
use App\Models\Finances\Account;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetCategoryAccount extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':assetCategory.category_name - :branch.name';
    }

    public function assetCategory(): BelongsTo {
        return $this->belongsTo(AssetCategory::class);
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }

    public function fixedAssetAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'fixed_asset_account_id');
    }

    public function accumulatedDepreciationAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'accumulated_depreciation_account_id');
    }

    public function depreciationExpenseAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'depreciation_expense_account_id');
    }

    public function capitalWorkInProgressAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'capital_work_in_progress_account_id');
    }

    public function gainLossDisposalAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'gain_loss_disposal_account_id');
    }
}
