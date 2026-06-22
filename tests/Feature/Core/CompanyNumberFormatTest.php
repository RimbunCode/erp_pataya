<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Currency;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CompanyNumberFormatTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach (['users', 'branches'] as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function makeUser(): User {
        return User::factory()->create();
    }

    public function test_update_derives_default_number_format_from_currency(): void {
        Currency::factory()->create([
            'code'          => 'USD',
            'name'          => 'United States dollar',
            'symbol'        => '$',
            'number_format' => '#,###.##',
        ]);

        $this->actingAs($this->makeUser())
            ->putJson(route('companies.update'), [
                'company_name'        => 'Acme',
                'default_currency_id' => 'USD',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('preferences', [
            'key'   => 'default_number_format',
            'value' => '"#,###.##"',
        ]);
    }

    public function test_update_falls_back_when_currency_missing(): void {
        $this->actingAs($this->makeUser())
            ->putJson(route('companies.update'), [
                'company_name'        => 'Acme',
                'default_currency_id' => 'XXX',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('preferences', [
            'key'   => 'default_number_format',
            'value' => '"#,###.##"',
        ]);
    }

    public function test_update_skips_number_format_without_currency_id(): void {
        $this->actingAs($this->makeUser())
            ->putJson(route('companies.update'), [
                'company_name' => 'Acme',
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing('preferences', [
            'key' => 'default_number_format',
        ]);
    }
}
