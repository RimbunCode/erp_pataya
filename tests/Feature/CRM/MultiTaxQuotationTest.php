<?php

namespace Tests\Feature\CRM;

use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationItemTax;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;

/**
 * Pajak majemuk per item pada Quotation (spek finance-multi-tax-per-item, Task 9; Requirement 14.1-14.3, 14.6):
 * kontrak request `taxes` (dan `tax` tunggal yang dinormalisasi), perhitungan lewat `TaxEngine`, pivot, dan header.
 */
class MultiTaxQuotationTest extends QuotationTestCase {
    private function tax(string $name, float $rate, string $category, string $behavior = Tax::BEHAVIOR_ADDITIVE): Tax {
        $tax = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => $category, 'behavior' => $behavior]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        return $tax->fresh();
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function itemPayload(array $row): array {
        return [
            'id'       => 'new1',
            'item'     => ['id' => $this->variant->id],
            'quantity' => 2,
            'price'    => 500_000,
            ...$row,
        ];
    }

    public function test_a_single_tax_is_normalized_and_calculated_by_the_engine(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);

        $quotation = $this->storeQuotation(['items' => [$this->itemPayload(['tax' => ['id' => $ppn->getKey()]])]]);
        $item      = $quotation->items()->with('taxLines')->firstOrFail();

