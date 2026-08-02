<?php

namespace Tests\Unit\Traits;

use App\Models\Model as AppModel;
use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LinkModelShowContextTestDocument extends AppModel {
    use HasUlids, LinkModel;

    protected $table   = 'link_model_show_context_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

/**
 * Property 4 — scope show-only ditegakkan di getAppends(), bukan response
 * filtering: tanpa markAsShowContext(), canUpdate/disabledOn TIDAK masuk
 * getAppends() sama sekali (accessor tidak pernah dipanggil).
 */
class LinkModelShowContextTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('link_model_show_context_test_documents')) {
            Schema::create('link_model_show_context_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->string('code')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
                $t->softDeletes();
            });
        }
    }

    public function test_appends_excludes_can_update_and_disabled_on_by_default(): void {
        $model = new LinkModelShowContextTestDocument;

        $appends = $model->getAppends();

        $this->assertNotContains('canUpdate', $appends);
        $this->assertNotContains('disabledOn', $appends);
    }

    public function test_appends_includes_can_update_and_disabled_on_after_mark_as_show_context(): void {
        $model = new LinkModelShowContextTestDocument;
        $model->markAsShowContext();

        $appends = $model->getAppends();

        $this->assertContains('canUpdate', $appends);
        $this->assertContains('disabledOn', $appends);
    }

    public function test_to_array_excludes_can_update_and_disabled_on_by_default(): void {
        $model = new LinkModelShowContextTestDocument;
        $model->setRawAttributes(['id' => 'test-id', 'code' => 'TEST']);

        $array = $model->toArray();

        $this->assertArrayNotHasKey('canUpdate', $array);
        $this->assertArrayNotHasKey('disabledOn', $array);
    }

    public function test_to_array_includes_can_update_and_disabled_on_after_mark_as_show_context(): void {
        $model = new LinkModelShowContextTestDocument;
        $model->setRawAttributes(['id' => 'test-id', 'code' => 'TEST']);
        $model->markAsShowContext();

        $array = $model->toArray();

        $this->assertArrayHasKey('canUpdate', $array);
        $this->assertArrayHasKey('disabledOn', $array);
    }

    public function test_mark_as_show_context_returns_static_for_chaining(): void {
        $model  = new LinkModelShowContextTestDocument;
        $result = $model->markAsShowContext();

        $this->assertSame($model, $result);
    }
}
