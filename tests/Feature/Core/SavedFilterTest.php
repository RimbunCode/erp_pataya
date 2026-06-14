<?php

namespace Tests\Feature\Core;

use App\Models\Core\ApprovalScheme;
use App\Models\Core\Branch;
use App\Models\Core\SavedFilter;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model stub yang memakai trait DataTable untuk menguji integrasi scope + fid.
 */
class FilterScopeRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'filter_scope_records';
    protected $guarded = ['id'];
}

class SavedFilterTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Global scope HasExampleData butuh kolom is_example (ditambah via initPermissions di prod).
        foreach (['users', 'approval_schemes', 'saved_filters', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('filter_scope_records')) {
            Schema::create('filter_scope_records', function ($t) {
                $t->ulid('id')->primary();
                $t->string('name')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    private function seedScopeRecords(): void {
        FilterScopeRecord::insert([
            ['id' => 's1', 'name' => 'Apple', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 's2', 'name' => 'Banana', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function makeUser(): User {
        $id = (string) str()->ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => 'User ' . $id,
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    /**
     * @return array<string,mixed>
     */
    private function sampleTree(string $value = 'foo'): array {
        return ['root' => ['k' => 'and', 'c' => [
            'i1' => ['k' => 'name', 'o' => 'matches', 'v' => $value],
        ]]];
    }

    public function test_store_creates_ephemeral_and_returns_id(): void {
        $user = $this->makeUser();

        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => ApprovalScheme::class,
            'filter' => $this->sampleTree(),
        ]);

        $res->assertOk()->assertJsonStructure(['id']);
        $this->assertDatabaseHas('saved_filters', [
            'id'       => $res->json('id'),
            'user_id'  => $user->id,
            'model'    => ApprovalScheme::class,
            'is_saved' => false,
        ]);
    }

    public function test_store_rejects_invalid_model(): void {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => 'App\\Models\\NotAModel',
            'filter' => $this->sampleTree(),
        ])->assertStatus(422);
    }

    public function test_store_drops_invalid_items_and_keeps_valid(): void {
        $user = $this->makeUser();

        // i1 valid (name matches), i2 invalid (operator kosong → di-drop).
        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => FilterScopeRecord::class,
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple'],
                'i2' => ['k' => 'name', 'o' => '', 'v' => ''],
            ]]],
        ]);

        $res->assertOk();
        $saved    = SavedFilter::find($res->json('id'));
        $children = $saved->filter['root']['c'];
        $this->assertCount(1, $children, 'item invalid harus ter-drop');
        $this->assertSame('matches', reset($children)['o']);
    }

    public function test_store_rejects_when_no_valid_items_remain(): void {
        $user = $this->makeUser();

        // Semua item tak lengkap → tree kosong setelah clean → 422.
        $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => FilterScopeRecord::class,
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => ''],
                'i2' => ['k' => '', 'o' => '', 'v' => ''],
            ]]],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter']);
    }

    public function test_store_collapses_empty_group(): void {
        $user = $this->makeUser();

        // Grup g1 berisi hanya item invalid → grup kosong → di-drop; i1 tetap.
        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => FilterScopeRecord::class,
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple'],
                'g1' => ['k' => 'or', 'c' => [
                    'i2' => ['k' => 'name', 'o' => '', 'v' => ''],
                ]],
            ]]],
        ]);

        $res->assertOk();
        $saved    = SavedFilter::find($res->json('id'));
        $children = $saved->filter['root']['c'];
        $this->assertCount(1, $children, 'grup kosong harus ter-drop');
        $this->assertArrayNotHasKey('g1', $children);
    }

    public function test_show_returns_ephemeral_filter_by_id(): void {
        $user  = $this->makeUser();
        $saved = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => ApprovalScheme::class,
            'filter'   => $this->sampleTree('Apple'),
            'is_saved' => false, // ephemeral
        ]);

        $this->actingAs($user)
            ->getJson("/saved-filters/{$saved->id}")
            ->assertOk()
            ->assertJsonPath('id', $saved->id)
            ->assertJsonPath('filter.root.c.i1.v', 'Apple');
    }

    public function test_show_allows_non_owner_filter_but_hides_name(): void {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        $saved = SavedFilter::create([
            'user_id'  => $owner->id,
            'model'    => ApprovalScheme::class,
            'filter'   => $this->sampleTree('Apple'),
            'name'     => 'Privat Owner',
            'is_saved' => true,
        ]);

        // Share-link lintas user: non-owner boleh memuat tree (untuk dipakai
        // sebagai awalan), tapi `name` (label pribadi) disembunyikan.
        $this->actingAs($other)->getJson("/saved-filters/{$saved->id}")
            ->assertOk()
            ->assertJsonPath('filter.root.c.i1.v', 'Apple')
            ->assertJsonPath('name', null);

        // Owner tetap melihat name.
        $this->actingAs($owner)->getJson("/saved-filters/{$saved->id}")
            ->assertOk()
            ->assertJsonPath('name', 'Privat Owner');
    }

    public function test_fid_filters_index_results(): void {
        $user = $this->makeUser();
        $this->seedScopeRecords();

        $saved = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => FilterScopeRecord::class,
            'filter'   => $this->sampleTree('Apple'),
            'is_saved' => false,
        ]);

        $request = Request::create('/x', 'GET', ['fid' => $saved->id], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        $this->assertEqualsCanonicalizing(['s1'], $ids);
    }

    public function test_fid_is_accessible_by_other_user(): void {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        $this->seedScopeRecords();

        $saved = SavedFilter::create([
            'user_id' => $owner->id, 'model' => FilterScopeRecord::class,
            'filter'  => $this->sampleTree('Apple'), 'is_saved' => false,
        ]);

        // user lain memakai fid — tetap apply (by-id terbuka)
        $request = Request::create('/x', 'GET', ['fid' => $saved->id], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $request->setUserResolver(fn () => $other);
        $result = FilterScopeRecord::dataTable($request);
        $ids    = collect($result['data']->items())->pluck('id')->all();
        $this->assertEqualsCanonicalizing(['s1'], $ids);
    }

    public function test_fid_model_mismatch_is_ignored(): void {
        $user = $this->makeUser();
        $this->seedScopeRecords();

        // saved filter milik model lain
        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => Branch::class,
            'filter'  => $this->sampleTree('NoMatch'), 'is_saved' => false,
        ]);

        $request = Request::create('/x', 'GET', ['fid' => $saved->id], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        // mismatch → filter diabaikan → semua row tampil
        $this->assertCount(2, $result['data']->items());
    }

    public function test_show_uses_query_param(): void {
        $this->makeUser();

        $request = Request::create('/x', 'GET', ['show' => 10], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);

        $this->assertSame(10, $result['data']->perPage());
    }

    public function test_show_query_param_overrides_cookie(): void {
        $this->makeUser();

        $request = Request::create('/x', 'GET', ['show' => 10], cookies: ['datatable_show' => '50'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);

        // query param menang atas cookie
        $this->assertSame(10, $result['data']->perPage());
    }

    public function test_show_falls_back_to_cookie(): void {
        $this->makeUser();

        $request = Request::create('/x', 'GET', [], cookies: ['datatable_show' => '50'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);

        $this->assertSame(50, $result['data']->perPage());
    }

    public function test_show_invalid_value_clamps_to_default(): void {
        $this->makeUser();

        // nilai <= 0 di-clamp ke 25
        $request = Request::create('/x', 'GET', ['show' => 0], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);

        $this->assertSame(25, $result['data']->perPage());
    }

    public function test_show_from_query_param_persists_cookie(): void {
        $this->makeUser();

        $request = Request::create('/records', 'GET', ['show' => 10], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        FilterScopeRecord::dataTable($request);

        $cookie = collect(Cookie::getQueuedCookies())
            ->first(fn ($c) => $c->getName() === 'datatable_show');

        $this->assertNotNull($cookie, 'cookie datatable_show harus di-queue saat show dari query param');
        $this->assertSame('10', $cookie->getValue());
        $this->assertSame('/records', $cookie->getPath());
    }

    public function test_show_from_cookie_does_not_requeue(): void {
        $this->makeUser();

        // tanpa query param → cookie tidak perlu di-set ulang
        $request = Request::create('/records', 'GET', [], cookies: ['datatable_show' => '50'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        FilterScopeRecord::dataTable($request);

        $cookie = collect(Cookie::getQueuedCookies())->first(fn ($c) => $c->getName() === 'datatable_show');
        $this->assertNull($cookie);
    }

    public function test_sort_ascending_orders_by_key(): void {
        $this->makeUser();
        $this->seedScopeRecords(); // s1=Apple, s2=Banana

        $request = Request::create('/x', 'GET', ['sort' => 'name'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        // asc by name → Apple (s1) dulu, lalu Banana (s2)
        $this->assertSame(['s1', 's2'], $ids);
    }

    public function test_sort_descending_with_dash_prefix(): void {
        $this->makeUser();
        $this->seedScopeRecords();

        $request = Request::create('/x', 'GET', ['sort' => '-name'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        // desc by name → Banana (s2) dulu, lalu Apple (s1)
        $this->assertSame(['s2', 's1'], $ids);
    }

    public function test_sort_defaults_to_created_at_desc(): void {
        $this->makeUser();
        // s1 dibuat lebih dulu (created_at lebih lama), s2 lebih baru.
        FilterScopeRecord::insert([
            ['id' => 's1', 'name' => 'Apple', 'is_example' => false, 'created_at' => now()->subMinute(), 'updated_at' => now()],
            ['id' => 's2', 'name' => 'Banana', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // tanpa ?sort= → default `-created_at` (desc) → s2 (terbaru) dulu
        $request = Request::create('/x', 'GET', [], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        $this->assertSame(['s2', 's1'], $ids);
    }

    public function test_update_promotes_to_named_owner_only(): void {
        $owner = $this->makeUser();
        $saved = SavedFilter::create([
            'user_id' => $owner->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'is_saved' => false,
        ]);

        $this->actingAs($owner)->patchJson("/saved-filters/{$saved->id}", ['name' => 'My Filter'])->assertOk();
        $this->assertDatabaseHas('saved_filters', ['id' => $saved->id, 'is_saved' => true, 'name' => 'My Filter']);
    }

    public function test_update_by_non_owner_forbidden(): void {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        $saved = SavedFilter::create([
            'user_id' => $owner->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'is_saved' => false,
        ]);

        $this->actingAs($other)->patchJson("/saved-filters/{$saved->id}", ['name' => 'Hijack'])->assertStatus(403);
    }

    public function test_index_listing_is_private(): void {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        SavedFilter::create(['user_id' => $owner->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => true, 'name' => 'A']);

        // owner melihat
        $this->actingAs($owner)->getJson('/saved-filters?model=' . urlencode(ApprovalScheme::class))->assertOk()->assertJsonCount(1);
        // user lain tidak melihat
        $this->actingAs($other)->getJson('/saved-filters?model=' . urlencode(ApprovalScheme::class))->assertOk()->assertJsonCount(0);
    }

    public function test_index_excludes_ephemeral(): void {
        $owner = $this->makeUser();
        SavedFilter::create(['user_id' => $owner->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => false]);

        $this->actingAs($owner)->getJson('/saved-filters?model=' . urlencode(ApprovalScheme::class))->assertOk()->assertJsonCount(0);
    }

    public function test_destroy_owner_only(): void {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        $saved = SavedFilter::create(['user_id' => $owner->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => true, 'name' => 'A']);

        $this->actingAs($other)->deleteJson("/saved-filters/{$saved->id}")->assertStatus(403);
        $this->actingAs($owner)->deleteJson("/saved-filters/{$saved->id}")->assertOk();
        $this->assertDatabaseMissing('saved_filters', ['id' => $saved->id]);
    }

    public function test_prune_removes_old_ephemeral_keeps_named(): void {
        $user         = $this->makeUser();
        $oldEphemeral = SavedFilter::create(['user_id' => $user->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => false]);
        $oldEphemeral->forceFill(['created_at' => now()->subDays(10)])->save();

        $freshEphemeral = SavedFilter::create(['user_id' => $user->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => false]);
        $oldNamed       = SavedFilter::create(['user_id' => $user->id, 'model' => ApprovalScheme::class, 'filter' => $this->sampleTree(), 'is_saved' => true, 'name' => 'Keep']);
        $oldNamed->forceFill(['created_at' => now()->subDays(30)])->save();

        $this->artisan('saved-filters:prune')->assertSuccessful();

        $this->assertDatabaseMissing('saved_filters', ['id' => $oldEphemeral->id]);
        $this->assertDatabaseHas('saved_filters', ['id' => $freshEphemeral->id]);
        $this->assertDatabaseHas('saved_filters', ['id' => $oldNamed->id]);
    }
}