        // 1.000.000 x 11/12 x 12% = 110.000 (Q-MT-12 Opsi A), bukan 120.000 seperti hitung sederhana lama.
        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1_110_000, $item->amount, 0.01);
        $this->assertSame($ppn->getKey(), $item->tax_id);
        $this->assertCount(1, $item->taxLines);
        $this->assertNotNull($item->taxLines->first()->tax_rule_version_id);
        $this->assertEqualsWithDelta(1_000_000, (float) $quotation->basic_amount, 0.01);
        $this->assertEqualsWithDelta(110_000, (float) $quotation->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1_110_000, (float) $quotation->amount, 0.01);
    }

    public function test_two_taxes_are_stored_in_order_and_summed_into_the_header(): void {
        $ppn    = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $luxury = $this->tax('PPnBM 10', 10, Tax::CATEGORY_PPN_LUXURY);

        $quotation = $this->storeQuotation(['items' => [$this->itemPayload(['taxes' => [['id' => $ppn->getKey()], ['id' => $luxury->getKey()]]])]]);
        $item      = $quotation->items()->with('taxLines')->firstOrFail();

        $expectTax = 110_000 + 1_000_000 * 11 / 12 * 0.10;
        $this->assertSame([$ppn->getKey(), $luxury->getKey()], $item->taxLines->pluck('tax_id')->all());
        $this->assertSame($ppn->getKey(), $item->tax_id, 'Kolom item mencerminkan Pajak Utama.');
        $this->assertEqualsWithDelta($expectTax, $item->tax_amount, 0.02);
        $this->assertEqualsWithDelta($expectTax, (float) $quotation->tax_amount, 0.02);
        $this->assertEqualsWithDelta(1_000_000 + $expectTax, (float) $quotation->amount, 0.02);
    }

    public function test_updating_replaces_the_tax_set_and_prunes_removed_pivot_rows(): void {
        $ppn    = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $luxury = $this->tax('PPnBM 10', 10, Tax::CATEGORY_PPN_LUXURY);

        $quotation = $this->storeQuotation(['items' => [$this->itemPayload(['taxes' => [['id' => $ppn->getKey()], ['id' => $luxury->getKey()]]])]]);
        $itemId    = $quotation->items()->firstOrFail()->id;

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->putJson(route('quotations.update', $quotation), $this->payload(['items' => [$this->itemPayload(['id' => $itemId, 'taxes' => [['id' => $ppn->getKey()]]])]]))
            ->assertRedirect();

        $this->assertSame(1, QuotationItemTax::query()->where('quotation_item_id', $itemId)->count());
        $this->assertEqualsWithDelta(110_000, (float) $quotation->fresh()->tax_amount, 0.01);
    }

    public function test_updating_keeps_the_stored_rule_version_and_rate_of_a_tax_that_stays_selected(): void {
        $ppn    = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $luxury = $this->tax('PPnBM 10', 10, Tax::CATEGORY_PPN_LUXURY);

        $quotation = $this->storeQuotation(['items' => [$this->itemPayload(['taxes' => [['id' => $ppn->getKey()]]])]]);
        $item      = $quotation->items()->with('taxLines')->firstOrFail();
        $v1        = $item->taxLines->first()->tax_rule_version_id;
        $this->assertEqualsWithDelta(110_000, (float) $item->tax_amount, 0.01);

        // Master pajak berubah sesudahnya: versi baru tarif 15 berlaku pada tanggal Quotation.
        $service = app(TaxRuleVersionService::class);
        $service->activate($service->createNewVersion(TaxRuleVersion::query()->findOrFail($v1), '2026-09-01', null, ['rate' => 15]));
        $this->assertNotSame($v1, app(TaxRuleResolver::class)->resolve($ppn, CarbonImmutable::parse('2026-09-22'))->getKey(), 'Prasyarat: tarif master berubah.');

        // Edit: PPN tetap dipilih (versi dan tarif tersimpan dipertahankan), PPnBM baru di-resolve dari tanggal dokumen, item baru memakai versi berlaku.
        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->putJson(route('quotations.update', $quotation), $this->payload(['items' => [
                $this->itemPayload(['id' => $item->id, 'taxes' => [['id' => $ppn->getKey()], ['id' => $luxury->getKey()]]]),
                $this->itemPayload(['id' => 'new2', 'taxes' => [['id' => $ppn->getKey()]]]),
            ]]))
            ->assertRedirect();

        $kept    = $quotation->items()->with('taxLines')->findOrFail($item->id);
        $ppnLine = $kept->taxLines->firstWhere('tax_id', $ppn->getKey());
        $this->assertSame($v1, $ppnLine->tax_rule_version_id, 'Pajak yang sama mempertahankan versi tersimpan.');
        $this->assertEqualsWithDelta(12, (float) $ppnLine->tax_rate, 0.0001);
        $this->assertEqualsWithDelta(110_000, (float) $ppnLine->tax_amount, 0.01);
        $this->assertEqualsWithDelta(12, (float) $kept->tax_rate, 0.0001, 'Kolom item (Pajak Utama) mempertahankan tarif tersimpan.');
        $this->assertNotNull($kept->taxLines->firstWhere('tax_id', $luxury->getKey()), 'Pajak baru ditambahkan.');

        $fresh = $quotation->items()->with('taxLines')->where('id', '!=', $item->id)->firstOrFail();
        $this->assertNotSame($v1, $fresh->taxLines->first()->tax_rule_version_id, 'Item baru memakai versi yang berlaku sekarang.');
        $this->assertEqualsWithDelta(15, (float) $fresh->taxLines->first()->tax_rate, 0.0001);
    }

    public function test_at_least_one_tax_is_required_and_forbidden_combinations_are_rejected(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload(['items' => [$this->itemPayload(['taxes' => []])]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.taxes');

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload(['items' => [$this->itemPayload(['taxes' => [['id' => $ppn->getKey()], ['id' => $ppn->getKey()]]])]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.taxes');

        $this->assertSame(0, Quotation::query()->count());
    }

    public function test_a_tax_without_an_effective_rule_version_fails_closed(): void {
        $noRule = Tax::query()->create(['name' => 'Tanpa versi', 'rate' => 11, 'category' => Tax::CATEGORY_PPN_STANDARD]);

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload(['items' => [$this->itemPayload(['taxes' => [['id' => $noRule->getKey()]]])]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.taxes.0');

        $this->assertSame(0, Quotation::query()->count());
    }
}
