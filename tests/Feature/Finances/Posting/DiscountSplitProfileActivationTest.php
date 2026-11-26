<?php

namespace Tests\Feature\Finances\Posting;

use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.4 (Requirement 14.4; keputusan pemilik produk 22 November 2026): aktivasi versi Posting
 * Profile ditolak bila profil itu menjangkau tanggal cutover diskon terpisah yang sudah terisi tetapi tidak
 * memetakan peran `discount` untuk jenis dokumen itu. Purchase Invoice wajib memakai aturan akun bersyarat
 * `document_type = purchase_invoice`; akun default profil dan aturan tanpa jenis dokumen tidak dihitung.
 */
class DiscountSplitProfileActivationTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private PostingProfileService $service;
    private Account $receivable;
    private Account $revenue;
    private Account $discountSales;
    private Account $discountPurchase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);
        $this->withoutVite();

        $this->service          = app(PostingProfileService::class);
        $this->receivable       = $this->makeAccount('1200', 'Piutang', 'asset');
        $this->revenue          = $this->makeAccount('4000', 'Penjualan', 'income', 'credit');
        $this->discountSales    = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
        $this->discountPurchase = $this->makeAccount('5900', 'Potongan Pembelian', 'expense', 'credit');
    }

    /**
     * @return array<string, string>
     */
    private function accounts(bool $withDiscount): array {
        return [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->revenue->id,
            ...($withDiscount ? ['discount' => $this->discountSales->id] : []),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function purchaseRule(): array {
        return [['role' => 'discount', 'account_id' => $this->discountPurchase->id, 'document_type' => 'purchase_invoice']];
    }

    private function setCutover(string $column, ?string $date): void {
        FinanceSetting::current();
        DB::table('finance_settings')->update([$column => $date]);
    }

    private function assertRejected(PostingProfile $draft, string $fragment): void {
        try {
            $this->service->activate($draft);
            $this->fail('InvalidPostingProfileException diharapkan.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertStringContainsString($fragment, $e->getMessage());
        }

        $this->assertTrue($draft->fresh()->isDraft(), 'aktivasi ditolak: profil tetap draft');
    }

    public function test_activation_is_rejected_when_the_new_version_drops_discount_while_the_sales_cutover_is_set(): void {
        $active = $this->service->activate($this->service->createDraft('Profil A', '2020-01-01', null, $this->accounts(true)));
        $this->setCutover('discount_split_from_sales_invoice', '2026-12-01');

        $version = $this->service->createNewVersion($active, '2026-06-01', null, 'Profil B');
        $this->service->updateDraft($version, [], $this->accounts(false), []);

        $this->assertRejected($version, 'cutover');
        $this->assertNull($active->fresh()->effective_to, 'profil lama tidak ditutup oleh aktivasi yang ditolak');
        $this->assertTrue($active->fresh()->isActive());
    }

    public function test_activation_is_accepted_when_the_cutover_is_empty(): void {
        $this->service->activate($this->service->createDraft('Tanpa diskon', '2020-01-01', null, $this->accounts(false)));

        $this->assertTrue(PostingProfile::query()->where('name', 'Tanpa diskon')->firstOrFail()->isActive());
    }

    public function test_a_superseding_version_that_keeps_discount_is_accepted_and_closes_the_previous_profile(): void {
        $active = $this->service->activate($this->service->createDraft('Profil A', '2020-01-01', null, $this->accounts(true)));
        $this->setCutover('discount_split_from_sales_invoice', '2026-12-01');

        $version = $this->service->activate($this->service->createNewVersion($active, '2026-06-01', null, 'Profil B'));

        $this->assertTrue($version->isActive());
        $this->assertSame('2026-05-31', $active->fresh()->effective_to->toDateString());
    }

    public function test_a_profile_that_ends_before_the_cutover_may_omit_discount_but_one_reaching_it_may_not(): void {
        $this->service->activate($this->service->createDraft('Lama', '2020-01-01', '2025-12-31', $this->accounts(false)));
        $this->setCutover('discount_split_from_sales_invoice', '2026-12-01');

        // Berakhir sehari sebelum cutover: tidak menjangkau cutover.
        $before = $this->service->activate($this->service->createDraft('Sebelum cutover', '2026-01-01', '2026-11-30', $this->accounts(false)));
        $this->assertTrue($before->isActive());

        // Berakhir tepat pada tanggal cutover: menjangkau.
        $this->assertRejected($this->service->createDraft('Mencakup cutover', '2026-12-01', '2026-12-31', $this->accounts(false)), 'discount');
        // Tanpa tanggal berakhir: menjangkau seterusnya.
        $this->assertRejected($this->service->createDraft('Terbuka', '2026-12-01', null, $this->accounts(false)), 'discount');
    }

    public function test_the_purchase_cutover_requires_a_purchase_invoice_rule_on_the_new_version(): void {
        $active = $this->service->activate($this->service->createDraft('Profil A', '2020-01-01', null, $this->accounts(true), $this->purchaseRule()));
        $this->setCutover('discount_split_from_purchase_invoice', '2026-12-01');

        // Versi baru hanya punya akun default `discount` (dipakai bersama Sales Invoice): tidak dihitung untuk Purchase Invoice.
        $withoutRule = $this->service->createNewVersion($active, '2026-06-01', null, 'Tanpa aturan PI');
        $this->service->updateDraft($withoutRule, [], $this->accounts(true), []);
        $this->assertRejected($withoutRule, 'Purchase Invoice document type');

        // Aturan tanpa jenis dokumen juga tidak dihitung.
        $this->service->updateDraft($withoutRule, [], $this->accounts(true), [['role' => 'discount', 'account_id' => $this->discountPurchase->id]]);
        $this->assertRejected($withoutRule, 'Purchase Invoice document type');

        // Aturan dengan jenis dokumen Purchase Invoice: diterima.
        $this->service->updateDraft($withoutRule, [], $this->accounts(true), $this->purchaseRule());
        $this->assertTrue($this->service->activate($withoutRule->fresh())->isActive());
    }

    public function test_the_sales_cutover_does_not_require_a_purchase_rule(): void {
        $active = $this->service->activate($this->service->createDraft('Profil A', '2020-01-01', null, $this->accounts(true)));
        $this->setCutover('discount_split_from_sales_invoice', '2026-12-01');

        $this->assertTrue($this->service->activate($this->service->createNewVersion($active, '2026-06-01', null, 'Profil B'))->isActive());
    }

    public function test_the_activate_endpoint_surfaces_the_rejection_as_a_profile_error(): void {
        $active = $this->service->activate($this->service->createDraft('Profil A', '2020-01-01', null, $this->accounts(true)));
        $this->setCutover('discount_split_from_sales_invoice', '2026-12-01');
        $version = $this->service->createNewVersion($active, '2026-06-01', null, 'Profil B');
        $this->service->updateDraft($version, [], $this->accounts(false), []);

        $this->withSession([
            'permissions' => [
                PostingProfile::class => [0 => [['model' => PostingProfile::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'read' => true, 'activate' => true]]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user)
            ->put(route('postingProfiles.activate', $version))
            ->assertSessionHasErrors('profile');

        $this->assertTrue($version->fresh()->isDraft());
        $this->assertStringContainsString('cutover', session('errors')->get('profile')[0]);
    }
}
