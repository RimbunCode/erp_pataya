<?php

namespace App\Models\Asset;

use App\Enums\AssetOwnershipType;
use App\Enums\AssetType;
use App\Enums\FormStatus;
use App\Events\Asset\AssetScrapped;
use App\Models\Core\Branch;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Model;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Services\Asset\AssetService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use LogicException;

class Asset extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    protected static $service    = AssetService::class;
    public string $formComponent = 'Asset/Assets/Form';
    public string $translateKey  = 'asset.asset';
    protected $guarded           = ['id'];
    protected $casts             = [
        'asset_type'              => AssetType::class,
        'ownership_type'          => AssetOwnershipType::class,
        'calculate_depreciation'  => 'boolean',
        'is_depreciable'          => 'boolean',
        'is_fully_depreciated'    => 'boolean',
        'maintenance_required'    => 'boolean',
        'insurance_comprehensive' => 'boolean',
        'daily_prorata_based'     => 'boolean',
        'purchase_date'           => 'date',
        'available_for_use_date'  => 'date',
        'disposal_date'           => 'date',
        'insurance_start_date'    => 'date',
        'insurance_end_date'      => 'date',
    ];

    public static function templateLink() {
        return '<title>:code - :asset_name</title><b>:code</b><br/><span>:asset_name</span>';
    }

    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'asset_name' => [
            'show'  => true,
            'order' => 1,
        ],
        'assetCategory' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'assetLocation' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'       => true,
            'order'      => 4,
            'valueTrans' => 'status',
        ],
        'gross_purchase_amount' => [
            'show'  => true,
            'order' => 5,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'assetCategory',
            'assetLocation',
            'custodian',
            'ownershipSupplier',
            'ownershipCustomer',
        ];
    }

    public function assetCategory(): BelongsTo {
        return $this->belongsTo(AssetCategory::class);
    }

    public function assetLocation(): BelongsTo {
        return $this->belongsTo(AssetLocation::class);
    }

    public function item(): BelongsTo {
        return $this->belongsTo(Item::class);
    }

    public function custodian(): BelongsTo {
        return $this->belongsTo(User::class, 'custodian_id');
    }

    public function ownershipSupplier(): BelongsTo {
        return $this->belongsTo(Supplier::class, 'ownership_supplier_id');
    }

    public function ownershipCustomer(): BelongsTo {
        return $this->belongsTo(Customer::class, 'ownership_customer_id');
    }

    public function purchaseReceiptItem(): BelongsTo {
        return $this->belongsTo(PurchaseReceiptItem::class);
    }

    public function purchaseInvoiceItem(): BelongsTo {
        return $this->belongsTo(PurchaseInvoiceItem::class);
    }

    public function depreciationSchedules(): HasMany {
        return $this->hasMany(AssetDepreciationSchedule::class);
    }

    /**
     * Resolve the ownership relationship based on ownership_type.
     * NOT a morphTo — manual dispatch because Laravel morph stores FQCN, not enum string.
     */
    public function ownershipEntity(): ?BelongsTo {
        return match ($this->ownership_type) {
            AssetOwnershipType::SUPPLIER => $this->ownershipSupplier(),
            AssetOwnershipType::CUSTOMER => $this->ownershipCustomer(),
            default                      => null,
        };
    }

    /**
     * Cabang Asset diturunkan dari AssetLocation.branch_id.
     * Asset TIDAK punya kolom branch_id sendiri — ini accessor delegasi.
     */
    public function branch(): ?Branch {
        return $this->assetLocation?->branch;
    }

    protected function totalAssetCost(): Attribute {
        // ponytail: computed accessor, not physical column — avoids out-of-sync risk
        return Attribute::get(fn () => ($this->gross_purchase_amount ?? 0) + ($this->additional_asset_cost ?? 0));
    }

    public function bookValue(): float {
        $accumulated = $this->depreciationSchedules()
            ->whereHas('glPostingStatus', fn ($q) => $q->where('status', FormStatus::POSTED))
            ->sum('depreciation_amount');

        return (float) $this->total_asset_cost - (float) $accumulated;
    }

    // ─── Guard — ERPNext: Asset tidak mengenal cancel/delete ─────────────

    public function canCancel(): bool {
        return false;
    }

    public function canDelete(): bool {
        return false;
    }

    // ─── Status operasional — di luar Submitable ───────────────────────────

    public function scrap(): void {
        $this->assertStatusTransition(
            allowedFrom: [FormStatus::ACTIVE, FormStatus::ISSUED, FormStatus::OUT_OF_ORDER],
            to: FormStatus::SCRAPPED,
        );

        $writeOffAmount = $this->bookValue();

        DB::transaction(function () {
            $this->depreciationSchedules()
                ->whereDoesntHave('glPostingStatus', fn ($q) => $q->where('status', FormStatus::POSTED))
                ->delete();

            $this->status        = [...$this->removeStatuses([FormStatus::ACTIVE, FormStatus::ISSUED, FormStatus::OUT_OF_ORDER]), FormStatus::SCRAPPED];
            $this->disposal_date = now();
            $this->save();
        });

        if ($this->is_depreciable && $writeOffAmount > 0) {
            GlPostingStatus::create([
                'referenceable_type' => static::class,
                'referenceable_id'   => $this->id,
                'status'             => 'pending',
            ]);
            event(new AssetScrapped($this, $writeOffAmount, now()));
        }
    }

    public function sell(): void {
        throw new LogicException(__('asset/asset.sell_not_implemented'));
    }

    public function setInMaintenance(): void {
        $this->assertStatusTransition(
            allowedFrom: [FormStatus::ACTIVE, FormStatus::ISSUED],
            to: FormStatus::IN_MAINTENANCE,
        );
        $this->status = [...$this->removeStatuses([FormStatus::ACTIVE, FormStatus::ISSUED]), FormStatus::IN_MAINTENANCE];
        $this->save();
    }

    public function setOutOfOrder(): void {
        $this->assertStatusTransition(
            allowedFrom: [FormStatus::ACTIVE, FormStatus::ISSUED, FormStatus::IN_MAINTENANCE],
            to: FormStatus::OUT_OF_ORDER,
        );
        $this->status = [...$this->removeStatuses([FormStatus::ACTIVE, FormStatus::ISSUED, FormStatus::IN_MAINTENANCE]), FormStatus::OUT_OF_ORDER];
        $this->save();
    }

    public function reactivate(): void {
        $this->assertStatusTransition(
            allowedFrom: [FormStatus::OUT_OF_ORDER, FormStatus::IN_MAINTENANCE, FormStatus::ISSUED],
            to: FormStatus::ACTIVE,
        );
        $this->status = [...$this->removeStatuses([FormStatus::OUT_OF_ORDER, FormStatus::IN_MAINTENANCE, FormStatus::ISSUED]), FormStatus::ACTIVE];
        $this->save();
    }

    // ─── Boot hooks ────────────────────────────────────────────────────────

    protected static function booted(): void {
        static::saving(function (self $asset) {
            // Auto-false is_depreciable for non-company ownership (unless explicit override)
            if (
                $asset->isDirty('ownership_type')
                && $asset->ownership_type !== AssetOwnershipType::COMPANY
                && ! $asset->isDirty('is_depreciable')
            ) {
                $asset->is_depreciable = false;
            }

            // Default is_depreciable from AssetCategory on create
            if (
                ! $asset->exists
                && $asset->asset_category_id
                && ! $asset->isDirty('is_depreciable')
            ) {
                $category = AssetCategory::find($asset->asset_category_id);
                if ($category && $category->non_depreciable_category) {
                    $asset->is_depreciable = false;
                }
            }

            // Validate asset_quantity = 1 for rentable categories
            if (
                $asset->isDirty('asset_category_id')
                && $asset->asset_quantity > 1
            ) {
                $category = AssetCategory::find($asset->asset_category_id);
                if ($category && $category->is_rentable) {
                    throw new LogicException(__('asset/asset.rentable_must_be_single_unit'));
                }
            }
        });
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    protected function assertStatusTransition(array $allowedFrom, FormStatus $to): void {
        $current       = $this->status ?? [];
        $currentValues = array_map(fn (FormStatus $s) => $s->value, $current);
        $allowedValues = array_map(fn (FormStatus $s) => $s->value, $allowedFrom);

        if (empty(array_intersect($allowedValues, $currentValues))) {
            throw new LogicException(
                __('asset/asset.cannot_transition_status', ['to' => $to->value]),
            );
        }
    }

    private function removeStatuses(array $remove): array {
        $removeValues = array_map(fn (FormStatus $s) => $s->value, $remove);

        return array_values(array_filter(
            $this->status ?? [],
            fn (FormStatus $s) => ! in_array($s->value, $removeValues, true),
        ));
    }
}
