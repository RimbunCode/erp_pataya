<?php

namespace Tests\Unit\Core\Setting;

use App\Services\Core\Setting\DefaultRule;
use App\Services\Core\Setting\DefaultRuleMatcher;
use App\Services\Core\Setting\ItemAttributes;
use PHPUnit\Framework\TestCase;

class DefaultRuleMatcherTest extends TestCase {
    public function test_specificity_precedes_priority_and_result_does_not_depend_on_input_order(): void {
        $broad    = new DefaultRule(null, 'goods', null, null, 'broad', 99);
        $specific = new DefaultRule('purchase_order', 'goods', true, null, 'specific', 1);
        $matcher  = new DefaultRuleMatcher;
        $item     = new ItemAttributes('goods', true, null);

        $this->assertSame('specific', $matcher->match([$broad, $specific], 'purchase_order', $item)?->value);
        $this->assertSame('specific', $matcher->match([$specific, $broad], 'purchase_order', $item)?->value);
    }

    public function test_priority_breaks_ties_and_null_values_remain_explicit_matches(): void {
        $lowPriority  = new DefaultRule(null, 'goods', null, null, 'low', 1);
        $highPriority = new DefaultRule(null, 'goods', null, null, null, 2);
        $matcher      = new DefaultRuleMatcher;

        $matched = $matcher->match([$lowPriority, $highPriority], 'purchase_order', new ItemAttributes('goods', true, null));
        $this->assertNotNull($matched);
        $this->assertNull($matched->value);
        $this->assertNull($matcher->match([], 'purchase_order', new ItemAttributes('goods', true, null)));
    }

    public function test_category_ulids_match_independently_of_letter_case(): void {
        $rule = new DefaultRule(null, null, null, '01KXXH6AXAQDPDMHC8J4PVYPMW', 'matched', 0);

        $this->assertSame(
            'matched',
            (new DefaultRuleMatcher)->match(
                [$rule],
                'purchase_order',
                new ItemAttributes('goods', true, '01kxxh6axaqdpdmhc8j4pvypmw'),
            )?->value,
        );
    }
}
