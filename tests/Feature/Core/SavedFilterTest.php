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
