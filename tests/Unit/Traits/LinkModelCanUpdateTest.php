<?php

namespace Tests\Unit\Traits;

use App\Models\Model as AppModel;
use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class CanUpdateTestParent extends AppModel {
    use HasUlids, LinkModel;

    protected $table   = 'can_update_test_parents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }

    public function items(): HasMany {
        return $this->hasMany(CanUpdateTestChild::class, 'parent_id');
    }
}

class CanUpdateTestParentBoolOverride extends CanUpdateTestParent {
    public function canUpdate(): bool {
        return false;
    }
}

class CanUpdateTestParentFieldOverride extends CanUpdateTestParent {
    public function canUpdate(): bool|array {
        return [
            'customer' => true,
            'items'    => fn ($item) => [
                'qty' => ! $item->locked,
            ],
        ];
    }
}

class CanUpdateTestParentClosureFieldOverride extends CanUpdateTestParent {
    public function canUpdate(): bool|array {
        return [
            'customer' => fn ($row) => $row->code === 'ALLOWED',
        ];
    }
}

class CanUpdateTestChild extends AppModel {
    use HasUlids, LinkModel;

    protected $table   = 'can_update_test_children';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

/**
 * Property 1 — default canUpdate === true tanpa override (show context).
 * Property 3 — hasil akhir canUpdate tidak mengandung instance Closure,
 * termasuk pada child row items[] (json_encode tidak exception).
 * Property 8 — child model TIDAK punya getCanUpdateAttribute()/canUpdate()
 * yang dideklarasikan langsung di class-nya sendiri.
 */
class LinkModelCanUpdateTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('can_update_test_parents')) {
            Schema::create('can_update_test_parents', function ($t) {
                $t->ulid('id')->primary();
                $t->string('code')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
                $t->softDeletes();
            });
        }
        if (! Schema::hasTable('can_update_test_children')) {
            Schema::create('can_update_test_children', function ($t) {
                $t->ulid('id')->primary();
                $t->char('parent_id', 26)->nullable();
                $t->boolean('locked')->default(false);
                $t->boolean('is_example')->default(false);
                $t->timestamps();
                $t->softDeletes();
            });
        }
    }

    private function makeParent(string $class, array $childrenLocked = []): object {
        $id = (string) Str::ulid();
        $class::query()->getConnection()->table('can_update_test_parents')->insert([
            'id'         => $id,
            'code'       => 'ALLOWED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($childrenLocked as $locked) {
            $class::query()->getConnection()->table('can_update_test_children')->insert([
                'id'         => (string) Str::ulid(),
                'parent_id'  => $id,
                'locked'     => $locked,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $model = $class::find($id);
        $model->markAsShowContext();
        $model->load('items');

        return $model;
    }

    public function test_default_can_update_is_true_without_override(): void {
        $parent = $this->makeParent(CanUpdateTestParent::class);

        $this->assertTrue($parent->canUpdate);
    }

    public function test_bool_override_is_returned_as_is(): void {
        $parent = $this->makeParent(CanUpdateTestParentBoolOverride::class);

        $this->assertFalse($parent->canUpdate);
    }

    public function test_field_level_closure_resolved_without_leaking_closure(): void {
        $parent = $this->makeParent(CanUpdateTestParentClosureFieldOverride::class);

        $this->assertIsArray($parent->canUpdate);
        $this->assertTrue($parent->canUpdate['customer']);
        $this->assertJson(\json_encode($parent->canUpdate));
    }

    public function test_relation_closure_evaluated_per_child_row_with_different_results(): void {
        $parent = $this->makeParent(CanUpdateTestParentFieldOverride::class, [true, false]);

        // Akses canUpdate DULU — accessor lazy, closure level-relasi baru
        // dievaluasi (dan di-attach ke child row) saat ini dipanggil.
        $rootCanUpdate = $parent->canUpdate;

        $items = $parent->items;
        $this->assertCount(2, $items);

        $lockedRow   = $items->firstWhere('locked', true);
        $unlockedRow = $items->firstWhere('locked', false);

        $this->assertFalse($lockedRow->canUpdate['qty']);
        $this->assertTrue($unlockedRow->canUpdate['qty']);

        // root: field relasi many tetap true (whole-relation allowed).
        $this->assertTrue($rootCanUpdate['items']);
    }

    public function test_to_array_does_not_contain_closure_instances(): void {
        $parent = $this->makeParent(CanUpdateTestParentFieldOverride::class, [true, false]);

        $array = $parent->toArray();

        // Jika ada Closure yang lolos, json_encode akan gagal/exception.
        $encoded = \json_encode($array);
        $this->assertIsString($encoded);
        $this->assertArrayHasKey('canUpdate', $array['items'][0]);
    }

    /**
     * getCanUpdateAttribute() dari trait LinkModel SAH ada di semua model
     * (termasuk child) — itu accessor generic. Yang TIDAK BOLEH ada di
     * child adalah method CUSTOM canUpdate() (override kontrak permission
     * miliknya sendiri) — sesuai Requirement 2.6, satu-satunya sumber
     * kebenaran adalah canUpdate() milik model ROOT.
     */
    public function test_child_model_does_not_declare_custom_can_update_method(): void {
        $reflection = new \ReflectionClass(CanUpdateTestChild::class);

        $this->assertFalse(
            $reflection->hasMethod('canUpdate') && $reflection->getMethod('canUpdate')->class === CanUpdateTestChild::class,
            'Child model tidak boleh punya method canUpdate() kustom sendiri.',
        );
    }
}
