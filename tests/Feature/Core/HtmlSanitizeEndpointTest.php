<?php

namespace Tests\Feature\Core;

use App\Models\User\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HtmlSanitizeEndpointTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('username')->nullable();
                $table->string('password')->nullable();
                $table->string('status')->default('pending');
                $table->string('image')->nullable();
                $table->char('default_branch_id', 26)->nullable();
                $table->timestamp('email_verified_at')->nullable();
                $table->rememberToken();
                $table->boolean('is_example')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // RecordAuditLog listener mencatat audit log utk SEMUA model
        // created/updated tanpa syarat user terautentikasi -- User::factory()
        // di test ini memicunya. Stub tabel `logs` (test ini tidak pakai
        // RefreshDatabase). Skema identik migration create_logs_table +
        // add_action_to_logs_table.
        if (! Schema::hasTable('logs')) {
            Schema::create('logs', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->longText('activity');
                $table->json('comment_json')->nullable();
                $table->text('notes')->nullable();
                $table->string('type')->default('log');
                $table->string('action')->nullable();
                $table->json('data_before')->nullable();
                $table->json('data_after')->nullable();
                $table->ulidMorphs('loggable');
                $table->char('user_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function test_sanitize_endpoint_returns_sanitized_html(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), [
                'html' => '<div class="test"><p>Hello</p></div>',
            ]);

        $response->assertOk();
        $response->assertJsonStructure([
            'sanitizedHTML',
            'warnings',
            'removedTags',
            'removedAttributes',
        ]);
        $response->assertJsonPath('sanitizedHTML', '<div class="test"><p>Hello</p></div>');
        $response->assertJsonPath('warnings', []);
        $response->assertJsonPath('removedTags', []);
        $response->assertJsonPath('removedAttributes', []);
    }

    public function test_sanitize_endpoint_removes_script_tags(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), [
                'html' => '<div><script>alert("xss")</script><p>Safe</p></div>',
            ]);

        $response->assertOk();
        $response->assertJsonPath('removedTags', ['script']);
        $this->assertStringNotContainsString('script', $response->json('sanitizedHTML'));
        $this->assertStringContainsString('<p>Safe</p>', $response->json('sanitizedHTML'));
    }

    public function test_sanitize_endpoint_removes_dangerous_attributes(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), [
                'html' => '<div onclick="alert(1)"><p>Content</p></div>',
            ]);

        $response->assertOk();
        $this->assertContains('onclick', $response->json('removedAttributes'));
        $this->assertStringNotContainsString('onclick', $response->json('sanitizedHTML'));
    }

    public function test_sanitize_endpoint_returns_warnings_for_removed_content(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), [
                'html' => '<div><iframe src="evil.html"></iframe><p>Safe</p></div>',
            ]);

        $response->assertOk();
        $this->assertNotEmpty($response->json('warnings'));
        $this->assertContains('iframe', $response->json('removedTags'));
    }

    public function test_sanitize_endpoint_requires_html_field(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['html']);
    }

    public function test_sanitize_endpoint_requires_html_to_be_string(): void {
        $user = $this->createAuthUser();

        $response = $this->actingAs($user)
            ->postJson(route('api.html.sanitize'), [
                'html' => 123,
            ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['html']);
    }

    public function test_sanitize_endpoint_requires_authentication(): void {
        $response = $this->postJson(route('api.html.sanitize'), [
            'html' => '<div>Test</div>',
        ]);

        $response->assertUnauthorized();
    }

    private function createAuthUser(): User {
        DB::table('users')->insert([
            'id'         => (string) str()->ulid(),
            'name'       => 'Test User',
            'email'      => 'sanitize-test@example.com',
            'password'   => null,
            'status'     => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::query()->where('email', 'sanitize-test@example.com')->firstOrFail();
    }
}
