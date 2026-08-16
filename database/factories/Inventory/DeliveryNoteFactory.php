<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\DeliveryNote;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryNote>
 */
class DeliveryNoteFactory extends Factory {
    protected $model = DeliveryNote::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        // SalesOrder TIDAK boleh dapat HasFactory (Correctness Property 1, spec asset-rental-migration)
        // — pakai create() manual, bukan ::factory(), mirip pola SalesOrderFactory sendiri.
        // initPermissions() memastikan kolom dinamis (code, status, dst) sudah ter-migrate di test DB.
        SalesOrder::initPermissions();

        $salesOrder = SalesOrder::create([
            'code'        => fake()->unique()->bothify('SO-####'),
            'date'        => now(),
            'customer_id' => Customer::query()->create([
                'name'        => fake()->unique()->company(),
                'is_disabled' => false,
            ])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        $permission = Permission::create([
            'module' => 'inventory',
            'name'   => 'delivery_note_' . fake()->unique()->numerify('####'),
            'model'  => DeliveryNote::class,
        ]);

        DeliveryNote::initPermissions();

        return [
            'code'               => fake()->unique()->bothify('DN-####'),
            'delivery_date'      => now(),
            'reference_to_id'    => $permission->id,
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $salesOrder->id,
            'created_by_id'      => $salesOrder->created_by_id,
        ];
    }
}
