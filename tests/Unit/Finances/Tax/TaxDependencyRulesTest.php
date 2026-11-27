<?php

namespace Tests\Unit\Finances\Tax;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Finance Fase 3, Task 4.6 (P-9; Requirement 4.4-4.5): kode di `app/Services/Finances/Tax/**` tidak boleh mengimpor
 * model modul bisnis (`App\Models\Sales|Purchase|Inventory|Asset`) dan tidak mengenal akun (`Account`,
 * `PostingProfile`): dokumen sampai ke engine hanya lewat `TaxInput`, dan pemetaan peran ke akun adalah urusan
 * Posting Engine. Memeriksa `use` dan rujukan namespace pada kode (komentar tidak dihitung).
 */
class TaxDependencyRulesTest extends TestCase {
    private const FORBIDDEN_MODULES  = '/\\\\?App\\\\Models\\\\(Sales|Purchase|Inventory|Asset)\\\\/';
    private const FORBIDDEN_ACCOUNTS = '/\\\\?App\\\\Models\\\\Finances\\\\(Account|PostingProfile\w*|GeneralLedger|Journal\w*)\b/';

    /**
     * @return list<string>
     */
    private function phpFiles(): array {
        $files    = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(\dirname(__DIR__, 4) . '/app/Services/Finances/Tax', RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->getExtension() === 'php') {
                $files[] = $file->getPathname();
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

    public function test_the_scan_finds_the_tax_engine_sources(): void {
        $names = array_map('basename', $this->phpFiles());

        $this->assertContains('TaxEngine.php', $names);
        $this->assertContains('TaxRuleResolver.php', $names);
        $this->assertContains('TaxRuleVersionService.php', $names);
    }

    public function test_tax_engine_does_not_reference_business_module_models(): void {
        $violations = [];
        foreach ($this->phpFiles() as $path) {
            if (preg_match(self::FORBIDDEN_MODULES, $this->codeOf($path), $match) === 1) {
                $violations[] = basename($path) . " -> App\\Models\\{$match[1]}";
            }
        }

        $this->assertSame([], $violations, 'Tax Engine tidak boleh mengimpor model Sales/Purchase/Inventory/Asset (P-9).');
    }

    public function test_tax_engine_does_not_know_accounts_or_ledgers(): void {
        $violations = [];
        foreach ($this->phpFiles() as $path) {
            if (preg_match(self::FORBIDDEN_ACCOUNTS, $this->codeOf($path), $match) === 1) {
                $violations[] = basename($path) . " -> {$match[0]}";
            }
        }

        $this->assertSame([], $violations, 'Tax Engine hanya mengeluarkan peran akun, bukan akun (Requirement 4.5).');
    }

    public function test_the_forbidden_patterns_detect_use_statements_and_fully_qualified_names(): void {
        $this->assertSame(1, preg_match(self::FORBIDDEN_MODULES, 'use App\\Models\\Sales\\SalesInvoice;'));
        $this->assertSame(1, preg_match(self::FORBIDDEN_MODULES, '$x = \\App\\Models\\Purchase\\PurchaseInvoice::class;'));
        $this->assertSame(0, preg_match(self::FORBIDDEN_MODULES, 'use App\\Models\\Finances\\Tax;'));

        $this->assertSame(1, preg_match(self::FORBIDDEN_ACCOUNTS, 'use App\\Models\\Finances\\Account;'));
        $this->assertSame(1, preg_match(self::FORBIDDEN_ACCOUNTS, 'use App\\Models\\Finances\\PostingProfile;'));
        $this->assertSame(0, preg_match(self::FORBIDDEN_ACCOUNTS, 'use App\\Models\\Finances\\Tax;'));
        $this->assertSame(0, preg_match(self::FORBIDDEN_ACCOUNTS, 'use App\\Models\\Finances\\TaxRuleVersion;'));
    }
}
