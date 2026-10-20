<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\CoreSetting;
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
        $this->withSession(['permissions' => [CoreSetting::class => [0 => [[
            'only_creator' => false,
            'permissions'  => ['write' => true],
        ]]]]]);

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

        $this->assertDatabaseHas('core_settings', [
            'default_currency_id'   => 'USD',
            'default_number_format' => '#,###.##',
        ]);
    }

    public function test_update_rejects_unknown_currency(): void {
        $this->actingAs($this->makeUser())
            ->putJson(route('companies.update'), [
                'company_name'        => 'Acme',
                'default_currency_id' => 'XXX',
            ])
            ->assertUnprocessable()->assertJsonValidationErrors('default_currency_id');
    }

    public function test_update_skips_number_format_without_currency_id(): void {
        CoreSetting::factory()->create(['default_number_format' => '#.###,##']);
        $this->actingAs($this->makeUser())
            ->putJson(route('companies.update'), [
                'company_name' => 'Acme',
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing('preferences', [
            'key' => 'default_number_format',
        ]);
        $this->assertSame('#.###,##', CoreSetting::current()->default_number_format);
    }
}
