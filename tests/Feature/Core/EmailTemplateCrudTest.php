<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\EmailTemplate;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailTemplateCrudTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach (['users', 'email_templates'] as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function makeUser(): User {
        return User::factory()->create();
    }

    private function permissions(array $abilities = ['select' => true, 'read' => true, 'write' => true, 'create' => true, 'delete' => true]): array {
        return [
            'permissions' => [
                EmailTemplate::class => [
                    0 => [
                        [
                            'model'        => EmailTemplate::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $abilities,
                        ],
                    ],
                ],
            ],
        ];
    }

    private function payload(array $overrides = []): array {
        return array_merge([
            'name'       => 'Notifikasi Sales Order',
            'permission' => ['id' => null, 'model' => 'App\\Models\\Sales\\SalesOrder', 'name' => 'SalesOrder'],
            'subject'    => 'Order #{{ $doc->number }}',
            'body_html'  => '<p>Halo</p>',
        ], $overrides);
    }

    public function test_index_returns_ok(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('emailTemplates.index'))
            ->assertOk();
    }

    public function test_store_creates_email_template(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('emailTemplates.store'), $this->payload())
            ->assertRedirect();

        $this->assertDatabaseHas('email_templates', [
            'name'    => 'Notifikasi Sales Order',
            'model'   => 'App\\Models\\Sales\\SalesOrder',
            'subject' => 'Order #{{ $doc->number }}',
        ]);
    }

    public function test_show_returns_email_template(): void {
        $emailTemplate = EmailTemplate::factory()->create();
        $user          = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('emailTemplates.show', $emailTemplate))
            ->assertOk();
    }

    public function test_update_modifies_email_template(): void {
        $emailTemplate = EmailTemplate::factory()->create(['name' => 'Lama']);
        $user          = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('emailTemplates.update', $emailTemplate), $this->payload(['name' => 'Baru']))
            ->assertRedirect();

        $this->assertDatabaseHas('email_templates', ['id' => $emailTemplate->id, 'name' => 'Baru']);
    }

    public function test_destroy_deletes_email_template(): void {
        $emailTemplate = EmailTemplate::factory()->create();
        $user          = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('emailTemplates.destroy', $emailTemplate))
            ->assertRedirect();

        $this->assertSoftDeleted('email_templates', ['id' => $emailTemplate->id]);
    }

    public function test_store_requires_name_and_subject(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('emailTemplates.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'subject', 'body_html']);
    }

    public function test_user_without_permission_is_forbidden(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions(['select' => false, 'read' => false, 'write' => false, 'create' => false, 'delete' => false]))
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('emailTemplates.index'))
            ->assertForbidden();
    }

    public function test_setting_a_template_as_default_is_persisted(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('emailTemplates.store'), $this->payload(['is_default' => true]))
            ->assertRedirect();

        $this->assertDatabaseHas('email_templates', [
            'name'       => 'Notifikasi Sales Order',
            'is_default' => true,
        ]);
    }
}
