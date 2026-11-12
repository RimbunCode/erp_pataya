<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingOutcome;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 2, Q-P2-12: hasil terstruktur posting; Q-P2-13: dokumen penjaga pada konteks.
 */
class PostingOutcomeTest extends TestCase {
    public function test_three_distinct_statuses(): void {
        $this->assertTrue(PostingOutcome::posted()->isPosted());
        $this->assertTrue(PostingOutcome::alreadyPosted([])->isAlreadyPosted());
        $this->assertTrue(PostingOutcome::skipped()->isSkipped());
        $this->assertSame(
            [PostingOutcome::POSTED, PostingOutcome::ALREADY_POSTED, PostingOutcome::SKIPPED],
            [PostingOutcome::posted()->status, PostingOutcome::alreadyPosted([])->status, PostingOutcome::skipped()->status],
        );
        $this->assertFalse(PostingOutcome::skipped()->isPosted());
        $this->assertSame([], PostingOutcome::skipped()->journals);
    }

    public function test_guard_document_defaults_to_the_source_and_can_be_overridden(): void {
        $date    = CarbonImmutable::parse('2026-11-12');
        $default = new PostingContext(PostingDocumentType::AssetDisposal, 'App\\Models\\Asset\\Asset', 'A1', $date, null, []);
        $custom  = new PostingContext(PostingDocumentType::AssetDisposal, 'App\\Models\\Asset\\Asset', 'A1', $date, null, [], guardDocument: ['type' => 'App\\Models\\Finances\\SalesInvoice', 'id' => 'S1']);

        $this->assertSame(['App\\Models\\Asset\\Asset', 'A1'], [$default->guardType(), $default->guardId()]);
        $this->assertSame(['App\\Models\\Finances\\SalesInvoice', 'S1'], [$custom->guardType(), $custom->guardId()]);
    }
}
