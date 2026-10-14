<?php

namespace Tests\Feature\Core;

use App\Http\Controllers\Core\FileController;
use App\Http\Controllers\Core\TagController;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Country;
use App\Models\Core\Tag;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DestroyManyTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }

        if (! Schema::hasColumn('suppliers', 'created_by_id')) {
            Schema::table('suppliers', fn ($t) => $t->string('created_by_id')->nullable());
        }

        // Migrasi suppliers belum memuat kolom tree (TreeView) yang dipakai factory.
        foreach (['parent_id' => 'string', 'lft' => 'unsignedInteger', 'rgt' => 'unsignedInteger', 'depth' => 'unsignedInteger'] as $column => $type) {
            if (! Schema::hasColumn('suppliers', $column)) {
                Schema::table('suppliers', fn ($t) => $t->{$type}($column)->nullable());
            }
        }

        // SupplierFactory memakai country_id yang ber-FK ke countries.
        Country::factory()->create(['code' => 'IDN']);
    }

    /**
     * Permission session untuk Supplier dan Tag.
     *
     * @return array<string, mixed>
     */
    private function permissions(bool $onlyCreator = false): array {
        $build = fn (string $model): array => [
            0 => [
                [
                    'model'        => $model,
                    'level'        => 0,
                    'only_creator' => $onlyCreator,
                    'permissions'  => [
                        'select' => true,
                        'read'   => true,
                        'write'  => true,
                        'create' => true,
                        'delete' => true,
                    ],
                ],
            ],
        ];

        return [
            'permissions' => [
                Supplier::class => $build(Supplier::class),
                Tag::class      => $build(Tag::class),
            ],
        ];
    }

    /**
     * @param  iterable<Supplier>  $suppliers
     * @return list<string>
     */
    private function ids(iterable $suppliers): array {
        return collect($suppliers)->pluck('id')->all();
    }

    public function test_bulk_delete_removes_all_records_in_one_request(): void {
        $user      = User::factory()->create();
        $suppliers = SupplierFactory::new()->count(3)->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->delete(route('suppliers.destroyMany'), ['ids' => $this->ids($suppliers)])
            ->assertRedirect(route('suppliers.index'))
            ->assertSessionHas('success', __('core.datatable.deleted_count', ['count' => 3]));

        foreach ($suppliers as $supplier) {
            $this->assertSoftDeleted($supplier);
        }
    }

    public function test_bulk_delete_accepts_ulid_string_ids(): void {
        $user     = User::factory()->create();
        $supplier = SupplierFactory::new()->create();

        $this->assertIsString($supplier->id);
        $this->assertSame(26, \strlen($supplier->id));

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('suppliers.destroyMany'), ['ids' => [$supplier->id]])
            ->assertRedirect(route('suppliers.index'));

        $this->assertSoftDeleted($supplier);
    }

    public function test_bulk_delete_validates_ids(): void {
        $user     = User::factory()->create();
        $supplier = SupplierFactory::new()->create();

        $this->actingAs($user)->withSession($this->permissions());

        $this->deleteJson(route('suppliers.destroyMany'), ['ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);

        $this->deleteJson(route('suppliers.destroyMany'), ['ids' => [$supplier->id, $supplier->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids.1']);

        foreach ([[['foo']], [123], [true]] as $invalidIds) {
            $this->deleteJson(route('suppliers.destroyMany'), ['ids' => $invalidIds])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['ids.0']);
        }

        $tooMany = array_map(fn (int $i): string => (string) $i, range(1, 501));
        $this->deleteJson(route('suppliers.destroyMany'), ['ids' => $tooMany])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);

        $this->assertNotSoftDeleted($supplier);
    }

    public function test_bulk_delete_returns_404_and_deletes_nothing_when_an_id_is_missing(): void {
        $user  = User::factory()->create();
        $valid = SupplierFactory::new()->count(2)->create();

        $this->actingAs($user)->withSession($this->permissions());

        $this->deleteJson(route('suppliers.destroyMany'), [
            'ids' => [...$this->ids($valid), '01NOTEXIST00000000000000A'],
        ])->assertNotFound();

        foreach ($valid as $supplier) {
            $this->assertNotSoftDeleted($supplier);
        }

        $alreadyDeleted = SupplierFactory::new()->create();
        $alreadyDeleted->delete();

        $this->deleteJson(route('suppliers.destroyMany'), [
            'ids' => [...$this->ids($valid), $alreadyDeleted->id],
        ])->assertNotFound();

        foreach ($valid as $supplier) {
            $this->assertNotSoftDeleted($supplier);
        }
    }

    public function test_bulk_delete_rolls_back_all_when_one_record_fails_guard(): void {
        Supplier::deleting(function (Supplier $supplier): void {
            if ($supplier->name === 'BLOCKED') {
                throw ValidationException::withMessages(['delete' => 'Tidak boleh']);
            }
        });

        $user    = User::factory()->create();
        $normal  = SupplierFactory::new()->count(2)->create();
        $blocked = SupplierFactory::new()->create(['name' => 'BLOCKED']);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('suppliers.destroyMany'), [
                'ids' => [...$this->ids($normal), $blocked->id],
            ])
            ->assertUnprocessable();

        $message = $response->json('errors.delete.0');
        $this->assertStringContainsString('BLOCKED', $message);
        $this->assertStringContainsString('Tidak boleh', $message);

        foreach ([...$normal, $blocked] as $supplier) {
            $this->assertNotSoftDeleted($supplier);
        }

        Event::forget('eloquent.deleting: ' . Supplier::class);
    }

    public function test_bulk_delete_names_the_record_when_a_guard_aborts_with_http_exception(): void {
        Supplier::deleting(function (Supplier $supplier): void {
            if ($supplier->name === 'LOCKED') {
                abort(403);
            }
        });

        $user   = User::factory()->create();
        $normal = SupplierFactory::new()->create();
        $locked = SupplierFactory::new()->create(['name' => 'LOCKED']);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('suppliers.destroyMany'), ['ids' => [$normal->id, $locked->id]])
            ->assertUnprocessable();

        $this->assertStringContainsString('LOCKED', $response->json('errors.delete.0'));
        $this->assertStringContainsString(__('core.datatable.delete_not_allowed'), $response->json('errors.delete.0'));
        $this->assertNotSoftDeleted($normal);
        $this->assertNotSoftDeleted($locked);

        Event::forget('eloquent.deleting: ' . Supplier::class);
    }

    public function test_bulk_destroy_prop_is_shared_only_for_controllers_that_support_it(): void {
        $user = User::factory()->create();
        $this->actingAs($user)->withSession($this->permissions());

        $this->getJson(route('suppliers.index'), ['X-Inertia' => 'true'])
            ->assertOk()
            ->assertJsonPath('props.bulkDestroy', true);

        // TagController::index bukan halaman Inertia; setelah request, router masih
        // menunjuk ke route tags.index sehingga supportsBulkDestroy() dapat diperiksa.
        $this->getJson(route('tags.index'))->assertOk();

        $controller = (new \ReflectionClass(TagController::class))->newInstanceWithoutConstructor();
        $method     = new \ReflectionMethod($controller, 'supportsBulkDestroy');

        $this->assertFalse($method->invoke($controller));
    }

    public function test_bulk_delete_forbidden_when_only_creator_and_a_record_belongs_to_another_user(): void {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $mine   = SupplierFactory::new()->count(2)->create(['created_by_id' => $user->id]);
        $theirs = SupplierFactory::new()->create(['created_by_id' => $other->id]);

        $this->actingAs($user)->withSession($this->permissions(onlyCreator: true));

        $this->deleteJson(route('suppliers.destroyMany'), [
            'ids' => [...$this->ids($mine), $theirs->id],
        ])->assertForbidden();

        foreach ([...$mine, $theirs] as $supplier) {
            $this->assertNotSoftDeleted($supplier);
        }

        $this->deleteJson(route('suppliers.destroyMany'), ['ids' => $this->ids($mine)])
            ->assertRedirect(route('suppliers.index'));

        foreach ($mine as $supplier) {
            $this->assertSoftDeleted($supplier);
        }
        $this->assertNotSoftDeleted($theirs);
    }

    public function test_bulk_delete_returns_405_for_controller_with_custom_destroy(): void {
        $user = User::factory()->create();
        $tag  = Tag::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('tags.destroyMany'), ['ids' => [$tag->id]])
            ->assertStatus(405);

        $this->assertDatabaseHas('tags', ['id' => $tag->id]);
    }

    public function test_single_destroy_still_works(): void {
        $user     = User::factory()->create();
        $supplier = SupplierFactory::new()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->delete(route('suppliers.destroy', $supplier->id))
            ->assertRedirect(route('suppliers.index'));

        $this->assertSoftDeleted($supplier);
    }

    public function test_model_less_controller_rejects_bulk_delete(): void {
        $this->actingAs(User::factory()->create())
            ->deleteJson(route('files.destroyMany'), ['ids' => ['some-file']])
            ->assertStatus(405);

        $controller = (new \ReflectionClass(FileController::class))->newInstanceWithoutConstructor();
        $method     = new \ReflectionMethod($controller, 'supportsBulkDestroy');
        $this->assertFalse($method->invoke($controller));
    }

    public function test_bulk_delete_labels_domain_guard_errors_and_rolls_back(): void {
        Supplier::deleting(function (Supplier $supplier): void {
            if ($supplier->name === 'DOMAIN BLOCKED') {
                throw new \LogicException('Subtree contains assets');
            }
        });

        try {
            $normal   = SupplierFactory::new()->create();
            $blocked  = SupplierFactory::new()->create(['name' => 'DOMAIN BLOCKED']);
            $response = $this->actingAs(User::factory()->create())
                ->withSession($this->permissions())
                ->deleteJson(route('suppliers.destroyMany'), ['ids' => [$normal->id, $blocked->id]])
                ->assertUnprocessable();

            $this->assertStringContainsString('DOMAIN BLOCKED', $response->json('errors.delete.0'));
            $this->assertStringContainsString('Subtree contains assets', $response->json('errors.delete.0'));
            $this->assertNotSoftDeleted($normal);
            $this->assertNotSoftDeleted($blocked);
        } finally {
            Event::forget('eloquent.deleting: ' . Supplier::class);
        }
    }

    public function test_bulk_delete_loads_records_inside_its_transaction(): void {
        $supplier                = SupplierFactory::new()->create();
        $initialTransactionLevel = DB::transactionLevel();
        $selectTransactionLevels = [];
        DB::listen(function ($query) use (&$selectTransactionLevels): void {
            if (str_starts_with($query->sql, 'select') && str_contains($query->sql, '"suppliers"') && str_contains($query->sql, ' in ')) {
                $selectTransactionLevels[] = $query->connection->transactionLevel();
            }
        });

        $this->actingAs(User::factory()->create())
            ->withSession($this->permissions())
            ->deleteJson(route('suppliers.destroyMany'), ['ids' => [$supplier->id]])
            ->assertRedirect(route('suppliers.index'));

        $this->assertNotEmpty($selectTransactionLevels);
        foreach ($selectTransactionLevels as $transactionLevel) {
            $this->assertGreaterThan($initialTransactionLevel, $transactionLevel);
        }
    }
}
