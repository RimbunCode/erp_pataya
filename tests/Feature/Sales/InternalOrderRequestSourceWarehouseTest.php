<?php

namespace Tests\Feature\Sales;

use App\Http\Requests\Sales\InternalOrderRequest;
use App\Models\Inventory\ItemVariant;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InternalOrderRequestSourceWarehouseTest extends TestCase {
    use RefreshDatabase;

    /**
     * Validasi HANYA field source_warehouse (bagian custom withValidator()),
     * tidak ikut memvalidasi field lain di rules().
     */
    private function validateSourceWarehouse(array $item): Validator {
        $data = ['items' => [$item]];

        $validator = ValidatorFacade::make($data, [
            'items.*.item.id'             => ['nullable', 'string'],
            'items.*.source_warehouse.id' => ['nullable', 'string'],
        ]);

        $request = InternalOrderRequest::create('/', 'POST', $data);
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    #[Test]
    public function rejects_missing_source_warehouse_for_stock_item(): void {
        $itemVariant = ItemVariant::factory()->create(['is_stock_item' => true]);

        $validator = $this->validateSourceWarehouse([
            'id'   => (string) Str::ulid(),
            'item' => ['id' => $itemVariant->id],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.source_warehouse.id', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_missing_source_warehouse_for_service_item(): void {
        $itemVariant = ItemVariant::factory()->create(['is_stock_item' => false]);

        $validator = $this->validateSourceWarehouse([
            'id'   => (string) Str::ulid(),
            'item' => ['id' => $itemVariant->id],
        ]);

        $this->assertFalse($validator->fails());
    }

    #[Test]
    public function accepts_source_warehouse_present_for_stock_item(): void {
        $itemVariant = ItemVariant::factory()->create(['is_stock_item' => true]);

        $validator = $this->validateSourceWarehouse([
            'id'               => (string) Str::ulid(),
            'item'             => ['id' => $itemVariant->id],
            'source_warehouse' => ['id' => (string) Str::ulid()],
        ]);

        $this->assertFalse($validator->fails());
    }
}
