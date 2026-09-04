<?php

namespace Tests\Feature\Core;

use App\Models\Core\ApprovalScheme;
use App\Models\Core\Branch;
use App\Models\Core\SavedFilter;
use App\Models\Model as AppModel;
use App\Models\User\Permission;
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

    public function test_store_updates_own_ephemeral_when_fid_given(): void {
        $user = $this->makeUser();
        $own  = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => ApprovalScheme::class,
            'filter'   => $this->sampleTree('Old'),
            'is_saved' => false,
        ]);

        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => ApprovalScheme::class,
            'filter' => $this->sampleTree('New'),
            'fid'    => $own->id,
        ]);

        // Row yang sama di-update (id tetap), bukan row baru.
        $res->assertOk()->assertJsonPath('id', $own->id);
        $this->assertSame(1, SavedFilter::where('user_id', $user->id)->count());
        $this->assertSame('New', SavedFilter::find($own->id)->filter['root']['c']['i1']['v']);
    }

    public function test_store_creates_new_when_fid_belongs_to_other_user(): void {
        $owner        = $this->makeUser();
        $other        = $this->makeUser();
        $ownersFilter = SavedFilter::create([
            'user_id'  => $owner->id,
            'model'    => ApprovalScheme::class,
            'filter'   => $this->sampleTree('Owner'),
            'is_saved' => false,
        ]);

        $res = $this->actingAs($other)->postJson('/saved-filters', [
            'model'  => ApprovalScheme::class,
            'filter' => $this->sampleTree('Other'),
            'fid'    => $ownersFilter->id,
        ]);

        // Tidak menimpa row owner; buat row baru milik $other.
        $res->assertOk();
        $this->assertNotSame($ownersFilter->id, $res->json('id'));
        $this->assertSame('Owner', SavedFilter::find($ownersFilter->id)->filter['root']['c']['i1']['v']);
        $this->assertDatabaseHas('saved_filters', [
            'id'      => $res->json('id'),
            'user_id' => $other->id,
        ]);
    }

    public function test_store_creates_new_when_fid_is_named_filter(): void {
        $user  = $this->makeUser();
        $named = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => ApprovalScheme::class,
            'filter'   => $this->sampleTree('Named'),
            'name'     => 'My Named',
            'is_saved' => true,
        ]);

        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => ApprovalScheme::class,
            'filter' => $this->sampleTree('Adhoc'),
            'fid'    => $named->id,
        ]);

        // Named filter tak boleh ditimpa lewat apply; buat ephemeral baru.
        $res->assertOk();
        $this->assertNotSame($named->id, $res->json('id'));
        $this->assertSame('Named', SavedFilter::find($named->id)->filter['root']['c']['i1']['v']);
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

    /**
     * Requirement 5 AC1: saved filter yang punya `sort` ikut diterapkan saat
     * dipakai (?fid=), meski tanpa ?sort= eksplisit di URL.
     */
    public function test_fid_filter_with_sort_overrides_default_sort(): void {
        $user = $this->makeUser();
        $this->seedScopeRecords(); // s1=Apple, s2=Banana

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => FilterScopeRecord::class,
            'filter'  => $this->sampleTree('a'), 'name' => 'A', 'is_saved' => true,
            'sort'    => '-name',
        ]);
        // filter tree tak menyaring apa pun (key 'name' selalu ada) — fokus ke sort.
        $saved->update(['filter' => ['root' => ['k' => 'and', 'c' => []]]]);

        $request = Request::create('/x', 'GET', ['fid' => $saved->id], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        // sort filter '-name' (desc) → Banana (s2) dulu, walau tak ada ?sort= eksplisit.
        $this->assertSame(['s2', 's1'], $ids);
    }

    /**
     * Requirement 5 AC2: filter tanpa `sort` (null) TIDAK memaksa reset —
     * ?sort= eksplisit dari halaman tetap dihormati.
     */
    public function test_fid_filter_without_sort_does_not_override_explicit_sort(): void {
        $user = $this->makeUser();
        $this->seedScopeRecords();

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => FilterScopeRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'name' => 'A', 'is_saved' => true,
            'sort'    => null,
        ]);

        $request = Request::create('/x', 'GET', ['fid' => $saved->id, 'sort' => 'name'], server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $result  = FilterScopeRecord::dataTable($request);
        $ids     = collect($result['data']->items())->pluck('id')->all();

        // ?sort=name (asc) tetap dipakai — Apple (s1) dulu.
        $this->assertSame(['s1', 's2'], $ids);
    }

    /**
     * Requirement 2 AC4 (end-to-end via macro): tanpa fid sama sekali, default
     * shared filter untuk model tsb ikut menerapkan sort-nya.
     */
    public function test_default_filter_sort_applied_without_fid(): void {
        $user = $this->makeUser();
        $this->seedScopeRecords();

        SavedFilter::create([
            'user_id'  => $user->id, 'model' => FilterScopeRecord::class,
            'filter'   => ['root' => ['k' => 'and', 'c' => []]], 'name' => 'Default',
            'is_saved' => true, 'is_shared' => true, 'is_default' => true,
            'sort'     => '-name',
        ]);

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

    public function test_update_overwrites_tree_of_named_filter(): void {
        $owner = $this->makeUser();
        $named = SavedFilter::create([
            'user_id' => $owner->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree('Old'), 'name' => 'Keep', 'is_saved' => true,
        ]);

        // Kirim hanya filter → overwrite tree, nama & is_saved tetap.
        $this->actingAs($owner)
            ->patchJson("/saved-filters/{$named->id}", ['filter' => $this->sampleTree('New')])
            ->assertOk()
            ->assertJsonPath('filter.root.c.i1.v', 'New');

        $fresh = SavedFilter::find($named->id);
        $this->assertSame('New', $fresh->filter['root']['c']['i1']['v']);
        $this->assertSame('Keep', $fresh->name);
        $this->assertTrue($fresh->is_saved);
    }

    public function test_update_overwrite_rejects_empty_tree(): void {
        $owner = $this->makeUser();
        $named = SavedFilter::create([
            'user_id' => $owner->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree('Old'), 'name' => 'Keep', 'is_saved' => true,
        ]);

        // Tree tanpa item valid → 422, tree lama tak berubah.
        $this->actingAs($owner)->patchJson("/saved-filters/{$named->id}", [
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => ''],
            ]]],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter']);

        $this->assertSame('Old', SavedFilter::find($named->id)->filter['root']['c']['i1']['v']);
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

        // owner melihat — dan payload menyertakan is_saved (dipakai frontend
        // untuk menentukan apply named tanpa membuat record baru).
        $this->actingAs($owner)->getJson('/saved-filters?model=' . urlencode(ApprovalScheme::class))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.is_saved', true);
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

    public function test_get_name_class_is_overridden_for_route_naming(): void {
        // Nama route resource ('filterTemplate') beda dari nama class
        // ('SavedFilter') — dipakai breadcrumb/DataTableScope/CommandSearch
        // agar tidak nyasar ke route savedFilters.* yang tidak terdaftar.
        $this->assertSame('filterTemplate', (new SavedFilter)->getNameClass());
    }

    public function test_init_permissions_provisions_permission_row_with_alias_name(): void {
        SavedFilter::initPermissions();

        $this->assertDatabaseHas('permissions', [
            'model'  => SavedFilter::class,
            'name'   => 'Filter Templates',
            'module' => 'Core',
        ]);

        $permission = Permission::where('model', SavedFilter::class)->first();
        foreach (['select', 'read', 'write', 'create', 'delete', 'import', 'export', 'share'] as $key) {
            $this->assertContains($key, $permission->permissions, "permission key '{$key}' harus ada");
        }
    }

    public function test_scope_visible_to_merges_own_private_and_shared_filters(): void {
        $me    = $this->makeUser();
        $other = $this->makeUser();

        $mine = SavedFilter::create([
            'user_id' => $me->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'Mine', 'is_saved' => true,
        ]);
        $othersPrivate = SavedFilter::create([
            'user_id' => $other->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'OthersPrivate', 'is_saved' => true,
        ]);
        $shared = SavedFilter::create([
            'user_id' => $other->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'Shared', 'is_saved' => true, 'is_shared' => true,
        ]);

        $ids = SavedFilter::visibleTo($me->id, ApprovalScheme::class)->pluck('id')->all();

        $this->assertContains($mine->id, $ids);
        $this->assertContains($shared->id, $ids);
        $this->assertNotContains($othersPrivate->id, $ids);
    }

    public function test_scope_default_for_returns_only_shared_default(): void {
        $user = $this->makeUser();

        $default = SavedFilter::create([
            'user_id'   => $user->id, 'model' => ApprovalScheme::class,
            'filter'    => $this->sampleTree(), 'name' => 'Default', 'is_saved' => true,
            'is_shared' => true, 'is_default' => true,
        ]);
        SavedFilter::create([
            'user_id'   => $user->id, 'model' => ApprovalScheme::class,
            'filter'    => $this->sampleTree(), 'name' => 'Shared not default', 'is_saved' => true,
            'is_shared' => true, 'is_default' => false,
        ]);
        SavedFilter::create([
            'user_id'   => $user->id, 'model' => ApprovalScheme::class,
            'filter'    => $this->sampleTree(), 'name' => 'Private', 'is_saved' => true,
            'is_shared' => false,
        ]);

        $result = SavedFilter::defaultFor(ApprovalScheme::class)->get();

        $this->assertCount(1, $result);
        $this->assertSame($default->id, $result->first()->id);
    }

    /**
     * Property P3 — fork-on-edit: user BUKAN pemilik shared filter yang
     * mengubah+apply tidak pernah menimpa row shared asal (guard ownership
     * `reusableEphemeral` sudah cukup — TIDAK ada perubahan kode baru).
     */
    public function test_editing_shared_filter_forks_new_row_not_overwriting_original(): void {
        $pengelola = $this->makeUser();
        $user      = $this->makeUser();
        $shared    = SavedFilter::create([
            'user_id' => $pengelola->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree('Original'), 'name' => 'Shared', 'is_saved' => true, 'is_shared' => true,
        ]);

        $res = $this->actingAs($user)->postJson('/saved-filters', [
            'model'  => ApprovalScheme::class,
            'filter' => $this->sampleTree('Edited'),
            'fid'    => $shared->id,
        ]);

        $res->assertOk();
        $this->assertNotSame($shared->id, $res->json('id'));
        $this->assertSame('Original', SavedFilter::find($shared->id)->filter['root']['c']['i1']['v']);
        $this->assertDatabaseHas('saved_filters', [
            'id' => $res->json('id'), 'user_id' => $user->id, 'is_shared' => false,
        ]);
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
