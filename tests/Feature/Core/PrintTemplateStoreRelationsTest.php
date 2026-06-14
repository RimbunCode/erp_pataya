<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\PrintTemplate;
use App\Models\User\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PrintTemplateStoreRelationsTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (! Schema::hasTable('print_templates')) {
            Schema::create('print_templates', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->char('permission_id', 26)->nullable();
                $table->boolean('is_letter_head')->default(false);
                $table->char('letter_head_id', 26)->nullable();
                $table->string('name_model')->nullable();
                $table->string('model')->nullable();
                $table->longText('html')->nullable();
                $table->longText('css')->nullable();
                $table->json('template')->nullable();
                $table->json('used_relations')->nullable();
                $table->boolean('is_default')->default(false);
                $table->string('default_language')->nullable();
                $table->string('font_family')->nullable();
                $table->string('paper')->nullable();
                $table->string('page_number')->nullable();
                $table->string('orientation')->default('portrait');
                $table->double('width')->nullable();
                $table->double('height')->nullable();
                $table->double('margin_top')->nullable();
                $table->double('margin_bottom')->nullable();
                $table->double('margin_left')->nullable();
                $table->double('margin_right')->nullable();
                $table->boolean('show_absolute_values')->default(false);
                $table->string('unit')->nullable();
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

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('username')->nullable();
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->string('status')->default('pending');
                $table->string('image')->nullable();
                $table->char('default_branch_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('user_role')) {
            Schema::create('user_role', function (Blueprint $table): void {
                $table->char('user_id', 26);
                $table->char('role_id', 26);
                $table->timestamps();
            });
        }
    }

    /**
     * Test store (editor save) extracts relations from HTML and stores them
     */
    public function test_store_editor_save_extracts_and_stores_used_relations(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();

        $html = '<div>{{doc.customer.name}}</div><table>{{#each items}}<tr><td>{{this.product.name}}</td></tr>{{/each}}</table>';

        $response = $this->editorSave($user, $printTemplate->id, [
            'data'      => ['components' => []],
            'pagesHtml' => [['html' => $html, 'css' => '.test { color: red; }']],
        ]);

        $response->assertOk();
        $response->assertJsonStructure(['id', 'used_relations', 'updated_at']);

        $usedRelations = $response->json('used_relations');
        $this->assertIsArray($usedRelations);
        $this->assertContains('customer', $usedRelations);
        $this->assertContains('items', $usedRelations);

        // Verify persisted in database
        $printTemplate->refresh();
        $this->assertIsArray($printTemplate->used_relations);
        $this->assertContains('customer', $printTemplate->used_relations);
        $this->assertContains('items', $printTemplate->used_relations);
    }

    /**
     * Test store (editor save) returns used_relations in response
     */
    public function test_store_editor_save_returns_used_relations_in_response(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();

        $response = $this->editorSave($user, $printTemplate->id, [
            'data'      => ['components' => []],
            'pagesHtml' => [['html' => '<div>{{relation doc.warehouse}}</div>', 'css' => '']],
        ]);

        $response->assertOk();
        $response->assertJsonPath('id', $printTemplate->id);
        $this->assertArrayHasKey('used_relations', $response->json());
        $this->assertArrayHasKey('updated_at', $response->json());
    }

    /**
     * Test store (editor save) stores empty array when no relations found
     */
    public function test_store_editor_save_stores_empty_array_when_no_relations(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();

        $response = $this->editorSave($user, $printTemplate->id, [
            'data'      => ['components' => []],
            'pagesHtml' => [['html' => '<div>Simple text without relations</div>', 'css' => '']],
        ]);

        $response->assertOk();

        $printTemplate->refresh();
        $this->assertIsArray($printTemplate->used_relations);
        $this->assertEmpty($printTemplate->used_relations);
    }

    /**
     * Test store (editor save) extracts nested relations from HTML
     */
    public function test_store_editor_save_extracts_nested_relations(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();

        $response = $this->editorSave($user, $printTemplate->id, [
            'data'      => ['components' => []],
            'pagesHtml' => [['html' => '<div>{{doc.customer.address.city}}</div>', 'css' => '']],
        ]);

        $response->assertOk();

        $printTemplate->refresh();
        $usedRelations = $printTemplate->used_relations;
        $this->assertContains('customer', $usedRelations);
        $this->assertContains('customer.address', $usedRelations);
        $this->assertContains('customer.address.city', $usedRelations);
    }

    /**
     * Test store (editor save) deduplicates relations
     */
    public function test_store_editor_save_deduplicates_relations(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();

        $response = $this->editorSave($user, $printTemplate->id, [
            'data'      => ['components' => []],
            'pagesHtml' => [['html' => '<div>{{doc.customer.name}}</div><div>{{doc.customer.email}}</div>', 'css' => '']],
        ]);

        $response->assertOk();

        $printTemplate->refresh();
        $usedRelations = $printTemplate->used_relations;
        $this->assertEquals(array_unique($usedRelations), $usedRelations);
    }

    /**
     * Helper to simulate editor save (non-Inertia AJAX POST)
     */
    private function editorSave(User $user, string $templateId, array $payload) {
        return $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('printTemplates.store'), array_merge(['id' => $templateId], $payload));
    }

    private function createPrintTemplate(array $overrides = []): PrintTemplate {
        return PrintTemplate::create(array_merge([
            'name'        => 'Test Template ' . uniqid(),
            'orientation' => 'portrait',
        ], $overrides));
    }

    /**
     * @return array<string, mixed>
     */
    private function makePermissions(): array {
        return [
            PrintTemplate::class => [
                0 => [
                    [
                        'model'        => PrintTemplate::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => [
                            'select' => true,
                            'read'   => true,
                            'write'  => true,
                            'create' => true,
                            'delete' => true,
                        ],
                    ],
                ],
            ],
        ];
    }
}
