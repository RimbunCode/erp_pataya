<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\UnknownPostingDocumentTypeException;
use App\Services\Finances\Posting\Rules\AssetDepreciationRule;
use App\Services\Finances\Posting\Rules\AssetDisposalRule;
use App\Services\Finances\Posting\Rules\AssetScrapRule;
use App\Services\Finances\Posting\Rules\AssetValueAdjustmentRule;
use App\Services\Finances\Posting\Rules\DeliveryNoteRule;
use App\Services\Finances\Posting\Rules\PaymentEntryRule;
use App\Services\Finances\Posting\Rules\PostingRule;
use App\Services\Finances\Posting\Rules\PurchaseInvoiceRule;
use App\Services\Finances\Posting\Rules\PurchaseReceiptRule;
use App\Services\Finances\Posting\Rules\SalesInvoiceRule;
use App\Services\Finances\Posting\Rules\StockEntryRule;

/**
 * Daftar `PostingRule` per `PostingDocumentType` (Finance Fase 2, Requirement 4.3, 5.6). Tanpa argumen, mendaftarkan
 * kesepuluh rule bawaan; test dapat menyuntikkan daftar sendiri. Jenis tanpa rule melempar
 * `UnknownPostingDocumentTypeException` (kesalahan pemrograman).
 */
final class PostingRuleRegistry {
    /** @var array<string, PostingRule> */
    private array $rules = [];

    /**
     * @param  iterable<PostingRule>|null  $rules
     */
    public function __construct(?iterable $rules = null) {
        foreach ($rules ?? self::defaultRules() as $rule) {
            $this->rules[$rule->documentType()->value] = $rule;
        }
    }

    /**
     * @throws UnknownPostingDocumentTypeException
     */
    public function for(PostingDocumentType $type): PostingRule {
        return $this->rules[$type->value] ?? throw UnknownPostingDocumentTypeException::for($type->value);
    }

    public function has(PostingDocumentType $type): bool {
        return isset($this->rules[$type->value]);
    }

    /**
     * @return list<PostingRule>
     */
    private static function defaultRules(): array {
        return [
            new SalesInvoiceRule,
            new PurchaseInvoiceRule,
            new PurchaseReceiptRule,
            new DeliveryNoteRule,
            new PaymentEntryRule,
            new StockEntryRule,
            new AssetDepreciationRule,
            new AssetScrapRule,
            new AssetValueAdjustmentRule,
            new AssetDisposalRule,
        ];
    }
}
