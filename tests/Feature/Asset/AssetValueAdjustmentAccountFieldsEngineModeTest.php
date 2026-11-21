<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Http\Requests\Asset\AssetValueAdjustmentRequest;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Services\Asset\AssetValueAdjustmentService;
use App\Services\Finances\Posting\PostingExecutionResolver;
use App\Services\Finances\Posting\PostingExecutionRouter;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1/13.3, P-14) untuk Asset Value Adjustment: saat mode engine `on`, request
 * tidak lagi memvalidasi kolom akun selisih sehingga `validated()` membuangnya, controller menyuplai
 * `accountsManagedByEngine`, dan dokumen tanpa akun terposting lewat profil. Saat `off`/`shadow` jalur lama tetap
 * mewajibkan akun.
 */
class AssetValueAdjustmentAccountFieldsEngineModeTest extends TestCase {
    use AssertsPostingParity, BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, AssetValueAdjustment::class]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $extra = []): array {
        $asset = $this->makeAssetWithAccounts()['asset'];

        return [
            'asset'              => ['id' => $asset->id, 'name' => 'Laptop'],
            'date'               => '2026-11-10',
            'new_asset_value'    => 6000,
            'difference_account' => ['id' => $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain')->id, 'account_name' => 'Selisih'],
            ...$extra,
        ];
    }

    private function http(): static {
        return $this
            ->withSession([
                'permissions' => [
                    AssetValueAdjustment::class => [
                        0 => [[
                            'model'        => AssetValueAdjustment::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true, 'cancel' => true, 'submit' => true],
                        ]],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withoutVite()
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    #[Test]
    public function create_page_reports_whether_accounts_are_managed_by_the_engine(): void {
        foreach (['off' => false, 'shadow' => false, 'on' => true] as $mode => $managed) {
            $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, $mode);

            $this->http()->get('/assetValueAdjustments/create')->assertOk()->assertInertia(
                fn ($page) => $page->component('Asset/ValueAdjustments/Show')->where('accountsManagedByEngine', $managed),
            );
        }
    }

    #[Test]
    public function show_page_reports_whether_accounts_are_managed_by_the_engine(): void {
        $adjustment = AssetValueAdjustment::factory()->create(['asset_id' => $this->makeAssetWithAccounts()['asset']->id]);

        foreach (['off' => false, 'on' => true] as $mode => $managed) {
            $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, $mode);

            $this->http()->get('/assetValueAdjustments/' . $adjustment->id)->assertOk()->assertInertia(
                fn ($page) => $page->component('Asset/ValueAdjustments/Show')->where('accountsManagedByEngine', $managed),
            );
        }
    }

    #[Test]
    public function store_without_account_is_accepted_in_mode_on_and_rejected_otherwise(): void {
        $payload = $this->payload();
        unset($payload['difference_account']);

        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'off');
        $this->http()->post('/assetValueAdjustments', $payload)->assertSessionHasErrors('difference_account.id');
        $this->assertSame(0, AssetValueAdjustment::count());

        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');
        $this->http()->post('/assetValueAdjustments', $payload)->assertSessionHasNoErrors();
        $this->assertSame(1, AssetValueAdjustment::count());
        $this->assertNull(AssetValueAdjustment::first()->difference_account_id);
    }

    #[Test]
    public function store_in_mode_on_ignores_an_account_sent_by_the_client(): void {
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');

        $this->http()->post('/assetValueAdjustments', $this->payload())->assertSessionHasNoErrors();

        $this->assertNull(AssetValueAdjustment::firstOrFail()->difference_account_id);
    }

    #[Test]
    public function account_field_is_required_while_mode_is_not_on(): void {
        foreach (['off', 'shadow'] as $mode) {
            $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, $mode);
            $rules = (new AssetValueAdjustmentRequest)->rules();

            $this->assertArrayHasKey('difference_account.id', $rules, "Mode {$mode}: akun selisih harus divalidasi.");
            $this->assertContains('required', $rules['difference_account.id']);

            $payload = $this->payload();
            unset($payload['difference_account']);
            $this->assertTrue(Validator::make($payload, $rules)->errors()->has('difference_account.id'), "Mode {$mode}: tanpa akun harus ditolak.");

            $validated = Validator::make($this->payload(), $rules)->validated();
            $this->assertArrayHasKey('difference_account', $validated, "Mode {$mode}: akun selisih ikut tervalidasi.");
        }
    }

    #[Test]
    public function account_field_is_dropped_from_validated_data_when_mode_is_on(): void {
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');
        $rules = (new AssetValueAdjustmentRequest)->rules();

        $this->assertArrayNotHasKey('difference_account.id', $rules);
        $this->assertArrayNotHasKey('difference_account.*', $rules);
        $this->assertArrayHasKey('asset.id', $rules, 'Aturan lain tetap utuh.');
        $this->assertArrayHasKey('new_asset_value', $rules);

        // Klien yang masih mengirim akun (atau akun palsu) tidak lolos ke `validated()` (P-14).
        $validated = Validator::make($this->payload(), $rules)->validated();
        $this->assertArrayNotHasKey('difference_account', $validated);
        $this->assertArrayHasKey('asset', $validated);

        $withoutAccount = $this->payload();
        unset($withoutAccount['difference_account']);
        $this->assertFalse(Validator::make($withoutAccount, $rules)->fails(), 'Tanpa akun valid saat mode on.');
    }

    #[Test]
    public function only_asset_value_adjustment_mode_decides_the_request_rules(): void {
        $this->setPostingMode(PostingDocumentType::StockEntry, 'on');

        $this->assertArrayHasKey('difference_account.id', (new AssetValueAdjustmentRequest)->rules());
    }

    #[Test]
    public function service_creates_and_updates_a_document_without_account(): void {
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');
        $data = Validator::make($this->payload(), (new AssetValueAdjustmentRequest)->rules())->validated();

        $service    = app(AssetValueAdjustmentService::class);
        $adjustment = $service->create($data);

        $this->assertNull($adjustment->fresh()->difference_account_id);
        $this->assertNull($adjustment->fresh()->differenceAccount);

        $service->update($adjustment, [...$data, 'new_asset_value' => 7000]);
        $this->assertSame('7000.00', (string) $adjustment->fresh()->new_asset_value);
        $this->assertNull($adjustment->fresh()->difference_account_id);
    }

    #[Test]
    public function update_in_mode_on_keeps_the_account_recorded_before_cutover(): void {
        $difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $this->makeAssetWithAccounts()['asset']->id,
            'difference_account_id' => $difference->id,
        ]);

        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');
        $data = Validator::make($this->payload(), (new AssetValueAdjustmentRequest)->rules())->validated();
        app(AssetValueAdjustmentService::class)->update($adjustment, $data);

        $this->assertSame($difference->id, $adjustment->fresh()->difference_account_id, 'Requirement 13.6: kolom lama tidak diubah.');
    }

    #[Test]
    public function document_without_account_posts_through_the_profile_when_mode_is_on(): void {
        $setup      = $this->makeAssetWithAccounts(['gross_purchase_amount' => 5000]);
        $difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
        $this->activateParityProfile(['asset_revaluation' => $difference]);
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');

        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $setup['asset']->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 6000,
            'difference_account_id' => null,
        ]);
        GlPostingStatus::create(['referenceable_type' => AssetValueAdjustment::class, 'referenceable_id' => $adjustment->id, 'status' => FormStatus::PENDING]);

        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, CarbonImmutable::parse('2026-11-10 09:00:00')));

        $this->assertNull($adjustment->fresh()->difference_account_id);
        $this->assertEquals(['value_adjustment' => ['date' => '2026-11-10', 'lines' => [['1500', 1000.0, 0.0], ['7200', 0.0, 1000.0]]]], $this->journalSignature($adjustment->fresh()));
        $this->assertEquals(6000.0, (float) $setup['asset']->fresh()->gross_purchase_amount);
        $this->assertSame(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $adjustment->id)->first()->status);
    }

    #[Test]
    public function on_approved_rolls_back_the_document_and_surfaces_the_error_when_the_role_is_unresolved(): void {
        $setup = $this->makeAssetWithAccounts(['gross_purchase_amount' => 5000]);
        // Profil aktif tanpa peran `asset_revaluation`: resolusi akun gagal saat mode `on`.
        $this->activateParityProfile([]);
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'on');
        // Tes berjalan di dalam transaksi `RefreshDatabase`; kedalaman itu dianggap "di luar transaksi dokumen" seperti
        // produksi (kedalaman 0), sehingga hanya transaksi `onApproved` yang membuat kegagalan dilempar ulang.
        $this->app->instance(PostingExecutionRouter::class, new PostingExecutionRouter(app(PostingExecutionResolver::class), DB::transactionLevel()));

        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $setup['asset']->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 6000,
            'difference_account_id' => null,
            'status'                => [FormStatus::NEED_APPROVAL],
        ]);

        try {
            app(AssetValueAdjustmentService::class)->onApproved($adjustment);
            $this->fail('Kegagalan posting inline harus sampai ke pengguna (Requirement 9.3 dan 13.7).');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertNotSame('', $e->role);
        }

        $statuses = array_map(fn (FormStatus $s) => $s->value, $adjustment->fresh()->status);
        $this->assertNotContains(FormStatus::SUBMITTED->value, $statuses, 'Status dokumen digulung.');
        $this->assertContains(FormStatus::NEED_APPROVAL->value, $statuses);
        $this->assertSame(0, GlPostingStatus::where('referenceable_id', $adjustment->id)->count(), 'GlPostingStatus ikut digulung.');
        $this->assertDatabaseCount('general_ledgers', 0);
        $this->assertEquals(5000.0, (float) $setup['asset']->fresh()->gross_purchase_amount);
    }

    #[Test]
    public function legacy_path_fails_with_a_clear_message_for_a_document_without_account(): void {
        $setup = $this->makeAssetWithAccounts(['gross_purchase_amount' => 5000]);
        $this->setPostingMode(PostingDocumentType::AssetValueAdjustment, 'off');

        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $setup['asset']->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 6000,
            'difference_account_id' => null,
        ]);
        GlPostingStatus::create(['referenceable_type' => AssetValueAdjustment::class, 'referenceable_id' => $adjustment->id, 'status' => FormStatus::PENDING]);

        try {
            (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, now()));
            $this->fail('Jalur lama harus menolak dokumen tanpa akun selisih.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('akun selisih', $e->getMessage());
        }

        $this->assertDatabaseCount('general_ledgers', 0);
        $this->assertEquals(5000.0, (float) $setup['asset']->fresh()->gross_purchase_amount);
    }
}
