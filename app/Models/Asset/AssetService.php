<?php

namespace App\Models\Asset;

use App\Enums\AssetServiceType;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Services\Asset\AssetServiceService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use LogicException;

class AssetService extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    protected static $service    = AssetServiceService::class;
    public string $formComponent = 'Asset/Services/Form';
    public string $translateKey  = 'asset.service';
    protected $guarded           = ['id'];
    protected $casts             = [
        'type'                   => AssetServiceType::class,
        'failure_date'           => 'datetime',
        'completion_date'        => 'datetime',
        'capitalize_repair_cost' => 'boolean',
        'bill_to_renter'         => 'boolean',
    ];

    public static function templateLink() {
        return ':code';
    }

    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'type' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'service.type',
        ],
        /**
         * Requirement 7.1/7.2, spec asset-service-billing: relasi ini HARUS
         * terdaftar di configColumns (walau hidden) supaya bisa diminta lewat
         * prop `with` LinkModel — resolver ModelController/DataTableColumnSelector
         * menolak (RelationNotFoundException) atau diam-diam membuang relasi
         * yang tidak terdaftar di sini, TERMASUK accessor Attribute:: (sudah
         * dicoba & terbukti tidak didukung sama sekali oleh mekanisme ini).
         */
        'customer' => [
            'type'   => 'relation',
            'hidden' => true,
        ],
        'customerBranch' => [
            'type'   => 'relation',
            'hidden' => true,
        ],
        'asset' => [
            'type'   => 'relation',
            'hidden' => true,
        ],
        'status' => [
            'show'       => true,
            'order'      => 2,
            'valueTrans' => 'status',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'asset',
            'assetMaintenanceTask.assetMaintenance.asset',
            'activities.pic',
            'consumedItems.item',
            'consumedItems.itemUnit',
            'branch',
            'customer',
            'customerBranch',
        ];
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function assetMaintenanceTask(): BelongsTo {
        return $this->belongsTo(AssetMaintenanceTask::class);
    }

    public function activities(): HasMany {
        return $this->hasMany(AssetServiceActivity::class);
    }

    public function consumedItems(): HasMany {
        return $this->hasMany(AssetServiceConsumedItem::class);
    }

    /**
     * Asset terkait, diturunkan sesuai type: repair → asset_id langsung,
     * maintenance_task → via chain assetMaintenanceTask.assetMaintenance.asset.
     */
    public function resolvedAsset(): ?Asset {
        return $this->type === AssetServiceType::REPAIR
            ? $this->asset
            : $this->assetMaintenanceTask?->assetMaintenance?->asset;
    }

    public function isFullyChecked(): bool {
        return $this->activities()->count() > 0
            && $this->activities()->where('is_done', false)->doesntExist();
    }

    public function totalRepairCost(): float {
        return (float) $this->consumedItems()->sum('total_value');
    }

    /**
     * Requirement 10.2, spec asset-service-billing: PENGECUALIAN sadar —
     * customer/customerBranch di sini adalah master data (bukan dokumen
     * transaksi Sales), snapshot penyewa aktif Asset saat billToRenter()
     * dipanggil. AssetService TETAP TIDAK boleh punya relasi ke SalesOrder/
     * SalesOrderItem/SalesInvoice/DeliveryNote manapun.
     */
    public function customer(): BelongsTo {
        return $this->belongsTo(Customer::class);
    }

    public function customerBranch(): BelongsTo {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }

    /**
     * Requirement 6, spec asset-service-billing: snapshot (beku) penyewa aktif
     * Asset terkait saat dipanggil — TIDAK berubah lagi otomatis walau status
     * rental Asset berubah setelahnya.
     */
    public function billToRenter(): void {
        $renter = $this->resolvedAsset()?->activeRenter();
        if (! $renter) {
            throw new LogicException(__('asset/service.not_currently_rented'));
        }

        $this->update([
            'bill_to_renter'     => true,
            'customer_id'        => $renter->customer_id,
            'customer_branch_id' => $renter->customer_branch_id,
        ]);
    }
}
