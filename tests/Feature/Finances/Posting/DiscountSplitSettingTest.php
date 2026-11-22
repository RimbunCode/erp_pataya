<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Events\Core\ModuleSettingUpdated;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingProfile;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\DiscountSplit\DiscountSplitResolver;
use App\Services\Finances\Posting\PostingProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.1 (Requirement 14.1, 14.4): setting `finance_discount_split_from.{type}` default kosong dan
 * hanya boleh diisi bila peran `discount` sudah terpetakan pada profil aktif (akun default, atau aturan akun bersyarat
 * tanpa kondisi barang untuk jenis dokumen itu). Fallback legacy tidak dihitung; mengosongkan selalu boleh; audit
 * pengaturan modul tercatat.
 */
class DiscountSplitSettingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $discount;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);

        $this->receivable = $this->makeAccount('1200', 'Piutang', 'asset');
        $this->revenue    = $this->makeAccount('4000', 'Penjualan', 'income', 'credit');
        $this->discount   = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
    }

    /**
     * @param  array<string, string>  $accounts
     * @param  list<array<string, mixed>>  $rules
     */
    private function activateProfile(string $name, string $from, ?string $to, array $accounts, array $rules = []): PostingProfile {
        $profiles = app(PostingProfileService::class);

        return $profiles->activate($profiles->createDraft($name, $from, $to, $accounts, $rules));
    }

    /**
     * @return array<string, string>
     */
    private function baseAccounts(): array {
        return ['receivable' => $this->receivable->id, 'revenue' => $this->revenue->id];
    }

    private function save(PostingDocumentType $type, ?string $date): FinanceSetting {
        /** @var FinanceSetting $setting */
        $setting = app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[$type->value] => $date]);

        return $setting;
    }

    private function assertRejected(PostingDocumentType $type, string $date, string $messageFragment): void {
        $column = FinanceSetting::DISCOUNT_SPLIT_COLUMNS[$type->value];

        try {
            $this->save($type, $date);
            $this->fail('ValidationException diharapkan.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey($column, $e->errors());
            $this->assertStringContainsString($messageFragment, $e->errors()[$column][0]);
        }

        $this->assertNull(FinanceSetting::query()->first()?->{$column}, 'penyimpanan ditolak, nilai tidak berubah');
    }

    public function test_default_is_empty_for_both_document_types(): void {
        $setting = FinanceSetting::current();

        $this->assertNull($setting->discountSplitFrom(PostingDocumentType::SalesInvoice));
        $this->assertNull($setting->discountSplitFrom(PostingDocumentType::PurchaseInvoice));
        $this->assertNull($setting->discountSplitFrom(PostingDocumentType::PaymentEntry), 'jenis dokumen lain tidak mengenal posting diskon');
    }

    public function test_cutover_is_rejected_without_an_active_profile(): void {
        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-12-01', 'no active Posting Profile');
    }

    public function test_cutover_is_rejected_when_the_active_profile_does_not_map_discount(): void {
        $this->activateProfile('Tanpa diskon', '2020-01-01', null, $this->baseAccounts());

        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-12-01', 'discount');
        $this->assertRejected(PostingDocumentType::PurchaseInvoice, '2026-12-01', 'Tanpa diskon');
    }

    public function test_cutover_is_accepted_when_discount_is_mapped_as_a_profile_default(): void {
        $this->activateProfile('Dengan diskon', '2020-01-01', null, [...$this->baseAccounts(), 'discount' => $this->discount->id]);

        $setting = $this->save(PostingDocumentType::SalesInvoice, '2026-12-01');

        $this->assertSame('2026-12-01', $setting->discountSplitFrom(PostingDocumentType::SalesInvoice));
        $this->assertNull($setting->discountSplitFrom(PostingDocumentType::PurchaseInvoice), 'jenis lain tidak ikut berubah');

        $this->save(PostingDocumentType::PurchaseInvoice, '2026-12-15');
        $this->assertSame('2026-12-01', FinanceSetting::query()->first()->discountSplitFrom(PostingDocumentType::SalesInvoice));
        $this->assertSame('2026-12-15', FinanceSetting::query()->first()->discountSplitFrom(PostingDocumentType::PurchaseInvoice));
    }

    public function test_cutover_is_accepted_when_discount_is_mapped_by_a_document_type_rule(): void {
        $this->activateProfile('Aturan diskon', '2020-01-01', null, $this->baseAccounts(), [
            ['role' => 'discount', 'account_id' => $this->discount->id, 'document_type' => 'purchase_invoice'],
        ]);

        $this->save(PostingDocumentType::PurchaseInvoice, '2026-12-01');
        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-12-01', 'discount');
    }

    public function test_a_rule_without_document_type_counts_for_both_types(): void {
        $this->activateProfile('Aturan umum', '2020-01-01', null, $this->baseAccounts(), [
            ['role' => 'discount', 'account_id' => $this->discount->id],
        ]);

        $this->save(PostingDocumentType::SalesInvoice, '2026-12-01');
        $this->save(PostingDocumentType::PurchaseInvoice, '2026-12-01');

        $this->assertSame('2026-12-01', FinanceSetting::query()->first()->discountSplitFrom(PostingDocumentType::PurchaseInvoice));
    }

    public function test_a_return_only_rule_does_not_count_as_mapped(): void {
        $this->activateProfile('Hanya retur', '2020-01-01', null, $this->baseAccounts(), [
            ['role' => 'discount', 'account_id' => $this->discount->id, 'variant' => 'return'],
        ]);

        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-12-01', 'discount');
    }

    public function test_legacy_account_fallback_does_not_count_as_mapped(): void {
        config(['finance.posting.legacy_account_fallback' => true]);
        $this->makeAccount('4950', 'Diskon legacy', 'income', 'debit', 'discount');
        $this->activateProfile('Tanpa diskon', '2020-01-01', null, $this->baseAccounts());

        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-12-01', 'discount');
    }

    public function test_a_later_profile_without_discount_blocks_the_cutover(): void {
        $this->activateProfile('Profil A', '2020-01-01', '2026-12-31', [...$this->baseAccounts(), 'discount' => $this->discount->id]);
        $this->activateProfile('Profil B', '2027-01-01', null, $this->baseAccounts());

        // Profil B berlaku sesudah cutover dan belum memetakan diskon.
        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-11-01', 'Profil B');
        // Cutover di dalam profil B sendiri.
        $this->assertRejected(PostingDocumentType::SalesInvoice, '2027-02-01', 'Profil B');
    }

    public function test_a_cutover_before_any_profile_starts_is_rejected(): void {
        $this->activateProfile('Mulai 2026', '2026-06-01', null, [...$this->baseAccounts(), 'discount' => $this->discount->id]);

        $this->assertRejected(PostingDocumentType::SalesInvoice, '2026-01-01', 'no active Posting Profile');
    }

    public function test_clearing_is_always_allowed_and_resaving_an_unchanged_date_is_not_revalidated(): void {
        // Nilai sudah ada (mis. profil dipensiunkan sesudahnya): mengosongkan tidak divalidasi.
        FinanceSetting::current();
        DB::table('finance_settings')->update(['discount_split_from_sales_invoice' => '2026-12-01']);

        $unchanged = app(SettingsService::class)->update(FinanceSetting::class, [
            'discount_split_from_sales_invoice' => '2026-12-01',
            'enforce_fiscal_period'             => true,
        ]);
        $this->assertSame('2026-12-01', $unchanged->discountSplitFrom(PostingDocumentType::SalesInvoice));
        $this->assertTrue($unchanged->enforce_fiscal_period);

        $cleared = $this->save(PostingDocumentType::SalesInvoice, null);
        $this->assertNull($cleared->discountSplitFrom(PostingDocumentType::SalesInvoice));
    }

    public function test_invalid_date_format_is_rejected(): void {
        $this->activateProfile('Dengan diskon', '2020-01-01', null, [...$this->baseAccounts(), 'discount' => $this->discount->id]);

        $this->expectException(ValidationException::class);
        app(SettingsService::class)->update(FinanceSetting::class, ['discount_split_from_sales_invoice' => '01/12/2026']);
    }

    public function test_saving_is_audited_through_the_module_setting_event(): void {
        $this->activateProfile('Dengan diskon', '2020-01-01', null, [...$this->baseAccounts(), 'discount' => $this->discount->id]);
        Event::fake([ModuleSettingUpdated::class]);

        $this->save(PostingDocumentType::SalesInvoice, '2026-12-01');

        Event::assertDispatched(ModuleSettingUpdated::class, fn (ModuleSettingUpdated $event): bool => $event->setting instanceof FinanceSetting
            && ($event->attributes['discount_split_from_sales_invoice'] ?? null) === '2026-12-01');
    }

    public function test_resolver_compares_the_business_day_of_the_transaction_with_the_cutover(): void {
        $resolver = app(DiscountSplitResolver::class);
        $type     = PostingDocumentType::SalesInvoice;

        $this->assertFalse($resolver->isActive($type, CarbonImmutable::parse('2026-12-01 10:00:00')), 'setting kosong = nonaktif');

        FinanceSetting::current();
        DB::table('finance_settings')->update(['discount_split_from_sales_invoice' => '2026-12-01']);

        $this->assertFalse($resolver->isActive($type, CarbonImmutable::parse('2026-11-30 10:00:00')));
        $this->assertTrue($resolver->isActive($type, CarbonImmutable::parse('2026-12-01 10:00:00')));
        $this->assertTrue($resolver->isActive($type, CarbonImmutable::parse('2026-12-02 10:00:00')));
        $this->assertFalse($resolver->isActive(PostingDocumentType::PurchaseInvoice, CarbonImmutable::parse('2026-12-02 10:00:00')), 'jenis lain tidak terpengaruh');
        $this->assertFalse($resolver->isActive(PostingDocumentType::PaymentEntry, CarbonImmutable::parse('2026-12-02 10:00:00')));
    }

    public function test_resolver_uses_the_company_timezone_for_the_business_day(): void {
        FinanceSetting::current();
        DB::table('finance_settings')->update(['discount_split_from_sales_invoice' => '2026-12-01']);

        // 17:30 UTC tanggal 30 November = 00:30 WIB tanggal 1 Desember (zona perusahaan default Asia/Jakarta).
        $this->assertTrue(app(DiscountSplitResolver::class)->isActive(PostingDocumentType::SalesInvoice, CarbonImmutable::parse('2026-11-30 17:30:00', 'UTC')));
        $this->assertFalse(app(DiscountSplitResolver::class)->isActive(PostingDocumentType::SalesInvoice, CarbonImmutable::parse('2026-11-30 16:30:00', 'UTC')));
    }
}
