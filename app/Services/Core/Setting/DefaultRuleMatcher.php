<?php

namespace App\Services\Core\Setting;

class DefaultRuleMatcher {
    /** @param list<DefaultRule> $rules */
    public function match(array $rules, string $documentType, ItemAttributes $item): ?DefaultRule {
        $matches = array_values(array_filter(
            $rules,
            fn (DefaultRule $rule): bool => $rule->matches($documentType, $item),
        ));

        usort(
            $matches,
            fn (DefaultRule $left, DefaultRule $right): int => ($right->specificity() <=> $left->specificity())
            ?: ($right->priority <=> $left->priority)
            ?: ($left->documentType <=> $right->documentType)
            ?: ($left->itemType <=> $right->itemType)
            ?: ($left->isStockItem <=> $right->isStockItem)
            ?: ($left->itemCategoryId <=> $right->itemCategoryId)
            ?: ($left->value <=> $right->value),
        );

        return $matches[0] ?? null;
    }
}
