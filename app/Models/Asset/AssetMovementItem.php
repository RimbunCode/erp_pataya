<?php

namespace App\Models\Asset;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMovementItem extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'quantity' => 'float',
    ];
    protected array $configColumns = [
        'asset',
    ];

    public static function templateLink() {
        return ':asset';
    }

    public function assetMovement(): BelongsTo {
        return $this->belongsTo(AssetMovement::class);
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function sourceLocation(): BelongsTo {
        return $this->belongsTo(AssetLocation::class, 'source_location_id');
    }

    public function targetLocation(): BelongsTo {
        return $this->belongsTo(AssetLocation::class, 'target_location_id');
    }

    public function fromCustodian(): BelongsTo {
        return $this->belongsTo(User::class, 'from_custodian_id');
    }

    public function toCustodian(): BelongsTo {
        return $this->belongsTo(User::class, 'to_custodian_id');
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(Customer::class);
    }

    public function customerBranch(): BelongsTo {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }
}
