<?php

namespace Tests\Unit\Finances\Posting;

use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Exceptions\Finances\InvalidPostingRuleException;
use App\Exceptions\Finances\PartialPostingException;
use App\Exceptions\Finances\UnknownPostingDocumentTypeException;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 2.4: pesan exception Posting Engine berlokalisasi (tidak mengembalikan kunci mentah) pada
 * kedua locale.
 */
class PostingExceptionsTest extends TestCase {
    public function test_messages_are_localized_and_never_raw_keys(): void {
        foreach (['id', 'en'] as $locale) {
            app()->setLocale($locale);

            $messages = [
                UnresolvedAccountRoleException::notResolved('stock', 'delivery_note', 'normal', '2026-11-12', ['a', 'b'])->getMessage(),
                UnresolvedAccountRoleException::invalidAccount('stock', 'delivery_note', 'return', '2026-11-12', 'profile', '1241 - X', 'group')->getMessage(),
                UnknownPostingDocumentTypeException::for('kwitansi')->getMessage(),
                PartialPostingException::for('sales_invoice', '01ABC', ['k1'], ['k2'])->getMessage(),
                InvalidPostingProfileException::overlap('Profil', '2026-01-01', null)->getMessage(),
                InvalidPostingProfileException::invalidRange()->getMessage(),
                InvalidPostingProfileException::notDraft('active')->getMessage(),
                InvalidPostingProfileException::notActive('draft')->getMessage(),
                InvalidPostingProfileException::accountProblem('stock', '1241 - X', 'disabled')->getMessage(),
                InvalidPostingRuleException::duplicate('expense')->getMessage(),
                InvalidPostingRuleException::itemConditionOnNonLineSensitiveRole('receivable')->getMessage(),
                InvalidPostingRuleException::unknownDocumentType('x')->getMessage(),
                InvalidPostingRuleException::invalidVariant('x')->getMessage(),
                InvalidPostingRuleException::unknownCategory()->getMessage(),
                InvalidPostingRuleException::accountProblem('revenue', '4110 - X', 'deleted')->getMessage(),
            ];

            foreach ($messages as $message) {
                $this->assertStringNotContainsString('finances/posting', $message, "{$locale}: {$message}");
                foreach ([':role', ':document', ':variant', ':date', ':layers', ':layer', ':account', ':reason', ':name', ':from', ':to', ':status', ':type', ':source', ':existing', ':missing'] as $placeholder) {
                    $this->assertStringNotContainsString($placeholder, $message, "{$locale}: placeholder {$placeholder} tidak terisi");
                }
            }
        }
    }

    public function test_unresolved_exception_carries_its_context(): void {
        $e = UnresolvedAccountRoleException::notResolved('stock', 'delivery_note', 'return', '2026-11-12', ['master', 'profil']);

        $this->assertSame('stock', $e->role);
        $this->assertSame('delivery_note', $e->documentType);
        $this->assertSame('return', $e->variant);
        $this->assertSame('2026-11-12', $e->date);
        $this->assertSame(['master', 'profil'], $e->layers);
    }

    public function test_partial_posting_exception_lists_existing_and_missing_keys(): void {
        $e = PartialPostingException::for('purchase_invoice', '01ABC', ['a:1:stock'], ['a:1:expense']);

        $this->assertSame(['a:1:stock'], $e->existingKeys);
        $this->assertSame(['a:1:expense'], $e->missingKeys);
        $this->assertStringContainsString('a:1:stock', $e->getMessage());
        $this->assertStringContainsString('a:1:expense', $e->getMessage());
    }
}
