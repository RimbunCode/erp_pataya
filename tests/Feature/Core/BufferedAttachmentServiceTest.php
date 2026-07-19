<?php

namespace Tests\Feature\Core;

use App\Models\Core\Tag;
use App\Models\Core\Todo;
use App\Models\Inventory\Unit;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\TodoAssignedNotification;
use App\Services\Core\BufferedAttachmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
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

        // Kolom nested-set TreeView + user_id/parent_id pada `files` ditambahkan
        // di prod via command init, bukan migration. Shim agar File::create jalan di SQLite.
        Schema::table('files', function ($t) {
            if (! Schema::hasColumn('files', 'user_id')) {
                $t->ulid('user_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'parent_id')) {
                $t->ulid('parent_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'lft')) {
                $t->unsignedBigInteger('lft')->nullable();
            }
            if (! Schema::hasColumn('files', 'rgt')) {
                $t->unsignedBigInteger('rgt')->nullable();
            }
            if (! Schema::hasColumn('files', 'depth')) {
                $t->unsignedBigInteger('depth')->nullable();
            }
        });
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

    public function test_attaches_buffered_files(): void {
        Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user);
        $unit = Unit::create(['code' => 'CTN', 'name' => 'Carton', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'isPublic' => ['false'],
            'name'     => ['doc'],
        ], [], [
            'files' => [UploadedFile::fake()->create('doc.pdf', 10)],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $unit->id,
            'fileable_type' => Unit::class,
        ]);
    }

    public function test_no_buffer_produces_no_side_effects(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $unit = Unit::create(['code' => 'PCS', 'name' => 'Pcs', 'group' => 'Others']);

        BufferedAttachmentService::attach($unit, Request::create('/', 'POST'));

        $this->assertDatabaseCount('taggables', 0);
        $this->assertDatabaseCount('fileables', 0);
    }

    public function test_datatable_hook_auto_attaches_on_create(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $tag = Tag::create(['name' => 'hooked']);

        // Set request global agar request() di hook melihat buffer.
        $request = Request::create('/units', 'POST', [
            'name'          => 'Bag',
            'group'         => 'Others',
            'buffered_tags' => [['id' => $tag->id, 'name' => 'hooked']],
        ]);
        $request->setUserResolver(fn () => $user);
        $this->app->instance('request', $request);

        $unit = Unit::create(['code' => 'BAG', 'name' => 'Bag', 'group' => 'Others']);

        $this->assertDatabaseHas('taggables', [
            'taggable_id'   => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id'        => $tag->id,
        ]);
    }

    public function test_factory_create_without_request_buffer_is_safe(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $unit = Unit::create(['code' => 'SFE', 'name' => 'Safe', 'group' => 'Others']);

        $this->assertNotNull($unit->id);
        $this->assertDatabaseCount('taggables', 0);
    }

    public function test_attaches_buffered_assignees(): void {
        Notification::fake();

        $user     = User::factory()->create();
        $assignee = User::factory()->create();
        $this->actingAs($user);
        $unit = Unit::create(['code' => 'ASG', 'name' => 'Assignable', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'buffered_assignees' => [
                ['id' => $assignee->id, 'type' => 'user', 'name' => $assignee->name],
            ],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $unit->id,
            'reference_type'    => Unit::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'assigned_by_id'    => $user->id,
        ]);
        Notification::assertSentTo($assignee, TodoAssignedNotification::class);
    }

    public function test_attaches_buffered_role_assignee(): void {
        Notification::fake();

        $user = User::factory()->create();
        $this->actingAs($user);
        $role = Role::create(['name' => 'Buffered Role']);
        $unit = Unit::create(['code' => 'ASR', 'name' => 'Assignable Role', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'buffered_assignees' => [
                ['id' => $role->id, 'type' => 'role', 'name' => $role->name],
            ],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $unit->id,
            'reference_type'    => Unit::class,
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
        ]);
    }

    public function test_datatable_hook_auto_attaches_assignees_on_create(): void {
        Notification::fake();

        $user     = User::factory()->create();
        $assignee = User::factory()->create();
        $this->actingAs($user);

        $request = Request::create('/units', 'POST', [
            'name'               => 'Crate',
            'group'              => 'Others',
            'buffered_assignees' => [['id' => $assignee->id, 'type' => 'user', 'name' => $assignee->name]],
        ]);
        $request->setUserResolver(fn () => $user);
        $this->app->instance('request', $request);

        $unit = Unit::create(['code' => 'CRT', 'name' => 'Crate', 'group' => 'Others']);

        $this->assertDatabaseHas('todos', [
            'reference_id'    => $unit->id,
            'reference_type'  => Unit::class,
            'allocated_to_id' => $assignee->id,
        ]);
    }

    public function test_todo_does_not_recurse_into_attach_assignees_on_its_own_creation(): void {
        $user     = User::factory()->create();
        $assignee = User::factory()->create();
        $this->actingAs($user);

        $request = Request::create('/todos', 'POST', [
            'buffered_assignees' => [['id' => $assignee->id, 'type' => 'user', 'name' => $assignee->name]],
        ]);
        $request->setUserResolver(fn () => $user);
        $this->app->instance('request', $request);

        Todo::create([
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'assigned_by_id'    => $user->id,
            'status'            => 'open',
            'priority'          => 'medium',
        ]);

        $this->assertDatabaseCount('todos', 1);
    }
}
