<?php

namespace Tests\Feature\Finances\Ledger;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Finance Fase 1, Task 4.7 (Requirement 4.5-4.6): test arsitektur ringan yang gagal bila ada kode di `app/` yang
 * menulis baris `general_ledgers` baru di luar allowlist. Memindai teks sumber (bukan perilaku), jadi hanya
 * menangkap pola penulisan yang umum.
 *
 * - Allowlist final: `JournalService`, `JournalReversalService`, dan perintah backfill.
 * - Daftar sementara penulis legacy: titik posting yang belum dialihkan ke `JournalService` (Task 6.x). Setiap
 *   entri dihapus ketika titik itu dialihkan; test juga gagal bila entri sementara tidak lagi menulis GL (daftar
 *   tidak boleh basi).
 * - Satu-satunya update/delete massal baris GL adalah hook cancel `Submitable` (Requirement 4.5; dihapus Fase 2).
 */
class LedgerWriteAllowlistTest extends TestCase {
    /**
     * Bentuk penulisan baris GL yang dikenali (pemindaian teks, bukan analisis aliran data): pemanggilan statis,
     * lewat `query()`, relasi `generalLedgerEntries()`/`lines()`, `DB::table('general_ledgers')`, `new`/`make`, dan
     * `replicate()` dari variabel ledger.
     *
     * Peringatan positif palsu: alternatif `lines()` di pola ketiga mencocokkan nama relasi saja, bukan tipe modelnya.
     * Relasi `lines()` milik model lain (mis. item dokumen) yang menulis lewat `->create/save/make` di `app/` akan
     * terdeteksi sebagai penulis GL. Bila itu terjadi, ganti nama relasi tersebut atau persempit pola ini (jangan
     * menambahkan berkasnya ke allowlist), dan tambah cuplikan negatifnya di `readOnlySnippets()`.
     */
    private const WRITE_PATTERN = '/GeneralLedger::(?:create|insert|insertOrIgnore|upsert|firstOrCreate|updateOrCreate|forceCreate|make)\b'
        . '|GeneralLedger::query\(\)\s*->\s*(?:create|insert|insertOrIgnore|upsert|firstOrCreate|updateOrCreate|forceCreate|make)\b'
        . '|(?:generalLedgerEntries|lines)\(\)\s*->\s*(?:create|createMany|insert|forceCreate|firstOrCreate|updateOrCreate|save|saveMany|make)\b'
        . '|table\(\s*[\'"]general_ledgers[\'"]\s*\)\s*->\s*(?:insert|insertOrIgnore|insertGetId|upsert)\b'
        . '|new\s+GeneralLedger\b'
        . '|GeneralLedger::[^;]*?->\s*replicate\s*\('
        . '|\$\w*[lL]edger\w*\s*->\s*replicate\s*\(/';

    /**
     * Update/delete massal baris GL tanpa melewati model: `GeneralLedger::...->update()`, `DB::table('general_ledgers')`,
     * dan relasi `generalLedgerEntries()`/`lines()`.
     */
    private const BULK_MUTATION_PATTERN = '/GeneralLedger::[^;]*?->\s*(?:update|delete|forceDelete|truncate)\s*\('
        . '|table\(\s*[\'"]general_ledgers[\'"]\s*\)[^;]*?->\s*(?:update|delete|truncate)\s*\('
        . '|(?:generalLedgerEntries|lines)\(\)[^;]*?->\s*(?:update|delete|forceDelete)\s*\(/s';

    /**
     * Penulis resmi (Requirement 4.6).
     *
     * @var list<string>
     */
    private const ALLOWED = [
        'Services/Finances/Ledger/JournalService.php',
        'Services/Finances/Ledger/JournalReversalService.php',
        'Console/Commands/Finances/BackfillJournalsCommand.php',
    ];

    /**
     * Penulis legacy sementara; dialihkan pada Task 6.x (setiap entri dihapus saat titiknya dialihkan).
     *
     * @var array<string, string>
     */
    private const LEGACY_WRITERS = [
        'Listeners/Finances/Ledger/PostSalesInvoiceGeneralLedger.php'    => 'Task 6.1',
        'Listeners/Finances/Ledger/PostPurchaseInvoiceGeneralLedger.php' => 'Task 6.2',
        'Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php' => 'Task 6.3',
        'Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php'   => 'Task 6.4',
        'Services/Finances/PaymentEntryService.php'                      => 'Task 6.5',
        'Services/Inventory/StockEntryService.php'                       => 'Task 6.6',
        'Listeners/Asset/Depreciation/PostDepreciationEntry.php'         => 'Task 6.7',
        'Listeners/Asset/Depreciation/PostScrapWriteOff.php'             => 'Task 6.7',
        'Listeners/Asset/Depreciation/PostValueAdjustmentEntry.php'      => 'Task 6.7',
        'Listeners/Asset/Rental/PostAssetDisposalGainLoss.php'           => 'Task 6.7',
    ];

    /**
     * Update/delete massal yang diizinkan: hook cancel `Submitable` (pengecualian legacy, Requirement 4.5).
     *
     * @var list<string>
     */
    private const ALLOWED_BULK_MUTATIONS = [
        'Traits/Submitable.php',
    ];

