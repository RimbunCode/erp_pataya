<?php

namespace Tests\Feature\Core;

use App\Models\Core\ModelConnection;
use App\Models\Model as AppModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuditRowTestDocument extends AppModel {
    use HasUlids;

    protected $table     = 'audit_row_test_docs';
    protected $guarded   = ['id'];
    public $translateKey = 'core.auditRowTestDocument';

    public static function templateLink() {
        return ':code';
    }
}

/**
 * PurchaseOrderService menulis baris audit ke model_connections dengan
 * reference_type berupa penanda bebas ('sync', 'mark_done'), bukan nama kelas.
 * ModelConnection::getDisplayFromTemplateLink() menjalankan
 * $model_type::find($model_id) pada nilai itu, sehingga penulisan melempar
 * Error "Class not found" dan seluruh transaksi syncItems() ikut di-rollback.
 */
class ModelConnectionAuditRowTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('audit_row_test_docs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void {
        Schema::dropIfExists('audit_row_test_docs');

        parent::tearDown();
    }

    #[Test]
    public function audit_row_with_non_class_reference_type_can_be_stored(): void {
        $document = AuditRowTestDocument::create(['code' => 'DOC-001']);

        ModelConnection::create([
            'model_type'     => AuditRowTestDocument::class,
            'model_id'       => $document->id,
            'reference_type' => 'sync',
            'reference_id'   => (string) Str::ulid(),
            'data'           => ['type' => 'items_sync'],
        ]);

        $this->assertDatabaseHas('model_connections', [
            'model_type'     => AuditRowTestDocument::class,
            'reference_type' => 'sync',
        ]);
    }

    #[Test]
    public function audit_row_leaves_reference_display_empty_instead_of_throwing(): void {
        $document = AuditRowTestDocument::create(['code' => 'DOC-002']);

        ModelConnection::create([
            'model_type'     => AuditRowTestDocument::class,
            'model_id'       => $document->id,
            'reference_type' => 'mark_done',
            'reference_id'   => (string) Str::ulid(),
        ]);

        $connection = ModelConnection::sole();
        $this->assertNull($connection->reference_display);
        $this->assertSame('DOC-002', $connection->model_display);
    }

    /**
     * Regresi: PurchaseRequestService memuat relasi morph lewat
     * ModelConnection::with('reference'). Eloquent menyelesaikan morphTo dengan
     * `new $type`, sehingga satu baris audit berpenanda bebas membuat submit
     * Purchase Request gagal dengan Error "Class not found".
     */
    #[Test]
    public function eager_loading_morph_relations_skips_audit_rows(): void {
        $document = AuditRowTestDocument::create(['code' => 'DOC-005']);
        $other    = AuditRowTestDocument::create(['code' => 'DOC-006']);

        ModelConnection::create([
            'model_type'     => AuditRowTestDocument::class,
            'model_id'       => $document->id,
            'reference_type' => 'sync',
            'reference_id'   => (string) Str::ulid(),
        ]);
        ModelConnection::createConnection([
            'model'     => $document,
            'reference' => $other,
        ]);

        $rows = ModelConnection::with(['model', 'reference'])->get();

        $this->assertCount(2, $rows);

        $auditRow = $rows->firstWhere('reference_id', '!=', $other->id);
        $this->assertNull($auditRow->reference_type);
        $this->assertNull($auditRow->reference);

        $modelRow = $rows->firstWhere('reference_id', $other->id);
        $this->assertSame(AuditRowTestDocument::class, $modelRow->reference_type);
        $this->assertTrue($modelRow->reference->is($other));
    }

    /**
     * Regresi: PurchaseRequestService mengelompokkan koneksi dengan
     * groupBy('reference_type') lalu memanggil update() pada relasi tiap baris.
     * Baris audit menghasilkan grup bertipe null dengan relasi null, sehingga
     * submit Purchase Request gagal "Call to a member function update() on null"
     * bila grup tersebut tidak dilewati.
     */
    #[Test]
    public function grouping_by_reference_type_isolates_audit_rows(): void {
        $document = AuditRowTestDocument::create(['code' => 'DOC-008']);
        $target   = AuditRowTestDocument::create(['code' => 'DOC-009']);

        ModelConnection::create([
            'model_type'     => AuditRowTestDocument::class,
            'model_id'       => $document->id,
            'reference_type' => 'sync',
            'reference_id'   => (string) Str::ulid(),
        ]);
        ModelConnection::createConnection([
            'model'     => $document,
            'reference' => $target,
        ]);

        $groups = ModelConnection::with('reference')
            ->search(AuditRowTestDocument::class, $document->id)
            ->get()
            ->groupBy('reference_type');

        $resolved = [];
        foreach ($groups as $type => $connections) {
            if (! $type) {
                continue;
            }

            foreach ($connections as $connection) {
                if ($connection->reference === null) {
                    continue;
                }

                $resolved[] = $connection->reference->code;
            }
        }

        $this->assertSame(['DOC-009'], $resolved);
    }

    /**
     * Penanda bebas tetap tersimpan utuh di database: accessor hanya menyaring
     * saat dibaca sebagai relasi, bukan merusak jejak audit.
     */
    #[Test]
    public function raw_marker_value_is_preserved_in_the_database(): void {
        $document = AuditRowTestDocument::create(['code' => 'DOC-007']);

        $connection = ModelConnection::create([
            'model_type'     => AuditRowTestDocument::class,
            'model_id'       => $document->id,
            'reference_type' => 'mark_done',
            'reference_id'   => (string) Str::ulid(),
        ]);

        $raw = DB::table('model_connections')->where('id', $connection->id)->first();

        $this->assertSame('mark_done', $raw->reference_type);
        $this->assertNull($connection->reference_type);
    }

    /**
     * Baris dengan reference_type kelas model yang sah tetap mengisi display,
     * supaya guard tidak diam-diam melumpuhkan jalur normal.
     */
    #[Test]
    public function regular_model_row_still_resolves_its_display(): void {
        $from = AuditRowTestDocument::create(['code' => 'DOC-003']);
        $to   = AuditRowTestDocument::create(['code' => 'DOC-004']);

        ModelConnection::createConnection([
            'model'     => $from,
            'reference' => $to,
        ]);

        $connection = ModelConnection::sole();
        $this->assertSame('DOC-003', $connection->model_display);
        $this->assertSame('DOC-004', $connection->reference_display);
    }
}
