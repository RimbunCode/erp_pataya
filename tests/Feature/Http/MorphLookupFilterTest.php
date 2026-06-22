<?php

namespace Tests\Feature\Http;

use App\Models\Model as AppModel;
use App\Services\Core\PermissionChecker;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Child morph BER-LinkModel: punya kolom sensitif `price` (non-linkable) yang
 * HARUS tersaring walau morph child tak bisa di-prune di SELECT.
 */
class MorphDocStub extends AppModel {
    use HasUlids;

    protected $table               = 'morph_docs';
    protected $guarded             = ['id'];
    public $timestamps             = false;
    protected array $configColumns = [
        'price' => [], // non-linkable → tak pernah keluar
    ];

    public static function templateLink() {
        return ':code';
    }
}

/**
 * Child morph ASING: model Eloquent biasa TANPA getColumns (bukan LinkModel).
 * Fail-closed → seluruh relasi morph harus dibuang dari response.
 */
class MorphAlienStub extends EloquentModel {
    use HasUlids;

    protected $table   = 'morph_aliens';
    protected $guarded = [];
    public $timestamps = false;
}

/**
 * Induk dengan relasi morphTo `document`.
 */
class MorphHolderStub extends AppModel {
    use HasUlids;

    protected $table               = 'morph_holders';
    protected $guarded             = ['id'];
    public $timestamps             = false;
    protected array $configColumns = [
        'document' => ['show' => true],
    ];

    public function document(): MorphTo {
        return $this->morphTo('document', 'document_type', 'document_id');
    }

    public static function templateLink() {
        return ':name';
    }
}

class MorphLookupFilterTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();

        Schema::create('morph_docs', function ($t): void {
            $t->ulid('id')->primary();
            $t->string('code')->nullable();
            $t->string('price')->nullable();
        });
        Schema::create('morph_aliens', function ($t): void {
            $t->ulid('id')->primary();
            $t->string('secret_alien')->nullable();
        });
        Schema::create('morph_holders', function ($t): void {
            $t->ulid('id')->primary();
            $t->string('name')->nullable();
            $t->string('document_type')->nullable();
            $t->string('document_id')->nullable();
        });
    }

    private function lookup(array $body) {
        $this->app->instance(PermissionChecker::class, new PermissionChecker([]));

        return $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [...$body, 'model' => MorphHolderStub::class]);
    }

    public function test_morph_child_sensitive_column_filtered_from_response(): void {
        // HasUlids auto-generate id → ambil id hasil create untuk FK morph holder.
        $doc = MorphDocStub::create(['code' => 'DOC-1', 'price' => '9999']);
        MorphHolderStub::create(['name' => 'Holder', 'document_type' => MorphDocStub::class, 'document_id' => $doc->id]);

        $row = $this->lookup(['fields' => ['document', 'document.code']])->json('data.0') ?? [];

        $this->assertArrayHasKey('document', $row);
        $this->assertIsArray($row['document']);
        // Kolom aman child (code/templateLink) lolos; price (non-linkable) tersaring.
        $this->assertArrayHasKey('code', $row['document']);
        $this->assertArrayNotHasKey('price', $row['document']);
    }

    public function test_alien_morph_class_relation_dropped_fail_closed(): void {
        $alien = MorphAlienStub::create(['secret_alien' => 'TOPSECRET']);
        MorphHolderStub::create(['name' => 'Holder2', 'document_type' => MorphAlienStub::class, 'document_id' => $alien->id]);

        $row = $this->lookup(['fields' => ['document']])->json('data.0') ?? [];

        // Class morph tanpa getColumns → seluruh relasi document dibuang.
        $this->assertArrayNotHasKey('document', $row);
    }
}
