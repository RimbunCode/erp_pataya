<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use App\Services\Finances\Posting\Rules\DeliveryNoteRule;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * Task 12.1 bagian B: rule Delivery Note per baris (debit COGS / kredit stock per baris, retur menukar sisi) dan
 * jatuh ke bentuk lama (tingkat dokumen) bila `lines` kosong atau jumlahnya tidak sama dengan `total_picked`.
 */
class DeliveryNoteRulePerLineTest extends TestCase {
    /**
     * @param  list<LineAttributes>  $lines
     */
    private function build(float $total, bool $isReturn, array $lines): array {
        return (new DeliveryNoteRule)->build(new PostingContext(
            PostingDocumentType::DeliveryNote,
            'App\\Models\\Doc',
            '01DOC',
            CarbonImmutable::parse('2026-11-26'),
            null,
            ['total_picked' => $total],
            ['is_return'    => $isReturn],
            [],
            $lines,
        ));
    }

    private function line(string $id, float $amount): LineAttributes {
        return new LineAttributes(amounts: ['amount' => $amount], lineId: $id);
    }

    /**
     * @return list<string>
     */
    private function shape(RoleJournalDraft $draft): array {
        return array_map(fn (RoleLine $line): string => "{$line->side}:{$line->roleValue()}:{$line->amount}:" . ($line->line?->lineId ?? '-'), $draft->lines);
    }

    public function test_forward_delivery_builds_cogs_and_stock_pairs_per_line(): void {
        $drafts = $this->build(500, false, [$this->line('A', 300), $this->line('B', 200)]);

        $this->assertCount(1, $drafts);
        $this->assertSame('default', $drafts[0]->purpose);
        $this->assertSame([
            'debit:cost_of_goods_sold:300:A', 'credit:stock:300:A',
            'debit:cost_of_goods_sold:200:B', 'credit:stock:200:B',
        ], $this->shape($drafts[0]));
    }

    public function test_return_delivery_swaps_sides_per_line(): void {
        $drafts = $this->build(500, true, [$this->line('A', 300), $this->line('B', 200)]);

        $this->assertSame([
            'debit:stock:300:A', 'credit:cost_of_goods_sold:300:A',
            'debit:stock:200:B', 'credit:cost_of_goods_sold:200:B',
        ], $this->shape($drafts[0]));
    }

    public function test_falls_back_to_document_level_pair_when_lines_are_empty(): void {
        $drafts = $this->build(300, false, []);

        $this->assertSame(['debit:cost_of_goods_sold:300:-', 'credit:stock:300:-'], $this->shape($drafts[0]));
    }

    public function test_falls_back_to_document_level_pair_when_line_sum_differs_from_total(): void {
        $drafts = $this->build(700, true, [$this->line('A', 300), $this->line('B', 200)]);

        $this->assertSame(['debit:stock:700:-', 'credit:cost_of_goods_sold:700:-'], $this->shape($drafts[0]));
    }

    public function test_zero_total_or_zero_lines_produce_no_journal(): void {
        $this->assertSame([], $this->build(0, false, [$this->line('A', 0)]));
        $this->assertSame(['debit:cost_of_goods_sold:300:-', 'credit:stock:300:-'], $this->shape($this->build(300, false, [$this->line('A', 0)])[0]));
    }
}
