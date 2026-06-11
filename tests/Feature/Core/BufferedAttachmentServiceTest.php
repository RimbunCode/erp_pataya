<?php

namespace Tests\Feature\Core;

use App\Models\Core\Tag;
use App\Models\Inventory\Unit;
use App\Models\User\User;
use App\Services\Core\BufferedAttachmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BufferedAttachmentServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // is_example ditambahkan via seeder/initPermissions di prod, bukan migration.
        // Tambahkan ke semua tabel agar global scope HasExampleData tidak error di SQLite.
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_attaches_existing_and_new_buffered_tags(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $existing = Tag::create(['name' => 'urgent']);
        $unit     = Unit::create(['code' => 'BOX', 'name' => 'Box', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'buffered_tags' => [
                ['id' => $existing->id, 'name' => 'urgent'],
                ['name' => 'baru-banget', 'isNew' => true],
            ],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('taggables', [
            'taggable_id'   => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id'        => $existing->id,
        ]);
        $newTag = Tag::where('name', 'baru-banget')->firstOrFail();
        $this->assertDatabaseHas('taggables', [
            'taggable_id'   => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id'        => $newTag->id,
        ]);
    }
}
