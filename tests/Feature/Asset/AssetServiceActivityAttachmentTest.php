<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Models\Core\File;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AssetServiceActivityAttachmentTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach ([FormatingSeries::class, Asset::class, AssetService::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Kolom nested-set TreeView + user_id/parent_id pada `files` ditambahkan
        // di prod via command init, bukan migration. Shim agar File::create/upload jalan di SQLite.
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

    protected function tearDown(): void {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                AssetService::class => [
                    0 => [
                        [
                            'model'        => AssetService::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    private function approvedService(): AssetService {
        $asset = Asset::factory()->create();

        return AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::APPROVED],
        ]);
    }

    public function test_store_activity_with_files_id_attaches_to_activity_not_service(): void {
        $user    = User::factory()->create();
        $service = $this->approvedService();
        $file    = File::create(['name' => 'draft.pdf', 'path' => 'files/draft.pdf', 'mime_type' => 'application/pdf', 'is_draft' => true, 'user_id' => $user->id]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'test',
                'status'      => FormStatus::IN_PROGRESS->value,
                'filesId'     => [$file->id],
            ])
            ->assertRedirect();

        $activity = AssetServiceActivity::where('asset_service_id', $service->id)->firstOrFail();

        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $activity->id,
            'fileable_type' => AssetServiceActivity::class,
            'file_id'       => $file->id,
        ]);
        $this->assertDatabaseMissing('fileables', [
            'fileable_id'   => $service->id,
            'fileable_type' => AssetService::class,
            'file_id'       => $file->id,
        ]);
    }

    public function test_store_activity_without_files_creates_no_fileable(): void {
        $user    = User::factory()->create();
        $service = $this->approvedService();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'no attachment',
                'status'      => FormStatus::IN_PROGRESS->value,
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('fileables', 0);
    }

    public function test_add_activity_file_uploads_and_attaches(): void {
        Storage::fake('local');
        $user     = User::factory()->create();
        $service  = $this->approvedService();
        $activity = $service->activities()->create([
            'action_date' => now(),
            'description' => 'existing activity',
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.addFile', $activity), [
                'isPublic' => ['false'],
                'name'     => ['bukti'],
                'files'    => [UploadedFile::fake()->create('bukti.pdf', 10)],
            ])
            ->assertRedirect();

        $file = File::where('name', 'bukti')->firstOrFail();
        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $activity->id,
            'fileable_type' => AssetServiceActivity::class,
            'file_id'       => $file->id,
        ]);
    }

    public function test_add_and_remove_activity_file_rejected_when_service_not_approved(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        $activity = $service->activities()->create([
            'action_date' => now(),
            'description' => 'draft activity',
        ]);
        $file = File::create(['name' => 'x.pdf', 'path' => 'files/x.pdf', 'mime_type' => 'application/pdf', 'is_draft' => true, 'user_id' => $user->id]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.addFile', $activity), ['filesId' => [$file->id]])
            ->assertStatus(500);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->delete(route('assetServices.activities.removeFile', [$activity, $file]))
            ->assertStatus(500);
    }

    public function test_remove_activity_file_soft_deletes_only_that_link(): void {
        $user     = User::factory()->create();
        $service  = $this->approvedService();
        $activity = $service->activities()->create([
            'action_date' => now(),
            'description' => 'has two files',
        ]);
        $fileA = File::create(['name' => 'a.pdf', 'path' => 'files/a.pdf', 'mime_type' => 'application/pdf', 'is_draft' => false, 'user_id' => $user->id]);
        $fileB = File::create(['name' => 'b.pdf', 'path' => 'files/b.pdf', 'mime_type' => 'application/pdf', 'is_draft' => false, 'user_id' => $user->id]);
        $activity->files()->attach([$fileA->id, $fileB->id]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->delete(route('assetServices.activities.removeFile', [$activity, $fileA]))
            ->assertRedirect();

        $this->assertSoftDeleted('fileables', [
            'fileable_id'   => $activity->id,
            'fileable_type' => AssetServiceActivity::class,
            'file_id'       => $fileA->id,
        ]);
        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $activity->id,
            'fileable_type' => AssetServiceActivity::class,
            'file_id'       => $fileB->id,
            'deleted_at'    => null,
        ]);
    }
}
