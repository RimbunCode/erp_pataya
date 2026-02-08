<?php

namespace App\Models\Inventory;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stock extends Model
{
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'stock_queue' => 'array',
        'details' => Json::class,
    ];

    public static function boot()
    {
        parent::boot();
        self::creating(function ($model) {
            $model->details = [
                'rents' => [],
                'reservations' => [],
                'incomings' => [],
            ];
        });

        self::saved(function ($model) {
            // auto recalculate valuation rate every update of stock
            $queue = $model->stock_queue;
            $totalQuantity = array_sum(array_column($queue, 'quantity'));

            if ($totalQuantity <= 0) {
                $model->valuation_rate = 0;
            } else {
                $totalQuantity = \array_sum(array_column($queue, 'quantity'));
                $newValuationRate = \array_sum(
                    \array_map(fn ($q) => $q['rate'] * $q['quantity'], $queue),
                ) / $totalQuantity;

                $model->valuation_rate = $newValuationRate;
            }

            $model->saveQuietly();
        });
    }

    public string $translateKey = 'inventories.stock';

    protected $configColumns = [
        'actual_quantity' => [
            'type' => 'numeric',
            'show' => true,
            'order' => 0,
        ],
        'reserved_quantity' => [
            'type' => 'numeric',
            'show' => true,
            'order' => 1,
        ],
        'incoming_quantity' => [
            'type' => 'numeric',
            'show' => true,
            'order' => 2,
        ],
        'ready_quantity' => [
            'type' => 'numeric',
            'show' => true,
            'order' => 3,
        ],
        'projected_quantity' => [
            'type' => 'numeric',
            'show' => true,
            'order' => 4,
        ],
        'stock_queue' => [
            'type' => 'numeric',
            'ignore' => true,
        ],
        'warehouse',
        'itemVariant',
        'unit',
    ];

    private function fillDetails(&$details, $operator, $type, $key, $value)
    {
        switch ($operator) {
            case 'update':
            case 'add':
                $details[$type][$key] = $value;
                break;

            case 'remove':
                unset($details[$type][$key]);
                break;

            case 'increment':
                $details[$type][$key] = ($details[$type][$key] ?? 0) + $value;
                break;

            case 'decrement':
                $details[$type][$key] = ($details[$type][$key] ?? 0) - $value;
                break;

        }
        if (($details[$type][$key] ?? 0) <= 0) {
            unset($details[$type][$key]);
        }
    }

    public function updateDetails(string|array $operator, ?string $type = null, ?string $key = null, ?float $value = null)
    {
        $details = $this->details ?? [
            'rents' => [],
            'reservations' => [],
            'incomings' => [],
        ];

        if (\is_array($operator)) {
            foreach ($operator as $op) {
                $this->fillDetails($details, $op['operator'], $op['type'], $op['key'], $op['value']);
            }
        } else {
            $this->fillDetails($details, $operator, $type, $key, $value);
        }

        $this->details = $details;
        $this->reserved_quantity = array_sum(((array) $this->details)['reservations']);
        $this->rented_quantity = array_sum(((array) $this->details)['rents']);
        $this->incoming_quantity = array_sum(((array) $this->details)['incomings']);
        if ($this->isDirty('details')) {
            $this->save();
        }
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function itemVariant()
    {
        return $this->belongsTo(ItemVariant::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }
}
