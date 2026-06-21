<?php

namespace Tests\Feature\Http;

use App\Enums\Permission;
use App\Models\Model as AppModel;
use App\Services\Core\PermissionChecker;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Stub model untuk menguji pembatasan kolom lookup secara terisolasi.
 * templateLink = :name → hanya `name` (+id) default aman.
 */
class SecLookupRecord extends AppModel {
    use HasUlids;

    protected $table               = 'sec_lookup_records';
    protected $guarded             = ['id'];
    public $timestamps             = true;
    protected array $configColumns = [
        'extra'  => ['linkable' => true],                       // boleh diminta
        'secret' => [],                                          // non-linkable → tak pernah keluar
        'priced' => ['linkable' => true, 'visibleFor' => [      // linkable + butuh izin
            ['App\\Models\\Core\\Currency', Permission::Write],
        ]],
    ];

    public static function templateLink() {
        // search dari `name`, display dari `title` → KEDUA kolom harus lolos lookup.
        return ':name{:title}';
    }
}

class LinkModelColumnSecurityTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();

        Schema::create('sec_lookup_records', function ($t): void {
            $t->ulid('id')->primary();
            $t->string('name')->nullable();
            $t->string('title')->nullable();
            $t->string('extra')->nullable();
            $t->string('secret')->nullable();
            $t->string('priced')->nullable();
            $t->timestamps();
        });

        SecLookupRecord::create(['id' => 'r1', 'name' => 'Apple', 'title' => 'AppleTitle', 'extra' => 'EX', 'secret' => 'SS', 'priced' => 'PP']);
    }

    /** @param array<string,mixed> $permissions permission map model→level→list */
    private function lookup(array $body, array $permissions = []) {
        $this->app->instance(PermissionChecker::class, new PermissionChecker($permissions));

        return $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [...$body, 'model' => SecLookupRecord::class]);
    }

    private function firstRow($res): array {
        return $res->json('data.0') ?? [];
    }

    public function test_default_returns_only_template_link_columns(): void {
        $row = $this->firstRow($this->lookup([]));

        // templateLink ':name{:title}' → search `name` + display `title` lolos keduanya.
        $this->assertArrayHasKey('name', $row);
        $this->assertArrayHasKey('title', $row);
        $this->assertSame('AppleTitle', $row['title']);
        $this->assertArrayHasKey('id', $row);     // pk
        $this->assertArrayNotHasKey('extra', $row);   // linkable tapi tak diminta
        $this->assertArrayNotHasKey('secret', $row);  // non-linkable
        $this->assertArrayNotHasKey('priced', $row);  // non-diminta
    }

    public function test_requested_linkable_column_returned(): void {
        $row = $this->firstRow($this->lookup(['fields' => ['extra']]));

        $this->assertArrayHasKey('extra', $row);
        $this->assertSame('EX', $row['extra']);
    }

    public function test_non_linkable_column_dropped_even_if_requested(): void {
        // IDOR: minta kolom non-linkable → tetap dibuang.
        $row = $this->firstRow($this->lookup(['fields' => ['secret']]));

        $this->assertArrayNotHasKey('secret', $row);
    }

    public function test_visible_for_blocks_without_permission(): void {
        // priced linkable + visibleFor(Currency:write). Tanpa izin → dibuang.
        $row = $this->firstRow($this->lookup(['fields' => ['priced']], permissions: []));

        $this->assertArrayNotHasKey('priced', $row);
    }

    public function test_visible_for_allows_with_permission(): void {
        $perm = ['App\\Models\\Core\\Currency' => [0 => [['permissions' => ['write' => true]]]]];
        $row  = $this->firstRow($this->lookup(['fields' => ['priced']], permissions: $perm));

        $this->assertArrayHasKey('priced', $row);
        $this->assertSame('PP', $row['priced']);
    }
}
