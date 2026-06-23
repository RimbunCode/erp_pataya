<?php

namespace Tests\Feature\Traits;

use App\Models\Model as AppModel;
use App\Services\Core\FilterColumnResolver;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model relasi (parent) untuk menguji FK BelongsTo + kolom anak relasi.
 */
class IncludeHiddenCategory extends AppModel {
    use HasUlids;

    protected $table   = 'include_hidden_categories';
    protected $guarded = ['id'];
    public $timestamps = true;
}

/**
 * Model uji nyata yang memakai trait LinkModel asli (getColumns sesungguhnya).
 * - `category_id` adalah FK BelongsTo — di-flag ignore (default ter-skip).
 * - `secret_note` ditandai `ignore:true` via configColumns (default ter-skip).
 * - `visible_note` ditandai `hidden:true` via configColumns — tetap tampil di getColumns default,
 *   tersembunyi di FE (ColumnsFilter, FilterItem, dll).
 */
class IncludeHiddenRecord extends AppModel {
    use HasUlids;

    protected $table               = 'include_hidden_records';
    protected $guarded             = ['id'];
    public $timestamps             = true;
    protected array $configColumns = [
        'secret_note'  => ['ignore' => true],
        'visible_note' => ['hidden' => true, 'linkable' => true],
        'category'     => [],
    ];

    public function category(): BelongsTo {
        return $this->belongsTo(IncludeHiddenCategory::class, 'category_id');
    }
}

class GetColumnsIncludeHiddenTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('include_hidden_categories', function ($t) {
            $t->ulid('id')->primary();
            $t->string('type')->nullable();
            $t->timestamps();
        });

        Schema::create('include_hidden_records', function ($t) {
            $t->ulid('id')->primary();
            $t->ulid('category_id')->nullable();
            $t->string('name')->nullable();
            $t->string('secret_note')->nullable();
            $t->string('visible_note')->nullable();
            $t->timestamps();
        });
    }

    /** @param array<int|string,array<string,mixed>> $columns */
    private function byName(array $columns, string $name): ?array {
        foreach ($columns as $col) {
            if (($col['name'] ?? null) === $name) {
                return $col;
            }
        }

        return null;
    }

    public function test_default_drops_fk_and_ignored_columns(): void {
        $columns = IncludeHiddenRecord::getColumns(1);

        $this->assertNull($this->byName($columns, 'category_id'), 'FK column harus absen di getColumns default');
        $this->assertNull($this->byName($columns, 'secret_note'), 'kolom ignore harus absen di getColumns default');
        // relasi tetap ada
        $this->assertNotNull($this->byName($columns, 'category'), 'relasi category tetap ada');
    }

    public function test_hidden_column_present_in_default_getcolumns(): void {
        $columns = IncludeHiddenRecord::getColumns(1);

        $col = $this->byName($columns, 'visible_note');
        $this->assertNotNull($col, 'kolom hidden:true harus tetap ada di getColumns default');
        $this->assertTrue($col['hidden'] ?? false, 'kolom harus ber-flag hidden');
        $this->assertFalse($col['ignore'] ?? false, 'kolom hidden:true tidak boleh ber-flag ignore');
        $this->assertTrue($col['linkable'] ?? false, 'kolom hidden:true harus tetap linkable');
    }

    public function test_include_ignore_emits_fk_with_ignore_flag(): void {
        $columns = IncludeHiddenRecord::getColumns(1, true);

        $fk = $this->byName($columns, 'category_id');
        $this->assertNotNull($fk, 'FK column harus muncul saat includeIgnore=true');
        $this->assertTrue($fk['ignore'] ?? false, 'FK harus ber-flag ignore');
        $this->assertTrue($fk['hidden'] ?? false, 'FK harus ber-flag hidden');
        $this->assertFalse($fk['searchable'] ?? true, 'FK harus searchable:false');
        $this->assertFalse($fk['show'] ?? true, 'FK harus show:false');
    }

    public function test_include_ignore_emits_ignored_with_ignore_flag(): void {
        $columns = IncludeHiddenRecord::getColumns(1, true);

        $col = $this->byName($columns, 'secret_note');
        $this->assertNotNull($col, 'kolom ignore harus muncul saat includeIgnore=true');
        $this->assertTrue($col['ignore'] ?? false, 'kolom harus ber-flag ignore');
        $this->assertTrue($col['hidden'] ?? false, 'kolom ignore harus ber-flag hidden');
        $this->assertFalse($col['searchable'] ?? true, 'kolom ignore harus searchable:false');
    }

    public function test_resolver_can_resolve_fk_column_from_superset(): void {
        $columns  = IncludeHiddenRecord::getColumns(1, true);
        $resolver = new FilterColumnResolver($columns);

        $this->assertNotNull($resolver->resolve('category_id'), 'resolver harus menemukan FK di superset');

        $path = $resolver->resolvePath('category_id');
        $this->assertNotNull($path, 'resolvePath harus mengembalikan path FK');
        $this->assertSame('category_id', $path['columnName']);
    }

    public function test_resolver_cannot_resolve_fk_from_default_set(): void {
        $columns  = IncludeHiddenRecord::getColumns(1);
        $resolver = new FilterColumnResolver($columns);

        $this->assertNull($resolver->resolve('category_id'), 'tanpa superset FK tak ter-resolve');
    }

    public function test_resolver_can_resolve_hidden_column_from_default_set(): void {
        // hidden:true (bukan ignore) ada di getColumns default — resolver harus menemukannya
        $columns  = IncludeHiddenRecord::getColumns(1);
        $resolver = new FilterColumnResolver($columns);

        $this->assertNotNull($resolver->resolve('visible_note'), 'kolom hidden:true harus ter-resolve dari default set');
    }
}
