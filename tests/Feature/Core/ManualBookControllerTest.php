<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use App\Services\Core\ManualBookService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ManualBookControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }

        $this->user = User::factory()->create();
    }

    public function test_index_accessible_by_authenticated_user(): void {
        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('manualBook.index'))
            ->assertOk();
    }

    public function test_show_returns_ok_for_known_section(): void {
        $key = array_key_first(config('manual_book.sections'));

        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('manualBook.show', $key))
            ->assertOk();
    }

    public function test_show_returns_404_for_unknown_section(): void {
        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('manualBook.show', 'section-tidak-ada'))
            ->assertNotFound();
    }

    /**
     * Defense-in-depth: pastikan tidak ada satu pun section yang membocorkan
     * detail teknis (nama Controller@method, namespace model, path file
     * frontend) ke HTML yang ditampilkan ke end-user non-developer.
     */
    public function test_no_section_leaks_developer_only_details(): void {
        $service           = new ManualBookService;
        $forbiddenPatterns = [
            '/Controller@\w+/',
            '/App\\\\Models\\\\/',
            '/App\\\\Http\\\\Controllers\\\\/',
            '/\.jsx\b/',
            '/routes\/web\.php/',
            '/\b(GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z]/',
            '/\bService::\w+\(\)/',
        ];

        foreach (array_keys(config('manual_book.sections')) as $key) {
            $rendered = $service->renderSection($key);
            $this->assertNotNull($rendered, "Section [{$key}] gagal dirender.");

            foreach ($forbiddenPatterns as $pattern) {
                $this->assertDoesNotMatchRegularExpression(
                    $pattern,
                    $rendered['content_html'],
                    "Section [{$key}] mengandung detail teknis yang cocok pola {$pattern}.",
                );
            }
        }
    }
}
