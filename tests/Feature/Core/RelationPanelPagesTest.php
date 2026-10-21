<?php

namespace Tests\Feature\Core;

use App\Models\Asset\AssetService;
use App\Models\Core\ModelConnection;
use App\Models\CRM\Opportunity;
use App\Models\CRM\Quotation;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Core\Connection\RelationPanelService;
use App\Services\Core\PermissionChecker;
use App\Traits\Submitable;
use Database\Factories\Asset\AssetServiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Panel relasi di halaman dokumen sumber, satu dataset per pasangan dari tabel
 * cakupan spec document-relation-panels. Setiap dataset menguji dua hal: panel
 * terisi saat ada koneksi, dan panel kosong yang membawa tombol aksi saat belum ada.
 */
class RelationPanelPagesTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        if (! Schema::hasColumns('accounts', ['lft', 'rgt', 'depth'])) {
            Schema::table('accounts', function ($table) {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Kolom dinamis (code, status, submitted_at, dst) ditambahkan oleh initPermissions().
        // Harus dipanggil sebelum skema di-cache oleh Eloquent, sama seperti test lain.
        foreach ([
            SalesOrder::class, SalesInvoice::class, DeliveryNote::class, AssetService::class,
            PurchaseRequest::class, PurchaseOrder::class, PurchaseInvoice::class, PurchaseReceipt::class,
            PaymentEntry::class, WorkOrder::class, Quotation::class, Opportunity::class, InternalOrder::class,
        ] as $model) {
            $model::initPermissions();
        }

        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    /**
     * Dokumen sumber, dokumen tujuan, dan prefix segmen `ref` pada aksi panel kosong.
     *
     * @return array<string, array{0: class-string, 1: class-string, 2: string}>
     */
    public static function panelPairs(): array {
        return [
            'SalesOrder -> SalesInvoice'       => [SalesOrder::class, SalesInvoice::class, 'salesOrder'],
            'SalesOrder -> DeliveryNote'       => [SalesOrder::class, DeliveryNote::class, 'salesOrder'],
            'AssetService -> PurchaseRequest'  => [AssetService::class, PurchaseRequest::class, 'assetService'],
            'AssetService -> PurchaseOrder'    => [AssetService::class, PurchaseOrder::class, 'assetService'],
            'AssetService -> SalesOrder'       => [AssetService::class, SalesOrder::class, 'assetService'],
            'AssetService -> InternalOrder'    => [AssetService::class, InternalOrder::class, 'assetService'],
            'PurchaseRequest -> PurchaseOrder' => [PurchaseRequest::class, PurchaseOrder::class, 'purchaseRequest'],
            'PurchaseInvoice -> PaymentEntry'  => [PurchaseInvoice::class, PaymentEntry::class, 'purchaseInvoice'],
            'SalesInvoice -> PaymentEntry'     => [SalesInvoice::class, PaymentEntry::class, 'salesInvoice'],
            'WorkOrder -> PurchaseRequest'     => [WorkOrder::class, PurchaseRequest::class, 'workOrder'],
            'Quotation -> SalesOrder'          => [Quotation::class, SalesOrder::class, 'quotation'],
            'Opportunity -> Quotation'         => [Opportunity::class, Quotation::class, 'opportunity'],
            'InternalOrder -> DeliveryNote'    => [InternalOrder::class, DeliveryNote::class, 'internalOrder'],
        ];
    }

    /**
     * Buat record dengan atribut minimum. Dokumen submitable diberi pembuat dan
     * submitted_at supaya lolos penjagaan panel.
     *
     * @param  class-string<BaseModel>  $class
     * @param  array<string, mixed>  $attributes
     */
    private function make(string $class, array $attributes = []): BaseModel {
        $defaults = [];
        if (Schema::hasColumn((new $class)->getTable(), 'code')) {
            $defaults['code'] = class_basename($class) . '-' . fake()->unique()->numerify('######');
        }
        $table = (new $class)->getTable();
        if (Schema::hasColumn($table, 'date')) {
            $defaults['date'] = now();
        }
        if (Schema::hasColumn($table, 'delivery_date')) {
            $defaults['delivery_date'] = now();
        }
        if (Schema::hasColumn($table, 'title')) {
            $defaults['title'] = 'Judul ' . class_basename($class);
        }
        if (in_array(Submitable::class, class_uses_recursive($class), true)) {
            $defaults['created_by_id'] = $this->user->getKey();
            $defaults['submitted_at']  = now();
        }
        if ($class === PaymentEntry::class) {
            $defaults += $this->paymentEntryDefaults();
        }
        if ($class === AssetService::class) {
            $defaults += AssetServiceFactory::new()->definition();
        }
        if ($class === DeliveryNote::class) {
            // reference_to_id adalah FK ke permissions, sama seperti DeliveryNoteFactory.
            $defaults['reference_to_id'] = Permission::create([
                'module' => 'inventory',
                'name'   => 'delivery_note_' . fake()->unique()->numerify('####'),
                'model'  => DeliveryNote::class,
            ])->id;
        }

        return BaseModel::withoutEvents(fn () => $class::create(array_merge($defaults, $attributes)));
    }

    /** @return array<string, mixed> */
    private function paymentEntryDefaults(): array {
        return [
            'date'                 => now(),
            'payment_type'         => 'pay',
            'paid_amount'          => 100,
            'base_paid_amount'     => 100,
            'exchange_rate'        => 1,
            'account_paid_to_id'   => $this->account('1000')->id,
            'account_paid_from_id' => $this->account('2000')->id,
        ];
    }

    private function account(string $number): Account {
        return Account::create([
            'account_name'   => 'Akun ' . $number,
            'account_number' => $number,
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
        ]);
    }

    private function connect(BaseModel $document, BaseModel $reference): void {
        ModelConnection::createConnection([
            'model_type'     => $document::class,
            'model_id'       => $document->getKey(),
            'reference_type' => $reference::class,
            'reference_id'   => $reference->getKey(),
        ]);
    }

    /** @return array<string, mixed> */
    private function panelFor(array $panels, string $referenceType): array {
        $matches = array_values(array_filter(
            $panels,
            fn (array $panel): bool => $panel['reference_type'] === $referenceType,
        ));
        $this->assertCount(1, $matches);

        return $matches[0];
    }

    private function grant(string ...$classes): void {
        $grant       = [0 => [['permissions' => ['read' => true, 'create' => true]]]];
        $permissions = [];
        foreach ($classes as $class) {
            $permissions[$class] = $grant;
        }
        app()->instance(PermissionChecker::class, new PermissionChecker($permissions));
    }

    #[Test]
    #[DataProvider('panelPairs')]
    public function panel_lists_the_connected_document(string $sourceClass, string $targetClass, string $refPrefix): void {
        $this->grant($targetClass);
        $source = $this->make($sourceClass);
        // Delivery note dibuat dari dokumen sumbernya lewat referenceable, seperti alur nyata.
        $target = $this->make($targetClass, $targetClass === DeliveryNote::class
            ? ['referenceable_type' => $sourceClass, 'referenceable_id' => $source->getKey()]
            : []);
        $this->connect($source, $target);

        $panel = $this->panelFor((new RelationPanelService)->build($source), $targetClass);

        $this->assertFalse($panel['is_empty']);
        $this->assertContains($target->getKey(), array_column($panel['rows'], 'id'));
    }

    #[Test]
    #[DataProvider('panelPairs')]
    public function empty_panel_shows_the_create_action_with_the_document_reference(string $sourceClass, string $targetClass, string $refPrefix): void {
        $this->grant($targetClass);
        $source = $this->make($sourceClass);

        $panel = $this->panelFor((new RelationPanelService)->build($source), $targetClass);

        $this->assertTrue($panel['is_empty']);
        $this->assertNotNull($panel['action']);
        $this->assertStringContainsString(
            $refPrefix . '/' . $source->getKey(),
            urldecode($panel['action']['url']),
        );
    }

    /**
     * Retur tidak tercatat di ModelConnection. Baris panel retur diambil dari
     * return_against_id, dan judulnya memakai key retur, bukan judul penerimaan.
     */
    #[Test]
    public function receipt_return_panel_lists_returns_without_model_connection(): void {
        $this->grant(PurchaseReceipt::class);
        $receipt = $this->make(PurchaseReceipt::class);
        $return  = $this->make(PurchaseReceipt::class, ['return_against_id' => $receipt->getKey()]);

        $panel = $this->panelFor((new RelationPanelService)->build($receipt), PurchaseReceipt::class);

        $this->assertSame('purchase.purchaseReceipt.panel.return.title', $panel['title']);
        $this->assertFalse($panel['is_empty']);
        $this->assertContains($return->getKey(), array_column($panel['rows'], 'id'));
        $this->assertSame(0, ModelConnection::query()->count());
    }

    #[Test]
    public function receipt_return_panel_is_empty_with_action_when_there_is_no_return(): void {
        $this->grant(PurchaseReceipt::class);
        $receipt = $this->make(PurchaseReceipt::class);

        $panel = $this->panelFor((new RelationPanelService)->build($receipt), PurchaseReceipt::class);

        $this->assertTrue($panel['is_empty']);
        $this->assertSame('purchase.purchaseReceipt.create_purchase_return', $panel['action']['label']);
        $this->assertStringContainsString('purchaseReceipt/' . $receipt->getKey(), urldecode($panel['action']['url']));
    }

    #[Test]
    public function delivery_note_return_panel_lists_returns_and_offers_return_action(): void {
        $this->grant(DeliveryNote::class);
        $salesOrder   = $this->make(SalesOrder::class);
        $deliveryNote = $this->make(DeliveryNote::class, [
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $salesOrder->getKey(),
        ]);
        $return = $this->make(DeliveryNote::class, [
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $salesOrder->getKey(),
            'return_against_id'  => $deliveryNote->getKey(),
        ]);

        $panel = $this->panelFor((new RelationPanelService)->build($deliveryNote), DeliveryNote::class);

        $this->assertSame('inventory.deliveryNote.panel.return.title', $panel['title']);
        $this->assertContains($return->getKey(), array_column($panel['rows'], 'id'));
        $this->assertSame('inventory.deliveryNote.actions.create_sales_return', $panel['action']['label']);
        $this->assertSame(0, ModelConnection::query()->count());
    }
}