    /**
     * @return array<string, string> path relatif terhadap `app/` => isi berkas
     */
    private function sources(): array {
        $root     = realpath(__DIR__ . '/../../../../app');
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS));

        $sources = [];
        foreach ($iterator as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }
            $relative           = str_replace('\\', '/', substr($file->getPathname(), \strlen($root) + 1));
            $sources[$relative] = (string) file_get_contents($file->getPathname());
        }

        return $sources;
    }

    /**
     * @return list<string>
     */
    private function filesMatching(string $pattern): array {
        $matches = [];
        foreach ($this->sources() as $path => $contents) {
            if (preg_match($pattern, $contents) === 1) {
                $matches[] = $path;
            }
        }
        sort($matches);

        return $matches;
    }

    public function test_only_allowed_code_writes_general_ledger_rows(): void {
        $unexpected = array_values(array_diff($this->filesMatching(self::WRITE_PATTERN), self::ALLOWED, array_keys(self::LEGACY_WRITERS)));

        $this->assertSame([], $unexpected, 'Penulisan GL di luar allowlist. Gunakan JournalService::post()/postPair(): ' . implode(', ', $unexpected));
    }

    public function test_temporary_legacy_writer_list_is_not_stale(): void {
        $writers = $this->filesMatching(self::WRITE_PATTERN);

        $stale = array_values(array_diff(array_keys(self::LEGACY_WRITERS), $writers));

        $this->assertSame([], $stale, 'Entri sementara tidak lagi menulis GL; hapus dari LEGACY_WRITERS: ' . implode(', ', $stale));
    }

    public function test_allowed_writers_exist_or_are_planned(): void {
        // Perintah backfill baru dibuat pada Task 7.1; entri allowlist boleh menunjuk berkas yang belum ada.
        $existing = array_intersect(self::ALLOWED, array_keys($this->sources()));

        $this->assertContains('Services/Finances/Ledger/JournalService.php', $existing);
        $this->assertContains('Services/Finances/Ledger/JournalReversalService.php', $existing);
    }

    public function test_only_the_submitable_cancel_hook_mutates_general_ledger_rows_in_bulk(): void {
        $mutators = $this->filesMatching(self::BULK_MUTATION_PATTERN);

        $this->assertSame(self::ALLOWED_BULK_MUTATIONS, $mutators, 'Update/delete massal GL di luar hook cancel Submitable: ' . implode(', ', array_diff($mutators, self::ALLOWED_BULK_MUTATIONS)));
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function writeSnippets(): array {
        return [
            'static create'      => ['GeneralLedger::create([]);'],
            'static make'        => ['$line = GeneralLedger::make($attributes); $line->save();'],
            'query create'       => ['GeneralLedger::query()->create($attributes);'],
            'query forceCreate'  => ['GeneralLedger::query() ->forceCreate($attributes);'],
            'account relation'   => ['$account->generalLedgerEntries()->create($attributes);'],
            'account saveMany'   => ['$account->generalLedgerEntries()->saveMany($rows);'],
            'journal lines'      => ['$journal->lines()->create($attributes);'],
            'db table insert'    => ["DB::table('general_ledgers')->insert(\$rows);"],
            'new instance'       => ['$line = new GeneralLedger(); $line->save();'],
            'replicate variable' => ['$copy = $ledgerRow->replicate(); $copy->save();'],
            'replicate static'   => ['$copy = GeneralLedger::find($id)->replicate();'],
        ];
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function readOnlySnippets(): array {
        return [
            'query where get'    => ['GeneralLedger::query()->where("account_id", $id)->get();'],
            'static where first' => ['GeneralLedger::where("journal_id", $id)->first();'],
            'journal lines read' => ['$journal->lines()->get(); $journal->lines()->count();'],
            'relation read'      => ['$account->generalLedgerEntries()->sum("debit");'],
            'db table read'      => ["DB::table('general_ledgers')->where('id', 1)->first();"],
            'other model create' => ['Journal::query()->create($attributes); StockLedgerEntry::create([]);'],
            'other replicate'    => ['$copy = $invoice->replicate();'],
        ];
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function bulkMutationSnippets(): array {
        return [
            'static update'        => ['GeneralLedger::where("a", 1)->update(["deleted_at" => now()]);'],
            'static delete'        => ['GeneralLedger::where("a", 1)->delete();'],
            'query forceDelete'    => ['GeneralLedger::query()->whereIn("id", $ids)->forceDelete();'],
            'db table update'      => ["DB::table('general_ledgers')->where('a', 1)->update(['debit' => 1]);"],
            'db table delete'      => ["DB::table('general_ledgers')->delete();"],
            'account relation'     => ['$account->generalLedgerEntries()->where("a", 1)->update(["debit" => 1]);'],
            'journal lines delete' => ['$journal->lines()->delete();'],
        ];
    }

    #[DataProvider('writeSnippets')]
    public function test_write_pattern_detects_known_write_forms(string $snippet): void {
        $this->assertSame(1, preg_match(self::WRITE_PATTERN, $snippet), "Tidak terdeteksi: {$snippet}");
    }

    #[DataProvider('readOnlySnippets')]
    public function test_write_and_bulk_patterns_ignore_read_only_code(string $snippet): void {
        $this->assertSame(0, preg_match(self::WRITE_PATTERN, $snippet), "Positif palsu (tulis): {$snippet}");
        $this->assertSame(0, preg_match(self::BULK_MUTATION_PATTERN, $snippet), "Positif palsu (massal): {$snippet}");
    }

    #[DataProvider('bulkMutationSnippets')]
    public function test_bulk_mutation_pattern_detects_known_forms(string $snippet): void {
        $this->assertSame(1, preg_match(self::BULK_MUTATION_PATTERN, $snippet), "Tidak terdeteksi: {$snippet}");
    }
}
