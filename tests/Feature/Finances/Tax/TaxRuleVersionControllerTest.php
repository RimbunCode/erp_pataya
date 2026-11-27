<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 8.1 (Requirement 2.5, 10.1, 13.3): `TaxRuleVersionController`. Setiap aksi tulis hanya
 * dapat dilakukan dengan izin `manage_rule_versions` (izin `write` saja tidak cukup), seluruh penulisan lewat
 * `TaxRuleVersionService`, versi harus milik pajak pada URL, dan penolakan domain menjadi galat validasi.
 */
class TaxRuleVersionControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private TaxRuleVersionService $service;
    private Tax $tax;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Tax::class, TaxRuleVersion::class]);
        $this->withoutVite();
        $this->service = app(TaxRuleVersionService::class);
        $this->tax     = Tax::query()->create(['name' => 'PPN 12%', 'rate' => 12]);
    }

    /**
     * @param  list<string>  $permissions  izin TaxRuleVersion
     */
    private function actingWith(array $permissions): static {
        return $this->withSession([
            'permissions' => [
                TaxRuleVersion::class => [0 => [['model' => TaxRuleVersion::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($permissions, true)]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array {
        return [
            'effective_from'  => '2026-01-01',
            'effective_to'    => null,
            'rate'            => 12,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
            'rounding_mode'   => 'per_line',
            'output_role'     => 'tax_output',
            'input_role'      => 'tax_input',
            'notes'           => null,
            ...$overrides,
        ];
    }

    private function draft(string $from = '2026-01-01', ?Tax $tax = null): TaxRuleVersion {
        return $this->service->createDraft($tax ?? $this->tax, $this->payload(['effective_from' => $from]));
    }

    public function test_save_requires_manage_rule_versions_and_write_alone_is_not_enough(): void {
        $this->actingWith(['select', 'read', 'write'])
            ->post(route('taxRuleVersions.save', $this->tax), $this->payload())
            ->assertForbidden();

        $this->assertSame(0, TaxRuleVersion::query()->count());
    }

    public function test_save_creates_a_draft_for_the_tax_and_records_the_creator(): void {
        $this->actingWith(['manage_rule_versions'])
            ->post(route('taxRuleVersions.save', $this->tax), $this->payload())
            ->assertRedirect()
            ->assertSessionHas('success');

        $version = TaxRuleVersion::query()->sole();
        $this->assertSame($this->tax->getKey(), $version->tax_id);
        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $version->status);
        $this->assertSame(1, $version->version);
        $this->assertSame($this->user->id, $version->created_by_id);
    }

    public function test_save_rejects_inputs_that_only_the_service_may_set(): void {
        foreach (['status' => 'active', 'version' => 9, 'tax_id' => 'x', 'created_by_id' => 'x'] as $field => $value) {
            $this->actingWith(['manage_rule_versions'])
                ->post(route('taxRuleVersions.save', $this->tax), $this->payload([$field => $value]))
                ->assertSessionHasErrors($field);
        }

        $this->assertSame(0, TaxRuleVersion::query()->count());
    }

    public function test_save_validates_values(): void {
        $this->actingWith(['manage_rule_versions'])
            ->post(route('taxRuleVersions.save', $this->tax), $this->payload([
                'rate'            => 150,
                'dpp_denominator' => 0,
                'rounding_mode'   => 'sometimes',
                'output_role'     => 'Bad Role',
                'effective_to'    => '2025-01-01',
            ]))
            ->assertSessionHasErrors(['rate', 'dpp_denominator', 'rounding_mode', 'output_role', 'effective_to']);
    }

    public function test_update_draft_changes_only_drafts(): void {
        $draft = $this->draft();

        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.updateDraft', [$this->tax, $draft]), $this->payload(['rate' => 11]))
            ->assertRedirect();
        $this->assertSame('11.0000', (string) $draft->fresh()->rate);

        $this->service->activate($draft);
        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.updateDraft', [$this->tax, $draft]), $this->payload(['rate' => 5]))
            ->assertSessionHasErrors('version');
        $this->assertSame('11.0000', (string) $draft->fresh()->rate);
    }

    public function test_activate_requires_manage_rule_versions(): void {
        $draft = $this->draft();

        $this->actingWith(['select', 'read', 'write'])
            ->put(route('taxRuleVersions.activate', [$this->tax, $draft]))
            ->assertForbidden();

        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $draft->fresh()->status);
    }

    public function test_activate_and_retire_follow_the_service_lifecycle(): void {
        $draft = $this->draft();

        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.activate', [$this->tax, $draft]))
            ->assertRedirect()
            ->assertSessionHas('success');
        $this->assertSame(TaxRuleVersion::STATUS_ACTIVE, $draft->fresh()->status);

        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.retire', [$this->tax, $draft]))
            ->assertRedirect();
        $this->assertSame(TaxRuleVersion::STATUS_RETIRED, $draft->fresh()->status);
    }

    public function test_activation_failures_become_validation_errors(): void {
        $first = $this->service->activate($this->draft('2026-01-01'));
        $clash = $this->draft('2026-01-01');

        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.activate', [$this->tax, $clash]))
            ->assertSessionHasErrors('version');

        $this->assertSame(TaxRuleVersion::STATUS_ACTIVE, $first->fresh()->status);
        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $clash->fresh()->status);
    }

    public function test_dpp_factor_guard_message_is_returned_to_the_page(): void {
        $draft = $this->service->createDraft($this->tax, $this->payload(['dpp_numerator' => 1, 'dpp_denominator' => 1]));

        $this->actingWith(['manage_rule_versions'])
            ->put(route('taxRuleVersions.activate', [$this->tax, $draft]))
            ->assertSessionHasErrors('version');

        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $draft->fresh()->status);
    }

    public function test_discard_deletes_drafts_only_and_requires_manage_rule_versions(): void {
        $draft = $this->draft();

        $this->actingWith(['write'])
            ->delete(route('taxRuleVersions.discard', [$this->tax, $draft]))
            ->assertForbidden();
        $this->assertNotNull(TaxRuleVersion::query()->find($draft->id));

        $this->actingWith(['manage_rule_versions'])
            ->delete(route('taxRuleVersions.discard', [$this->tax, $draft]))
            ->assertRedirect();
        $this->assertNull(TaxRuleVersion::query()->find($draft->id));

        $active = $this->service->activate($this->draft('2026-01-01'));
        $this->actingWith(['manage_rule_versions'])
            ->delete(route('taxRuleVersions.discard', [$this->tax, $active]))
            ->assertSessionHasErrors('version');
        $this->assertNotNull(TaxRuleVersion::query()->find($active->id));
    }

    public function test_a_version_cannot_be_acted_on_through_another_taxs_url(): void {
        $other  = Tax::query()->create(['name' => 'PPh 23', 'rate' => 2]);
        $victim = $this->draft('2026-01-01', $other);

        foreach ([
            ['put', route('taxRuleVersions.activate', [$this->tax, $victim]), []],
            ['put', route('taxRuleVersions.retire', [$this->tax, $victim]), []],
            ['put', route('taxRuleVersions.updateDraft', [$this->tax, $victim]), $this->payload()],
            ['delete', route('taxRuleVersions.discard', [$this->tax, $victim]), []],
        ] as [$method, $url, $data]) {
            $this->actingWith(['manage_rule_versions'])->{$method}($url, $data)->assertNotFound();
        }

        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $victim->fresh()->status);
    }

    public function test_every_write_route_is_denied_without_any_permission(): void {
        $draft = $this->draft();

        $this->actingWith([])->post(route('taxRuleVersions.save', $this->tax), $this->payload())->assertForbidden();
        $this->actingWith(['select', 'read'])->put(route('taxRuleVersions.retire', [$this->tax, $draft]))->assertForbidden();
    }
}
