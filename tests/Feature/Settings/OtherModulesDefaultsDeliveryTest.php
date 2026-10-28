<?php

namespace Tests\Feature\Settings;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetSetting;
use App\Models\CRM\Quotation;
use App\Models\Helpdesk\HelpdeskSetting;
use App\Models\Helpdesk\Ticket;
use App\Models\Sales\SalesSetting;
use App\Models\User\User;
use App\Services\Core\Setting\OtherModuleDefaultsResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Spec module-settings-other-modules, Tasks 3.2, 4.2, 5.2 (P-O1, P-O2, P-O4).
 * Controller `create` mengirim `defaults` dari setting; nilai tidak sah tidak dikirim.
 */
class OtherModulesDefaultsDeliveryTest extends TestCase {
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

        $this->user = User::factory()->create();
    }

    /** @param class-string $model */
    private function permissionsFor(string $model, array $actions): array {
        return ['permissions' => [$model => [[[
            'model'        => $model,
            'level'        => 0,
            'only_creator' => false,
            'permissions'  => $actions,
        ]]]]];
    }

    private function createPage(string $routeName, string $model): TestResponse {
        return $this->actingAs($this->user)
            ->withSession($this->permissionsFor($model, ['create' => true, 'select' => true, 'read' => true]))
            ->get(route($routeName));
    }

    public function test_asset_create_receives_depreciation_defaults_from_the_setting(): void {
        AssetSetting::current()->fill([
            'default_depreciation_method'           => 'double_declining_balance',
            'default_frequency_of_depreciation'     => 12,
            'default_total_number_of_depreciations' => 5,
        ])->save();

        $this->createPage('assets.create', Asset::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.depreciation_method', 'double_declining_balance')
                ->where('defaults.frequency_of_depreciation', 12)
                ->where('defaults.total_number_of_depreciations', 5));
    }

    public function test_asset_create_defaults_are_empty_when_the_setting_is_empty(): void {
        $this->createPage('assets.create', Asset::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.depreciation_method', null)
                ->where('defaults.frequency_of_depreciation', null)
                ->where('defaults.total_number_of_depreciations', null));
    }

    public function test_invalid_saved_asset_options_are_not_sent(): void {
        AssetSetting::current();
        // Disisipkan langsung (melewati rules()) untuk meniru opsi yang sudah tidak sah (P-O4).
        DB::table('asset_settings')->update([
            'default_depreciation_method'           => 'sum_of_years_digits',
            'default_frequency_of_depreciation'     => 0,
            'default_total_number_of_depreciations' => 0,
        ]);

        $this->assertSame([
            'depreciation_method'           => null,
            'frequency_of_depreciation'     => null,
            'total_number_of_depreciations' => null,
        ], app(OtherModuleDefaultsResolver::class)->forAsset());
    }

    public function test_ticket_create_receives_defaults_from_the_setting(): void {
        HelpdeskSetting::current()->fill([
            'default_type'     => 'bug_problem',
            'default_priority' => 'high',
            'default_due_days' => 3,
        ])->save();

        $this->createPage('tickets.create', Ticket::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.type', 'bug_problem')
                ->where('defaults.priority', 'high')
                ->where('defaults.due_days', 3));
    }

    public function test_ticket_create_defaults_are_empty_when_the_setting_is_empty(): void {
        $this->createPage('tickets.create', Ticket::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.type', null)
                ->where('defaults.priority', null)
                ->where('defaults.due_days', null));
    }

    public function test_invalid_saved_ticket_options_are_not_sent_but_due_days_still_are(): void {
        HelpdeskSetting::current();
        DB::table('helpdesk_settings')->update([
            'default_type'     => 'incident',
            'default_priority' => 'urgent',
            'default_due_days' => 0,
        ]);

        $this->assertSame(
            ['type' => null, 'priority' => null, 'due_days' => 0],
            app(OtherModuleDefaultsResolver::class)->forTicket(),
        );
    }

    public function test_quotation_create_receives_the_validity_days_next_to_the_document_defaults(): void {
        SalesSetting::current()->fill(['quotation_validity_days' => 14])->save();

        $this->createPage('quotations.create', Quotation::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.quotation_validity_days', 14)
                ->where('defaults.tax_id', null)
                ->has('defaults.payment_term_template'));
    }

    public function test_quotation_create_validity_days_is_null_when_the_setting_is_empty(): void {
        $this->createPage('quotations.create', Quotation::class)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.quotation_validity_days', null));
    }

    public function test_quotation_index_defaults_stay_unchanged(): void {
        SalesSetting::current()->fill(['quotation_validity_days' => 14])->save();

        $this->actingAs($this->user)
            ->withSession($this->permissionsFor(Quotation::class, ['select' => true, 'read' => true]))
            ->get(route('quotations.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->missing('defaults.quotation_validity_days'));
    }

    public function test_unreadable_settings_are_treated_as_empty(): void {
        Schema::drop('asset_settings');
        Schema::drop('helpdesk_settings');
        Schema::table('sales_settings', fn ($table) => $table->dropColumn('quotation_validity_days'));
        $resolver = app(OtherModuleDefaultsResolver::class);

        $this->assertSame([
            'depreciation_method'           => null,
            'frequency_of_depreciation'     => null,
            'total_number_of_depreciations' => null,
        ], $resolver->forAsset());
        $this->assertSame(['type' => null, 'priority' => null, 'due_days' => null], $resolver->forTicket());
        $this->assertNull($resolver->quotationValidityDays());
    }
}
