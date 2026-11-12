<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\AccountRuleMatcher;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 3.5-3.6: pencocokan aturan akun bersyarat murni (tanpa DB). P-10 (spesifisitas deterministik,
 * tidak bergantung urutan penyimpanan) dan P-11 (retur tanpa aturan khusus = akun normal).
 */
class AccountRuleMatcherTest extends TestCase {
    private AccountRuleMatcher $matcher;

    protected function setUp(): void {
        parent::setUp();
        $this->matcher = new AccountRuleMatcher;
    }

    private function ctx(bool $return = false, PostingDocumentType $type = PostingDocumentType::PurchaseInvoice): PostingContext {
        return new PostingContext(
            documentType: $type,
            sourceType: 'x',
            sourceId: '1',
            transactionDate: CarbonImmutable::parse('2026-11-12'),
            branchId: null,
            amounts: ['total' => 100],
            flags: ['is_return' => $return],
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function rule(string $account, array $attributes = [], string $role = 'expense'): PostingProfileRule {
        return (new PostingProfileRule)->forceFill(['role' => $role, 'account_id' => $account, 'priority' => 0, ...$attributes]);
    }

    private function line(?bool $stock = null, ?string $type = null, ?string $category = null): LineAttributes {
        return new LineAttributes(['amount' => 10], itemType: $type, isStockItem: $stock, itemCategoryId: $category);
    }

    public function test_returns_null_without_rules_or_without_a_matching_role(): void {
        $this->assertNull($this->matcher->match([], AccountRole::Expense, $this->ctx(), $this->line()));
        $this->assertNull($this->matcher->match([$this->rule('A', role: 'revenue')], AccountRole::Expense, $this->ctx(), $this->line()));
    }

    public function test_most_specific_rule_wins_over_priority(): void {
        $rules = [
            $this->rule('GENERIC', ['priority' => 100]),
            $this->rule('NONSTOCK', ['is_stock_item' => false]),
            $this->rule('NONSTOCK_CATEGORY', ['is_stock_item' => false, 'item_category_id' => 'CAT-X']),
        ];

        $match = $this->matcher->match($rules, 'expense', $this->ctx(), $this->line(false, null, 'CAT-X'));
        $this->assertSame('NONSTOCK_CATEGORY', $match->account_id);

        $match = $this->matcher->match($rules, 'expense', $this->ctx(), $this->line(false, null, 'CAT-Y'));
        $this->assertSame('NONSTOCK', $match->account_id);

        $match = $this->matcher->match($rules, 'expense', $this->ctx(), $this->line(true));
        $this->assertSame('GENERIC', $match->account_id);
    }

    public function test_priority_breaks_ties_between_equally_specific_rules(): void {
        $rules = [
            $this->rule('LOW', ['item_type' => 'service', 'priority' => 1]),
            $this->rule('HIGH', ['is_stock_item' => false, 'priority' => 5]),
        ];

        $match = $this->matcher->match($rules, 'expense', $this->ctx(), $this->line(false, 'service'));

        $this->assertSame('HIGH', $match->account_id);
    }

    public function test_item_conditions_never_match_without_line_attributes(): void {
        $rules = [
            $this->rule('NONSTOCK', ['is_stock_item' => false]),
            $this->rule('DOCONLY', ['document_type' => 'purchase_invoice']),
        ];

        $match = $this->matcher->match($rules, 'expense', $this->ctx(), null);
        $this->assertSame('DOCONLY', $match->account_id);

        $this->assertNull($this->matcher->match([$this->rule('NONSTOCK', ['is_stock_item' => false])], 'expense', $this->ctx(), null));
        // Atribut barang tidak diketahui (null) tidak cocok dengan syarat `is_stock_item`.
        $this->assertNull($this->matcher->match([$this->rule('NONSTOCK', ['is_stock_item' => false])], 'expense', $this->ctx(), $this->line(null)));
    }

    public function test_document_type_condition_must_equal_the_context(): void {
        $rule = $this->rule('SALES', ['document_type' => 'sales_invoice'], 'revenue');

        $this->assertNull($this->matcher->match([$rule], 'revenue', $this->ctx(type: PostingDocumentType::PurchaseInvoice), $this->line()));
        $this->assertSame('SALES', $this->matcher->match([$rule], 'revenue', $this->ctx(type: PostingDocumentType::SalesInvoice), $this->line())->account_id);
    }

    public function test_return_context_prefers_explicit_return_rules(): void {
        $rules = [
            $this->rule('NORMAL', ['variant' => 'normal', 'is_stock_item' => false]),
            $this->rule('RETURN', ['variant' => 'return']),
        ];

        $match = $this->matcher->match($rules, 'expense', $this->ctx(return: true), $this->line(false));

        $this->assertSame('RETURN', $match->account_id);
    }

    public function test_p11_return_without_a_return_rule_resolves_like_a_normal_document(): void {
        // Aturan tanpa varian yang spesifik (kondisi 1) dan aturan `normal` yang lebih spesifik (kondisi 2).
        // Retur harus menghasilkan akun yang SAMA dengan dokumen normal, walau aturan tanpa varian ikut cocok.
        $rules = [
            $this->rule('GENERIC_NO_VARIANT', ['is_stock_item' => false]),
            $this->rule('NORMAL_SPECIFIC', ['variant' => 'normal', 'is_stock_item' => false]),
            $this->rule('FALLBACK'),
        ];
        $line = $this->line(false);

        $normal = $this->matcher->match($rules, 'expense', $this->ctx(return: false), $line);
        $return = $this->matcher->match($rules, 'expense', $this->ctx(return: true), $line);

        $this->assertSame('NORMAL_SPECIFIC', $normal->account_id);
        $this->assertSame($normal->account_id, $return->account_id);
    }

    public function test_return_rule_for_another_document_type_does_not_apply(): void {
        $rules = [
            $this->rule('SALES_RETURN', ['variant' => 'return', 'document_type' => 'sales_invoice']),
            $this->rule('DEFAULT'),
        ];

        $match = $this->matcher->match($rules, 'expense', $this->ctx(return: true, type: PostingDocumentType::PurchaseInvoice), $this->line());

        $this->assertSame('DEFAULT', $match->account_id);
    }

    public function test_normal_context_ignores_return_rules(): void {
        $rules = [
            $this->rule('RETURN', ['variant' => 'return']),
            $this->rule('DEFAULT'),
        ];

        $this->assertSame('DEFAULT', $this->matcher->match($rules, 'expense', $this->ctx(), $this->line())->account_id);
    }

    public function test_p10_result_is_independent_of_storage_order(): void {
        mt_srand(20261112);
        $documentTypes = [null, 'purchase_invoice', 'sales_invoice'];
        $variants      = [null, 'normal', 'return'];
        $itemTypes     = [null, 'product', 'service'];
        $stockFlags    = [null, true, false];
        $categories    = [null, 'CAT-A', 'CAT-B'];

        for ($round = 0; $round < 60; $round++) {
            $rules = [];
            for ($i = 0; $i < 12; $i++) {
                $rules[] = $this->rule("ACC-{$round}-{$i}", [
                    'document_type'    => $documentTypes[mt_rand(0, 2)],
                    'variant'          => $variants[mt_rand(0, 2)],
                    'item_type'        => $itemTypes[mt_rand(0, 2)],
                    'is_stock_item'    => $stockFlags[mt_rand(0, 2)],
                    'item_category_id' => $categories[mt_rand(0, 2)],
                    'priority'         => mt_rand(0, 3),
                ]);
            }

            $ctx  = $this->ctx(return: (bool) mt_rand(0, 1), type: mt_rand(0, 1) ? PostingDocumentType::PurchaseInvoice : PostingDocumentType::SalesInvoice);
            $line = $this->line($stockFlags[mt_rand(1, 2)], $itemTypes[mt_rand(1, 2)], $categories[mt_rand(1, 2)]);

            $reference = $this->matcher->match($rules, 'expense', $ctx, $line)?->account_id;

            for ($shuffle = 0; $shuffle < 5; $shuffle++) {
                shuffle($rules);
                $this->assertSame($reference, $this->matcher->match($rules, 'expense', $ctx, $line)?->account_id, "round {$round}");
            }

            if (! $ctx->isReturn()) {
                $top = $this->oracleTopCandidates($rules, $ctx, $line);
                if ($top === []) {
                    $this->assertNull($reference, "round {$round}");
                } else {
                    $this->assertContains($reference, $top, "round {$round}");
                }
            }
        }
    }

    /**
     * Oracle independen untuk konteks normal: kandidat dengan spesifisitas lalu prioritas tertinggi.
     *
     * @param  list<PostingProfileRule>  $rules
     * @return list<string>
     */
    private function oracleTopCandidates(array $rules, PostingContext $ctx, LineAttributes $line): array {
        $matching = array_filter($rules, fn (PostingProfileRule $rule) => ($rule->document_type === null || $rule->document_type === $ctx->documentType->value)
            && ($rule->variant === null || $rule->variant === 'normal')
            && ($rule->item_type === null || $rule->item_type === $line->itemType)
            && ($rule->is_stock_item === null || $rule->is_stock_item === $line->isStockItem)
            && ($rule->item_category_id === null || $rule->item_category_id === $line->itemCategoryId));
        if ($matching === []) {
            return [];
        }

        $best = max(array_map(fn (PostingProfileRule $rule) => [$rule->specificity(), $rule->priority], $matching));

        return array_values(array_map(
            fn (PostingProfileRule $rule) => $rule->account_id,
            array_filter($matching, fn (PostingProfileRule $rule) => [$rule->specificity(), $rule->priority] === $best),
        ));
    }

    public function test_p10_equal_specificity_and_priority_is_broken_by_rule_content_not_storage_order(): void {
        $a    = $this->rule('ACC-A', ['is_stock_item' => false]);
        $b    = $this->rule('ACC-B', ['item_type' => 'service']);
        $line = $this->line(false, 'service');

        $first  = $this->matcher->match([$a, $b], 'expense', $this->ctx(), $line)->account_id;
        $second = $this->matcher->match([$b, $a], 'expense', $this->ctx(), $line)->account_id;

        $this->assertSame($first, $second);
    }
}
