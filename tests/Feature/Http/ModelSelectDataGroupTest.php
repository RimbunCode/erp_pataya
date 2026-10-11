<?php

namespace Tests\Feature\Http;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Jalur grup `model.selectData` (spec linkmodel-grouping-search Req 3-4):
 * opt-in `groupTree`, gerbang kolom aman, expand `groupPath` tersaring
 * `filterRowColumns`, paritas constraint `search`, zero-overhead tanpa grup.
 */
class ModelSelectDataGroupTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();

        Schema::create('group_stub_cats', function ($table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->string('secret_note')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('group_stubs', function ($table): void {
            $table->id();
            $table->string('code')->nullable();
            $table->string('category')->nullable();
            $table->string('secret')->nullable();
            $table->unsignedBigInteger('group_stub_cat_id')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    private function submit(array $body, string $model = GroupStub::class) {
        return $this->actingAs(User::factory()->create())
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model.selectData'), ['model' => $model, ...$body]);
    }

    private function seedRows(): void {
        $catA = GroupStubCat::create(['name' => 'Cat A', 'secret_note' => 'RAHASIA']);
        $catB = GroupStubCat::create(['name' => 'Cat B', 'secret_note' => 'RAHASIA']);
        GroupStub::create(['code' => 'A1', 'category' => 'alpha', 'secret' => 's1', 'group_stub_cat_id' => $catA->id]);
        GroupStub::create(['code' => 'A2', 'category' => 'alpha', 'secret' => 's2', 'group_stub_cat_id' => $catA->id]);
        GroupStub::create(['code' => 'B1', 'category' => 'beta', 'secret' => 's3', 'group_stub_cat_id' => $catB->id]);
    }

    public function test_level_zero_returns_group_descriptors_with_counts(): void {
        $this->seedRows();

        $res = $this->submit(['groupTree' => true, 'group' => 'category']);

        $res->assertOk();
        $this->assertSame('category', $res->json('groupMeta.levels.0.column'));
        $counts = collect($res->json('data.data'))->pluck('count', 'key')->all();
        $this->assertSame(['alpha' => 2, 'beta' => 1], $counts);
    }

    public function test_non_linkable_group_column_is_dropped_and_falls_back_to_flat(): void {
        $this->seedRows();

        $res = $this->submit(['groupTree' => true, 'group' => 'secret']);

        $res->assertOk();
        $this->assertNull($res->json('groupMeta'));
        $this->assertSame(3, $res->json('data.total'));
        $this->assertArrayNotHasKey('secret', $res->json('data.data.0'));
    }

    public function test_expand_rows_are_filtered_to_safe_columns(): void {
        $this->seedRows();

        $res = $this->submit([
            'group'              => 'category',
            'groupPath'          => json_encode(['alpha']),
            'includeAllLinkable' => true,
        ]);

        $res->assertOk();
        $this->assertSame('rows', $res->json('type'));
        $this->assertSame(2, $res->json('total'));
        foreach ($res->json('data') as $row) {
            $this->assertArrayHasKey('code', $row);
            $this->assertArrayNotHasKey('secret', $row);
        }
    }

    public function test_relation_group_label_is_filtered_to_safe_child_columns(): void {
        $this->seedRows();

        $res = $this->submit(['groupTree' => true, 'group' => 'group_stub_cat']);

        $res->assertOk();
        $this->assertSame('group_stub_cat', $res->json('groupMeta.levels.0.column'));
        $label = $res->json('data.data.0.label');
        $this->assertNotNull($label);
        $this->assertArrayHasKey('name', $label);
        $this->assertArrayNotHasKey('secret_note', $label);
    }

    public function test_expand_groups_label_is_filtered_for_relation_level(): void {
        $this->seedRows();

        $res = $this->submit(['group' => ['group_stub_cat', 'category'], 'groupPath' => json_encode([])]);

        $res->assertOk();
        $this->assertSame('groups', $res->json('type'));
        $label = $res->json('data.0.label');
        $this->assertArrayNotHasKey('secret_note', $label);
    }

    public function test_search_constrains_group_counts(): void {
        $this->seedRows();

        $res = $this->submit(['groupTree' => true, 'group' => 'category', 'search' => 'A1']);

        $res->assertOk();
        $counts = collect($res->json('data.data'))->pluck('count', 'key')->all();
        $this->assertSame(['alpha' => 1], $counts);
    }

    public function test_model_default_groups_apply_only_with_opt_in(): void {
        $this->seedRows();

        $with = $this->submit(['groupTree' => true], GroupStubWithDefault::class);
        $with->assertOk();
        $this->assertSame('category', $with->json('groupMeta.levels.0.column'));
        $this->assertSame('category', $with->json('defaultGroups.0.column'));

        $without = $this->submit([], GroupStubWithDefault::class);
        $without->assertOk();
        $this->assertArrayNotHasKey('groupMeta', $without->json());
        $this->assertSame(3, $without->json('data.total'));
    }

    public function test_empty_group_param_overrides_model_default(): void {
        $this->seedRows();

        $res = $this->submit(['groupTree' => true, 'group' => ''], GroupStubWithDefault::class);

        $res->assertOk();
        $this->assertNull($res->json('groupMeta'));
        $this->assertSame(3, $res->json('data.total'));
    }

    public function test_invalid_group_path_returns_422(): void {
        $this->seedRows();

        $this->submit(['group' => 'category', 'groupPath' => 'bukan-json'])->assertStatus(422);
        $this->submit(['group' => 'category', 'groupPath' => json_encode(['a', 'b'])])->assertStatus(422);
    }

    public function test_xhr_group_without_opt_in_or_group_path_stays_flat(): void {
        $this->seedRows();

        $res = $this->submit(['group' => 'category']);

        $res->assertOk();
        $this->assertArrayNotHasKey('groupMeta', $res->json());
        $this->assertSame(3, $res->json('data.total'));
    }

    private function lookup(array $body, string $model = GroupStub::class) {
        return $this->actingAs(User::factory()->create())
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), ['model' => $model, ...$body]);
    }

    public function test_model_route_flat_pagination_with_page(): void {
        $this->seedRows();

        $page1 = $this->lookup(['page' => 1, 'show' => 2]);
        $page1->assertOk();
        $this->assertSame(2, count($page1->json('data')));
        $this->assertSame(3, $page1->json('total'));
        $this->assertSame(2, $page1->json('last_page'));

        $page2 = $this->lookup(['page' => 2, 'show' => 2]);
        $this->assertSame(1, count($page2->json('data')));
        $this->assertSame(2, $page2->json('current_page'));
    }

    public function test_model_route_without_page_keeps_limit_behaviour(): void {
        $this->seedRows();

        $res = $this->lookup(['limit' => 2]);

        $res->assertOk();
        $this->assertSame(2, count($res->json('data')));
        $this->assertSame(3, $res->json('total'));
        $this->assertArrayNotHasKey('current_page', $res->json());
    }

    public function test_model_route_level_zero_groups_and_search(): void {
        $this->seedRows();

        $res = $this->lookup(['groupTree' => true, 'group' => 'category']);
        $res->assertOk();
        $this->assertSame('groups', $res->json('type'));
        $this->assertSame(['alpha' => 2, 'beta' => 1], collect($res->json('data'))->pluck('count', 'key')->all());
        $this->assertSame('category', $res->json('groupMeta.levels.0.column'));
        // valueTrans kolom ikut ke meta level utk dekode label header dropdown.
        $this->assertSame('stub.group.types', $res->json('groupMeta.levels.0.valueTrans'));

        $searched = $this->lookup(['groupTree' => true, 'group' => 'category', 'search' => 'A1']);
        $this->assertSame(['alpha' => 1], collect($searched->json('data'))->pluck('count', 'key')->all());
    }

    public function test_model_route_expand_rows_are_safe_column_filtered(): void {
        $this->seedRows();

        $res = $this->lookup(['group' => 'category', 'groupPath' => json_encode(['alpha']), 'fields' => ['category']]);

        $res->assertOk();
        $this->assertSame('rows', $res->json('type'));
        $this->assertSame(2, $res->json('total'));
        foreach ($res->json('data') as $row) {
            $this->assertArrayHasKey('code', $row);
            $this->assertArrayNotHasKey('secret', $row);
        }
    }

    public function test_model_route_relation_label_is_safe_filtered(): void {
        $this->seedRows();

        $res = $this->lookup(['groupTree' => true, 'group' => 'group_stub_cat']);

        $res->assertOk();
        $label = $res->json('data.0.label');
        $this->assertNotNull($label);
        $this->assertArrayHasKey('name', $label);
        $this->assertArrayNotHasKey('secret_note', $label);
    }

    public function test_model_route_non_linkable_level_joins_and_cache_mode_stay_flat(): void {
        $this->seedRows();

        $secret = $this->lookup(['groupTree' => true, 'group' => 'secret']);
        $secret->assertOk();
        $this->assertArrayNotHasKey('type', $secret->json());
        $this->assertSame(3, $secret->json('total'));

        $cache = $this->lookup(['groupTree' => true, 'group' => 'category', 'cacheMode' => true]);
        $cache->assertOk();
        $this->assertArrayNotHasKey('type', $cache->json());
        $this->assertSame(3, $cache->json('total'));
    }

    public function test_model_route_invalid_group_path_returns_422(): void {
        $this->seedRows();

        $this->lookup(['group' => 'category', 'groupPath' => 'bukan-json', 'fields' => ['category']])->assertStatus(422);
    }

    public function test_no_group_params_keeps_flat_shape(): void {
        $this->seedRows();

        $res = $this->submit([]);

        $res->assertOk()->assertJsonStructure([
            'model', 'route', 'columns', 'data' => ['data', 'current_page', 'last_page', 'per_page', 'total'],
        ]);
        $this->assertArrayNotHasKey('groupMeta', $res->json());
        $this->assertArrayNotHasKey('defaultGroups', $res->json());
    }
}

class GroupStubCat extends Model {
    use DataTable;

    protected $table            = 'group_stub_cats';
    public string $translateKey = 'stub.group_cat';
    protected $guarded          = ['id'];

    public static function templateLink() {
        return ':name';
    }
}

class GroupStub extends Model {
    use DataTable;

    protected $table               = 'group_stubs';
    public string $translateKey    = 'stub.group';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'category'     => ['linkable' => true, 'groupable' => true, 'valueTrans' => 'stub.group.types'],
        'secret'       => ['groupable' => true],
        'groupStubCat' => ['groupable' => true],
    ];

    public static function templateLink() {
        return ':code';
    }

    public function groupStubCat(): BelongsTo {
        return $this->belongsTo(GroupStubCat::class, 'group_stub_cat_id');
    }
}

class GroupStubWithDefault extends GroupStub {
    protected static array|string|null $defaultGroups = 'category';
}
