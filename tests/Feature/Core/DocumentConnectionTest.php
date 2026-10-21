<?php

namespace Tests\Feature\Core;

use App\Events\Core\DocumentSubmitted;
use App\Listeners\Core\Submission\CreateDocumentConnection;
use App\Models\Core\ModelConnection;
use App\Models\Model as AppModel;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Dokumen hulu tanpa referenceable sendiri, meniru PurchaseOrder / Opportunity /
 * WorkOrder: induk yang paling umum di aplikasi ini.
 */
class ConnTestRootDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'conn_test_roots';
    protected $guarded = ['id'];
}

/**
 * Dokumen hilir yang menunjuk induk lewat referenceable, meniru DeliveryNote /
 * PurchaseInvoice / StockEntry.
 */
class ConnTestChildDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'conn_test_children';
    protected $guarded = ['id'];

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }
}

class DocumentConnectionTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('conn_test_roots', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('created_by_id')->nullable();
            $table->string('code')->nullable();
            $table->json('status')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('conn_test_children', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('created_by_id')->nullable();
            $table->string('code')->nullable();
            $table->json('status')->nullable();
            $table->nullableUlidMorphs('referenceable');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void {
        Schema::dropIfExists('conn_test_children');
        Schema::dropIfExists('conn_test_roots');

        parent::tearDown();
    }

    private function handle(AppModel $document, ?AppModel $reference, ?array $data = null): void {
        (new CreateDocumentConnection)->handle(new DocumentSubmitted($document, $reference, $data));
    }

    /**
     * Regresi utama: sebelum perbaikan, attachConnections() keluar lewat guard
     * karena memeriksa referenceable milik INDUK, bukan milik dokumen yang
     * disubmit. Semua dokumen yang induknya tidak punya referenceable
     * (PurchaseOrder, Opportunity, WorkOrder, SalesInvoice) tidak pernah
     * tercatat di graf.
     */
    #[Test]
    public function connection_is_created_when_parent_has_no_referenceable_of_its_own(): void {
        $root  = ConnTestRootDocument::create([]);
        $child = ConnTestChildDocument::create([
            'referenceable_type' => ConnTestRootDocument::class,
            'referenceable_id'   => $root->id,
        ]);

        $this->handle($child, $root);

        $this->assertDatabaseHas('model_connections', [
            'model_type'     => ConnTestRootDocument::class,
            'model_id'       => $root->id,
            'reference_type' => ConnTestChildDocument::class,
            'reference_id'   => $child->id,
        ]);
    }

    /**
     * Arah koneksi: induk selalu sisi `model`, dokumen hilir sisi `reference`.
     */
    #[Test]
    public function connection_direction_is_parent_to_child(): void {
        $root  = ConnTestRootDocument::create([]);
        $child = ConnTestChildDocument::create([]);

        $this->handle($child, $root);

        $connection = ModelConnection::sole();
        $this->assertSame(ConnTestRootDocument::class, $connection->model_type);
        $this->assertSame(ConnTestChildDocument::class, $connection->reference_type);
    }

    #[Test]
    public function payload_data_is_stored_on_the_connection(): void {
        $root  = ConnTestRootDocument::create([]);
        $child = ConnTestChildDocument::create([]);

        $this->handle($child, $root, ['requested_quantity' => 7]);

        $this->assertSame(['requested_quantity' => 7], ModelConnection::sole()->data);
    }

    /**
     * Submit berulang (amend, retry) tidak boleh menggandakan baris.
     */
    #[Test]
    public function repeated_submit_does_not_duplicate_the_connection(): void {
        $root  = ConnTestRootDocument::create([]);
        $child = ConnTestChildDocument::create([]);

        $this->handle($child, $root);
        $this->handle($child, $root);

        $this->assertSame(1, ModelConnection::count());
    }

    #[Test]
    public function no_connection_is_created_without_a_reference(): void {
        $child = ConnTestChildDocument::create([]);

        $this->handle($child, null);

        $this->assertSame(0, ModelConnection::count());
    }

    /**
     * Sebelum perbaikan, kasus ini melempar LogicException: attachConnections()
     * mengakses $sourceItem->parentRelation, dan parentRelation() mengembalikan
     * null pada model header (static $parentRelation hanya ada di model item),
     * sementara Eloquent mewajibkan method relasi mengembalikan Relation.
     */
    #[Test]
    public function chained_parent_does_not_throw_and_records_both_levels(): void {
        $grandParent = ConnTestRootDocument::create([]);
        $parent      = ConnTestChildDocument::create([
            'referenceable_type' => ConnTestRootDocument::class,
            'referenceable_id'   => $grandParent->id,
        ]);
        $child = ConnTestChildDocument::create([
            'referenceable_type' => ConnTestChildDocument::class,
            'referenceable_id'   => $parent->id,
        ]);

        $this->handle($child, $parent);

        // Tingkat pertama: induk langsung.
        $this->assertDatabaseHas('model_connections', [
            'model_id'     => $parent->id,
            'reference_id' => $child->id,
        ]);

        // Tingkat kedua: rantai di atas induk tetap disusuri.
        $this->assertDatabaseHas('model_connections', [
            'model_id'     => $grandParent->id,
            'reference_id' => $parent->id,
        ]);
    }

    /**
     * Rantai berhenti di induk yang tidak punya referenceable sendiri.
     *
     * Ini perilaku PaymentEntry: `paymentable` selalu PurchaseInvoice atau
     * SalesInvoice (PaymentEntryService::fillRelations), dan tabel
     * purchase_invoices tidak punya kolom referenceable -- hanya
     * purchase_invoice_items yang punya. Guard di CreateDocumentConnection
     * karena itu tidak pernah memanggil attachConnections(), sehingga koneksi
     * langsung PurchaseOrder -> PaymentEntry tidak pernah tertulis.
     *
     * Panel relasi pada halaman PurchaseOrder karenanya tidak bisa membaca
     * pembayaran lewat koneksi langsung.
     */
    #[Test]
    public function chain_stops_when_parent_has_no_referenceable_column(): void {
        $grandParent = ConnTestRootDocument::create([]);
        $parent      = ConnTestRootDocument::create([]);
        $child       = ConnTestChildDocument::create([
            'referenceable_type' => ConnTestRootDocument::class,
            'referenceable_id'   => $parent->id,
        ]);

        $this->handle($child, $parent);

        $this->assertDatabaseHas('model_connections', [
            'model_id'     => $parent->id,
            'reference_id' => $child->id,
        ]);

        $this->assertSame(1, ModelConnection::count());
        $this->assertDatabaseMissing('model_connections', [
            'model_id' => $grandParent->id,
        ]);
    }

    /**
     * parentRelation() pada model tanpa static $parentRelation harus
     * mengembalikan relasi kosong, bukan null, supaya akses sebagai atribut
     * tidak melempar LogicException.
     */
    #[Test]
    public function parent_relation_is_null_without_throwing_on_header_models(): void {
        $root = ConnTestRootDocument::create([]);

        $this->assertNull($root->parentRelation);
        $this->assertSame('id', $root->parentRelation()->getForeignKeyName());
    }
}
