<?php

namespace Tests\Unit\Finances\Tax;

use App\Models\Finances\Tax;
use App\Services\Finances\Tax\ItemTaxSelection;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Aturan kombinasi pajak majemuk per item dan normalisasi baris (spek finance-multi-tax-per-item, Requirement 2 dan 8.2).
 */
class ItemTaxSelectionTest extends TestCase {
    private function tax(string $id, string $category = Tax::CATEGORY_OTHER, string $behavior = Tax::BEHAVIOR_ADDITIVE): Tax {
        // setAttribute (bukan fill): tes unit tanpa tabel, fill() membuang kolom yang tak dikenal skema.
        $tax = new Tax;
        $tax->setAttribute('id', $id);
        $tax->setAttribute('category', $category);
        $tax->setAttribute('behavior', $behavior);

        return $tax;
    }

    public function test_a_single_tax_and_an_empty_selection_are_valid(): void {
        $this->assertSame([], ItemTaxSelection::violations([]));
        $this->assertSame([], ItemTaxSelection::violations([$this->tax('a', Tax::CATEGORY_PPN_STANDARD)]));
    }

    public function test_additive_together_with_withholding_is_allowed(): void {
        $this->assertSame([], ItemTaxSelection::violations([
            $this->tax('ppn', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('pph', Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING),
        ]));
    }

    public function test_unclassified_taxes_may_be_combined_with_others(): void {
        $this->assertSame([], ItemTaxSelection::violations([
            $this->tax('ppn', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('lama', Tax::CATEGORY_UNCLASSIFIED),
            $this->tax('lama2', Tax::CATEGORY_UNCLASSIFIED),
        ]));
    }

    public function test_a_duplicate_tax_id_is_rejected(): void {
        $this->assertSame([ItemTaxSelection::VIOLATION_DUPLICATE], ItemTaxSelection::violations([$this->tax('a'), $this->tax('b'), $this->tax('a')]));
    }

    public function test_more_than_one_standard_ppn_is_rejected_but_a_luxury_ppn_alongside_is_allowed(): void {
        $this->assertSame([ItemTaxSelection::VIOLATION_MULTIPLE_PPN], ItemTaxSelection::violations([
            $this->tax('a', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('b', Tax::CATEGORY_PPN_STANDARD),
        ]));
        $this->assertSame([], ItemTaxSelection::violations([
            $this->tax('a', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('b', Tax::CATEGORY_PPN_LUXURY),
        ]));
    }

    public function test_more_than_the_limit_is_rejected_and_exactly_the_limit_is_allowed(): void {
        $five = array_map(fn (int $i): Tax => $this->tax("t{$i}"), range(1, ItemTaxSelection::MAX_TAXES));
        $this->assertSame([], ItemTaxSelection::violations($five));

        $six = [...$five, $this->tax('t6')];
        $this->assertSame([ItemTaxSelection::VIOLATION_TOO_MANY], ItemTaxSelection::violations($six));
    }

    public function test_every_violation_is_reported_once(): void {
        $violations = ItemTaxSelection::violations([
            $this->tax('a', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('a', Tax::CATEGORY_PPN_STANDARD),
            $this->tax('b'),
            $this->tax('c'),
            $this->tax('d'),
            $this->tax('e'),
        ]);

        $this->assertEqualsCanonicalizing([ItemTaxSelection::VIOLATION_DUPLICATE, ItemTaxSelection::VIOLATION_MULTIPLE_PPN, ItemTaxSelection::VIOLATION_TOO_MANY], $violations);
    }

    public function test_messages_exist_in_indonesian_and_english(): void {
        foreach (['id', 'en'] as $locale) {
            app()->setLocale($locale);
            foreach ([ItemTaxSelection::VIOLATION_DUPLICATE, ItemTaxSelection::VIOLATION_MULTIPLE_PPN, ItemTaxSelection::VIOLATION_TOO_MANY, ItemTaxSelection::VIOLATION_REQUIRED] as $code) {
                $message = ItemTaxSelection::message($code);
                $this->assertNotSame("finances/taxes.selection.{$code}", $message, "Pesan {$code} ({$locale}) belum ada.");
            }
        }

        app()->setLocale('en');
        $this->assertStringContainsString((string) ItemTaxSelection::MAX_TAXES, ItemTaxSelection::message(ItemTaxSelection::VIOLATION_TOO_MANY));
    }

    public function test_row_taxes_normalizes_the_single_tax_form_and_taxes_wins(): void {
        $this->assertSame([['id' => 'a']], ItemTaxSelection::rowTaxes(['tax' => ['id' => 'a']]));
        $this->assertSame([['id' => 'b'], ['id' => 'c']], ItemTaxSelection::rowTaxes(['taxes' => [['id' => 'b'], ['id' => 'c']], 'tax' => ['id' => 'a']]));
        $this->assertSame([['id' => 'a']], ItemTaxSelection::rowTaxes(['taxes' => [], 'tax' => ['id' => 'a']]), 'taxes kosong jatuh ke tax tunggal.');
        $this->assertSame([], ItemTaxSelection::rowTaxes(['tax' => ['id' => null]]));
        $this->assertSame([], ItemTaxSelection::rowTaxes(['tax' => null]));
        $this->assertSame([], ItemTaxSelection::rowTaxes([]));
        $this->assertSame([['id' => 'b']], ItemTaxSelection::rowTaxes(['taxes' => [['id' => 'b'], ['id' => ''], 'x', ['name' => 'tanpa id']]]));
        $this->assertSame(['b', 'b'], ItemTaxSelection::rowTaxIds(['taxes' => [['id' => 'b'], ['id' => 'b']]]), 'Duplikat dipertahankan agar bisa ditolak.');
    }

    public function test_errors_for_rows_use_the_row_index_key(): void {
        $taxes = ['a' => $this->tax('a', Tax::CATEGORY_PPN_STANDARD), 'b' => $this->tax('b', Tax::CATEGORY_PPN_STANDARD), 'c' => $this->tax('c')];

        $errors = ItemTaxSelection::errorsForRows([
            ['taxes' => [['id' => 'a'], ['id' => 'c']]],
            ['taxes' => [['id' => 'a'], ['id' => 'b']]],
        ], $taxes);

        $this->assertSame(['items.1.taxes'], array_keys($errors));
    }

    public function test_assert_rows_throws_a_validation_exception_on_the_taxes_key(): void {
        $taxes = ['a' => $this->tax('a')];

        try {
            ItemTaxSelection::assertRows([['taxes' => [['id' => 'a'], ['id' => 'a']]]], $taxes);
            $this->fail('Duplikat harus ditolak.');
        } catch (ValidationException $e) {
            $this->assertSame(['items.0.taxes'], array_keys($e->errors()));
        }

        ItemTaxSelection::assertRows([['taxes' => [['id' => 'a']]]], $taxes);
        $this->addToAssertionCount(1);
    }
}
