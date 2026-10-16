<?php

namespace Tests\Feature\Purchase;

use App\Http\Requests\Purchase\PurchaseOrderBatchRequest;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseRequestItem;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PurchaseOrderBatchValidationTest extends TestCase {
    use RefreshDatabase;

    private array $draft;
    private PurchaseRequestItem $source;

    protected function setUp(): void {
        parent::setUp();

        $country  = CountryFactory::new()->createQuietly();
        $supplier = SupplierFactory::new()->make(['country_id' => $country->code]);
        unset($supplier->parent_id);
        $supplier->saveQuietly();
        $warehouse = WarehouseFactory::new()->createQuietly();
        $unit      = Unit::withoutEvents(fn () => Unit::create(['code' => 'PCS', 'name' => 'Pieces']));
        $item      = Item::factory()->createQuietly(['default_unit_id' => $unit->id]);
        $variant   = ItemVariant::factory()->createQuietly(['item_id' => $item->id, 'default_unit_id' => $unit->id]);
        $itemUnit  = ItemUnit::withoutEvents(fn () => ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id]));

        $this->source = new PurchaseRequestItem;
        $this->source->forceFill([
            'id'                 => (string) Str::ulid(),
            'item_variant_id'    => $variant->id,
            'item_unit_id'       => $itemUnit->id,
            'unordered_quantity' => 10,
        ]);
        $this->draft = [
            'id'            => 'draft-1',
            'supplier'      => ['id' => $supplier->id],
            'date'          => '2026-10-14',
            'required_date' => '2026-10-15',
            'items'         => [[
                'id'               => 'allocation-1',
                'source_item_id'   => $this->source->id,
                'item'             => ['id' => $variant->id],
                'unit'             => ['id' => $itemUnit->id],
                'target_warehouse' => ['id' => $warehouse->id],
                'required_date'    => '2026-10-15',
                'quantity'         => 10,
                'rate'             => 100,
            ]],
        ];

        Route::post('/_tests/po-batch-validation', fn (PurchaseOrderBatchRequest $request) => response()->json($request->validated()));
        Route::post('/_tests/po-single-validation', fn (PurchaseOrderRequest $request) => response()->json($request->validated()));
    }

    private function payload(array $secondDraft = []): array {
        $secondDraft                   = array_replace_recursive($this->draft, $secondDraft);
        $secondDraft['id']             = 'draft-2';
        $secondDraft['items'][0]['id'] = 'allocation-2';

        return [
            'token'           => (string) Str::uuid(),
            'idempotency_key' => (string) Str::uuid(),
            'drafts'          => [$this->draft, $secondDraft],
        ];
    }

    public function test_valid_batch_preserves_each_draft_and_source_identity(): void {
        $payload = $this->payload(['external_note' => 'Second PO note']);

        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertOk()
            ->assertJsonPath('drafts.1.external_note', 'Second PO note')
            ->assertJsonPath('drafts.1.items.0.source_item_id', $this->source->id);
    }

    public function test_second_draft_errors_are_indexed_for_header_item_discount_and_schedule(): void {
        $payload = $this->payload([
            'required_date'     => '2026-10-13',
            'supplier'          => ['id' => 'missing-supplier'],
            'discount_on'       => 'net_total',
            'discount_rate'     => 101,
            'payment_schedules' => [[
                'id'              => 'schedule-2',
                'due_date'        => 'invalid-date',
                'invoice_portion' => 'invalid-number',
                'discount_type'   => 'percentage',
            ]],
            'items' => [[
                'quantity'         => 0,
                'rate'             => -1,
                'required_date'    => '2026-10-13',
                'target_warehouse' => ['id' => 'missing-warehouse'],
            ]],
        ]);

        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'drafts.1.required_date', 'drafts.1.supplier.id',
                'drafts.1.discount_rate', 'drafts.1.discount_amount',
                'drafts.1.payment_schedules.0.due_date', 'drafts.1.payment_schedules.0.invoice_portion',
                'drafts.1.payment_schedules.0.discount', 'drafts.1.items.0.quantity',
                'drafts.1.items.0.rate', 'drafts.1.items.0.required_date',
                'drafts.1.items.0.target_warehouse.id',
            ])
            ->assertJsonMissingValidationErrors(['drafts.0.required_date', 'drafts.0.discount_amount', 'drafts.0.items.0.quantity']);
    }

    public function test_dates_and_conditional_discount_rules_use_each_drafts_own_context(): void {
        $payload = $this->payload([
            'date'            => '2026-11-01',
            'required_date'   => '2026-11-02',
            'discount_on'     => 'grand_total',
            'discount_rate'   => 5,
            'discount_amount' => 50,
            'items'           => [['required_date' => '2026-11-02']],
        ]);
        $this->postJson('/_tests/po-batch-validation', $payload)->assertOk();

        $payload['drafts'][1]['items'][0]['required_date'] = '2026-10-15';
        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('drafts.1.items.0.required_date');
    }

    public function test_schedule_discount_dependencies_do_not_cross_drafts(): void {
        $schedule                                  = ['id' => 'schedule', 'due_date' => '2026-11-01', 'invoice_portion' => 100];
        $payload                                   = $this->payload(['payment_schedules' => [$schedule + ['discount' => 5, 'discount_type' => 'amount']]]);
        $payload['drafts'][0]['payment_schedules'] = [$schedule];

        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('drafts.1.payment_schedules.0.discount_date')
            ->assertJsonMissingValidationErrors(['drafts.0.payment_schedules.0.discount', 'drafts.0.payment_schedules.0.discount_date']);
    }

    public function test_quantities_below_and_above_remaining_are_allowed_including_repeated_source(): void {
        $payload                                      = $this->payload(['items' => [['quantity' => 20]]]);
        $payload['drafts'][0]['items'][0]['quantity'] = 3;

        $this->postJson('/_tests/po-batch-validation', $payload)->assertOk();
        PurchaseOrderBatchRequest::validateSourceItems($payload['drafts'], [$this->source]);
        $this->assertSame(3, $payload['drafts'][0]['items'][0]['quantity']);
        $this->assertSame(20, $payload['drafts'][1]['items'][0]['quantity']);
    }

    #[DataProvider('invalidEnvelopeProvider')]
    public function test_invalid_envelope_is_rejected(string $field, mixed $value, string $error): void {
        $payload = $this->payload();
        data_set($payload, $field, $value);
        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($error);
    }

    public static function invalidEnvelopeProvider(): array {
        return [
            'missing token'            => ['token', null, 'token'],
            'invalid key'              => ['idempotency_key', 'not-a-uuid', 'idempotency_key'],
            'empty drafts'             => ['drafts', [], 'drafts'],
            'malformed draft'          => ['drafts.1', 'invalid', 'drafts.1'],
            'missing date'             => ['drafts.1.date', null, 'drafts.1.date'],
            'malformed date'           => ['drafts.1.date', ['invalid'], 'drafts.1.date'],
            'duplicate draft identity' => ['drafts.1.id', 'draft-1', 'drafts.1.id'],
            'missing source'           => ['drafts.1.items.0.source_item_id', null, 'drafts.1.items.0.source_item_id'],
            'forged polymorphic type'  => ['drafts.1.items.0.referenceable_type', 'OtherModel', 'drafts.1.items.0.referenceable_type'],
            'forged polymorphic id'    => ['drafts.1.items.0.referenceable_id', 'other-id', 'drafts.1.items.0.referenceable_id'],
        ];
    }

    #[DataProvider('sourceMismatchProvider')]
    public function test_source_variant_unit_and_membership_are_validated(string $field): void {
        $payload = $this->payload();
        data_set($payload['drafts'][1]['items'][0], $field, (string) Str::ulid());

        try {
            PurchaseOrderBatchRequest::validateSourceItems($payload['drafts'], [$this->source]);
            $this->fail('Source mismatch must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('drafts.1.items.0.' . $field, $exception->errors());
            $this->assertArrayNotHasKey('drafts.0.items.0.' . $field, $exception->errors());
        }
    }

    public static function sourceMismatchProvider(): array {
        return [['item.id'], ['unit.id'], ['source_item_id']];
    }

    public function test_another_unit_of_the_same_item_is_valid(): void {
        $unit     = Unit::withoutEvents(fn () => Unit::create(['code' => 'BOX', 'name' => 'Box']));
        $itemUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($this->source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 12,
        ]));
        $payload                                        = $this->payload();
        $payload['drafts'][1]['items'][0]['unit']['id'] = $itemUnit->id;

        PurchaseOrderBatchRequest::validateSourceItems($payload['drafts'], [$this->source]);
        $this->assertSame($itemUnit->id, $payload['drafts'][1]['items'][0]['unit']['id']);
    }

    public function test_a_unit_with_non_positive_factor_is_rejected(): void {
        $unit     = Unit::withoutEvents(fn () => Unit::create(['code' => 'BAD', 'name' => 'Bad']));
        $itemUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($this->source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 0,
        ]));
        $payload                                        = $this->payload();
        $payload['drafts'][1]['items'][0]['unit']['id'] = $itemUnit->id;

        try {
            PurchaseOrderBatchRequest::validateSourceItems($payload['drafts'], [$this->source]);
            $this->fail('A unit without a positive conversion factor must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('drafts.1.items.0.unit.id', $exception->errors());
        }
    }

    public function test_a_deleted_unit_is_rejected(): void {
        $unit     = Unit::withoutEvents(fn () => Unit::create(['code' => 'DEL', 'name' => 'Deleted']));
        $itemUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($this->source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 12,
        ]));
        $itemUnit->deleteQuietly();
        $payload                                        = $this->payload();
        $payload['drafts'][1]['items'][0]['unit']['id'] = $itemUnit->id;

        try {
            PurchaseOrderBatchRequest::validateSourceItems($payload['drafts'], [$this->source]);
            $this->fail('A deleted unit must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('drafts.1.items.0.unit.id', $exception->errors());
        }
    }

    public function test_deleted_source_item_is_rejected(): void {
        $this->source->deleted_at = now();
        $this->expectException(ValidationException::class);

        PurchaseOrderBatchRequest::validateSourceItems($this->payload()['drafts'], [$this->source]);
    }

    public function test_unvalidated_header_fields_are_excluded_from_batch_data(): void {
        $payload = $this->payload(['branch_id' => 'forged-branch', 'created_by_id' => 'forged-user', 'status' => ['approved']]);
        $this->postJson('/_tests/po-batch-validation', $payload)
            ->assertOk()->assertJsonMissingPath('drafts.1.branch_id')
            ->assertJsonMissingPath('drafts.1.created_by_id')->assertJsonMissingPath('drafts.1.status');
    }

    public function test_single_po_keeps_existing_rules_and_polymorphic_references(): void {
        $draft                                   = $this->draft;
        $draft['items'][0]['referenceable_type'] = PurchaseRequestItem::class;
        $draft['items'][0]['referenceable_id']   = $this->source->id;
        $draft['payment_schedules']              = [[
            'id'            => 'schedule', 'due_date' => '2026-11-01', 'invoice_portion' => 100,
            'discount_type' => 'percentage', 'discount' => 5, 'discount_date' => '2026-10-30',
        ]];
        $this->postJson('/_tests/po-single-validation', $draft)
            ->assertOk()->assertJsonPath('items.0.referenceable_id', $this->source->id);

        unset($draft['payment_schedules'][0]['discount_date']);
        $draft['discount_on']          = 'net_total';
        $draft['items'][0]['quantity'] = 0;
        $this->postJson('/_tests/po-single-validation', $draft)
            ->assertUnprocessable()->assertJsonValidationErrors(['items.0.quantity', 'discount_rate', 'discount_amount', 'payment_schedules.0.discount_date']);
    }
}
