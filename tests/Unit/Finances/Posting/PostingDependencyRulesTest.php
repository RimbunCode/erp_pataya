<?php

namespace Tests\Unit\Finances\Posting;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Finance Fase 2, Task 4.6 (P-8; Requirement 4.4): kode di `app/Services/Finances/Posting/**` dan
 * `app/Services/Finances/Ledger/**` tidak boleh mengimpor model modul bisnis (`App\Models\Sales|Purchase|Inventory|
 * Asset`). Informasi dokumen hanya sampai ke engine lewat `PostingContext`. Memeriksa `use` dan rujukan
 * namespace pada kode (komentar tidak dihitung).
 */
class PostingDependencyRulesTest extends TestCase {
    private const FORBIDDEN = '/\\\\?App\\\\Models\\\\(Sales|Purchase|Inventory|Asset)\\\\/';

    /**
     * @return list<string>
     */
    private function phpFiles(): array {
        $files = [];
        foreach (['Posting', 'Ledger'] as $folder) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(\dirname(__DIR__, 4) . "/app/Services/Finances/{$folder}", RecursiveDirectoryIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        return $files;
    }

    private function codeOf(string $path): string {
        $code = '';
        foreach (token_get_all((string) file_get_contents($path)) as $token) {
            if (\is_array($token) && \in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $code .= \is_array($token) ? $token[1] : $token;
        }

        return $code;
    }

    public function test_the_scan_finds_the_posting_and_ledger_sources(): void {
        $names = array_map('basename', $this->phpFiles());

        $this->assertContains('PostingService.php', $names);
        $this->assertContains('JournalService.php', $names);
        $this->assertContains('SalesInvoiceRule.php', $names);
    }

    public function test_posting_and_ledger_do_not_reference_business_module_models(): void {
        $violations = [];
        foreach ($this->phpFiles() as $path) {
            if (preg_match(self::FORBIDDEN, $this->codeOf($path), $match) === 1) {
                $violations[] = basename($path) . " -> App\\Models\\{$match[1]}";
            }
        }

        $this->assertSame([], $violations, 'Posting/Ledger tidak boleh mengimpor model Sales/Purchase/Inventory/Asset (P-8).');
    }

    public function test_the_forbidden_pattern_detects_use_statements_and_fully_qualified_names(): void {
        $this->assertSame(1, preg_match(self::FORBIDDEN, 'use App\\Models\\Sales\\Customer;'));
        $this->assertSame(1, preg_match(self::FORBIDDEN, '$x = \\App\\Models\\Asset\\Asset::class;'));
        $this->assertSame(0, preg_match(self::FORBIDDEN, 'use App\\Models\\Finances\\Account;'));
    }
}
