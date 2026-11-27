<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 8.1 (Requirement 1.3, 10.1): halaman master Pajak. Kolom klasifikasi dapat disimpan,
 * kombinasi `withholding` + PPN ditolak di server, peringatan "unclassified terpakai" dihitung server, dan tab
 * Versi Aturan hanya menerima data bila pembaca punya izin `read` pada `TaxRuleVersion` (tanpa izin itu halaman
 * Pajak tetap terbuka).
 */
class TaxClassificationHttpTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Tax::class, TaxRuleVersion::class, SalesInvoice::class, PurchaseInvoice::class]);
        $this->withoutVite();
    }

    /**
     * @param  list<string>  $tax  izin Tax
     * @param  list<string>  $versions  izin TaxRuleVersion (kosong = tidak ada entri izin sama sekali)
     */
    private function actingWith(array $tax, array $versions = []): static {
        $permissions = [
            Tax::class => [0 => [['model' => Tax::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($tax, true)]]],
        ];
        if ($versions !== []) {
            $permissions[TaxRuleVersion::class] = [0 => [['model' => TaxRuleVersion::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($versions, true)]]];
        }

        return $this->withSession([
            'permissions'         => $permissions,
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user);
    }

    public function test_store_saves_classification_fields(): void {
        $this->actingWith(['create'])->post(route('taxes.store'), [
            'name'          => 'PPh 23',
            'rate'          => 2,
            'category'      => 'pph_23',
            'behavior'      => 'withholding',
            'is_creditable' => false,
        ])->assertRedirect();

        $tax = Tax::query()->where('name', 'PPh 23')->sole();
        $this->assertSame('pph_23', $tax->category);
        $this->assertSame('withholding', $tax->behavior);
        $this->assertFalse($tax->is_creditable);
    }

    public function test_store_without_classification_fields_keeps_the_defaults(): void {
        $this->actingWith(['create'])->post(route('taxes.store'), ['name' => 'Pajak Lama', 'rate' => 5])->assertRedirect();

        $tax = Tax::query()->where('name', 'Pajak Lama')->sole()->refresh();
        $this->assertSame('unclassified', $tax->category);
        $this->assertSame('additive', $tax->behavior);
        $this->assertTrue($tax->is_creditable);
    }

    public function test_store_rejects_withholding_on_ppn_categories(): void {
        foreach (['ppn_standard', 'ppn_luxury'] as $category) {
            $this->actingWith(['create'])->post(route('taxes.store'), [
                'name'     => 'PPN salah',
                'rate'     => 12,
                'category' => $category,
                'behavior' => 'withholding',
            ])->assertSessionHasErrors('behavior');
        }

        $this->assertSame(0, Tax::query()->count());
    }

    public function test_store_rejects_unknown_category_and_behavior(): void {
        $this->actingWith(['create'])->post(route('taxes.store'), [
            'name'     => 'Aneh',
            'rate'     => 1,
            'category' => 'nonsense',
            'behavior' => 'nonsense',
        ])->assertSessionHasErrors(['category', 'behavior']);
    }

    public function test_category_outside_the_list_is_rejected_on_store_and_update(): void {
        $this->actingWith(['create'])->post(route('taxes.store'), ['name' => 'Aneh', 'rate' => 1, 'category' => 'ppn_unknown'])
            ->assertSessionHasErrors('category');
        $this->assertSame(0, Tax::query()->count());

        $tax = Tax::query()->create(['name' => 'Pajak', 'rate' => 1]);
        $this->actingWith(['write'])->put(route('taxes.update', $tax), ['name' => 'Pajak', 'rate' => 1, 'category' => 'PPN_STANDARD'])
            ->assertSessionHasErrors('category');
        $this->assertSame('unclassified', $tax->fresh()->category);
    }

    public function test_update_judges_the_combination_against_the_stored_values(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 12, 'category' => 'ppn_standard']);

        // Hanya `behavior` yang dikirim: kategori tersimpan (PPN) tetap menolaknya.
        $this->actingWith(['write'])->put(route('taxes.update', $tax), ['name' => 'PPN', 'rate' => 12, 'behavior' => 'withholding'])
            ->assertSessionHasErrors('behavior');
        $this->assertSame('additive', $tax->fresh()->behavior);

        $pph = Tax::query()->create(['name' => 'PPh', 'rate' => 2, 'behavior' => 'withholding']);
        // Hanya `category` yang dikirim: perilaku tersimpan (withholding) tetap menolak kategori PPN.
        $this->actingWith(['write'])->put(route('taxes.update', $pph), ['name' => 'PPh', 'rate' => 2, 'category' => 'ppn_standard'])
            ->assertSessionHasErrors('behavior');

        $this->actingWith(['write'])->put(route('taxes.update', $pph), ['name' => 'PPh', 'rate' => 2, 'category' => 'pph_23'])->assertRedirect();
        $this->assertSame('pph_23', $pph->fresh()->category);
    }

    public function test_show_without_version_permissions_still_opens_and_hides_the_versions(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 12]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        $this->actingWith(['read'])->get(route('taxes.show', $tax))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ShowGeneral')
                ->where('canViewRuleVersions', false)
                ->where('canManageRuleVersions', false)
                ->has('ruleVersions', 0));
    }

    public function test_show_lists_versions_for_readers_and_flags_manage_permission(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 12]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        $this->actingWith(['read'], ['read'])->get(route('taxes.show', $tax))
            ->assertInertia(fn ($page) => $page
                ->where('canViewRuleVersions', true)
                ->where('canManageRuleVersions', false)
                ->has('ruleVersions', 1)
                ->where('ruleVersions.0.version', 1)
                ->where('ruleVersions.0.status', 'active')
                ->where('ruleVersionDefaults.dpp_numerator', 11)
                ->where('ruleVersionDefaults.dpp_denominator', 12));

        $this->actingWith(['read'], ['read', 'manage_rule_versions'])->get(route('taxes.show', $tax))
            ->assertInertia(fn ($page) => $page->where('canManageRuleVersions', true));
    }

    public function test_manage_without_read_does_not_expose_the_versions(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 12]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        $this->actingWith(['read'], ['manage_rule_versions'])->get(route('taxes.show', $tax))
            ->assertInertia(fn ($page) => $page
                ->where('canViewRuleVersions', false)
                ->where('canManageRuleVersions', false)
                ->has('ruleVersions', 0));
    }

    public function test_show_reports_invoice_usage_only_for_unclassified_taxes(): void {
        $unclassified = Tax::query()->create(['name' => 'Belum', 'rate' => 5]);
        $classified   = Tax::query()->create(['name' => 'Sudah', 'rate' => 5, 'category' => 'other']);

        $this->actingWith(['read'])->get(route('taxes.show', $unclassified))
            ->assertInertia(fn ($page) => $page
                ->where('unclassifiedUsage.sales_invoices', 0)
                ->where('unclassifiedUsage.purchase_invoices', 0));

        $this->actingWith(['read'])->get(route('taxes.show', $classified))
            ->assertInertia(fn ($page) => $page->where('unclassifiedUsage', null));
    }
}
