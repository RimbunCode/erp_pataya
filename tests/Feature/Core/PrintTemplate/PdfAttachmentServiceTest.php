<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Models\Core\Fileable;
use App\Models\Sales\SalesOrder;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PdfAttachmentServiceTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('sales_orders')) {
            Schema::create('sales_orders', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('code')->nullable();
                $table->boolean('is_example')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('files')) {
            Schema::create('files', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('name');
                $table->text('path')->nullable();
                $table->string('extension')->nullable();
                $table->string('mime_type');
                $table->boolean('is_public')->default(false);
                $table->boolean('is_draft')->default(false);
                $table->boolean('is_example')->default(false);
                $table->char('created_by_id', 26)->nullable();
                // lft/rgt/depth/parent_id below are added dynamically in
                // production via DataTable::initPermissions() (triggered by
                // TreeView's `$is_tree_view = true`, run through
                // PermissionSeeder / model init commands), not through this
                // migration — declared here manually so this test's schema
                // matches what TreeView requires at runtime without
                // depending on the full permission-seeding pipeline.
                $table->integer('lft')->nullable();
                $table->integer('rgt')->nullable();
                $table->integer('depth')->nullable();
                $table->char('parent_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('model')->nullable();
                $table->string('module')->nullable();
                $table->json('permissions')->nullable();
                $table->boolean('is_submitable')->default(false);
                $table->boolean('allow_only_creator')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('fileables')) {
            Schema::create('fileables', function (Blueprint $table): void {
                $table->char('file_id', 26);
                $table->ulidMorphs('fileable');
                $table->boolean('is_generated_pdf')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    protected function createSalesOrder(): SalesOrder {
        $id = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'         => $id,
            'code'       => 'SO-TEST-001',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return SalesOrder::withoutGlobalScopes()->find($id);
    }

    public function test_attach_creates_file_and_fileable_records(): void {
        $document = $this->createSalesOrder();
        $service  = app(PdfAttachmentService::class);

        $file = $service->attach('%PDF-1.4 fake content', $document);

        $this->assertSame('application/pdf', $file->mime_type);
        $this->assertSame('pdf', $file->extension);
        $this->assertFalse($file->is_public);
        $this->assertStringStartsWith('SO-TEST-001-', $file->name);

        $this->assertDatabaseHas('fileables', [
            'fileable_id'      => $document->id,
            'fileable_type'    => SalesOrder::class,
            'file_id'          => $file->id,
            'is_generated_pdf' => true,
        ]);
    }

    public function test_attach_creates_new_records_on_every_call_without_overwriting(): void {
        $document = $this->createSalesOrder();
        $service  = app(PdfAttachmentService::class);

        $first  = $service->attach('%PDF-1.4 first', $document);
        $second = $service->attach('%PDF-1.4 second', $document);

        $this->assertNotSame($first->id, $second->id);
        $this->assertNotSame($first->name, $second->name);

        $this->assertSame(2, Fileable::where('fileable_id', $document->id)
            ->where('fileable_type', SalesOrder::class)
            ->count());
    }

    public function test_attach_uses_given_user_id_when_provided(): void {
        $document = $this->createSalesOrder();
        $service  = app(PdfAttachmentService::class);
        $userId   = (string) Str::ulid();

        $file = $service->attach('%PDF-1.4 fake', $document, $userId);

        $this->assertSame($userId, $file->created_by_id);
    }
}
