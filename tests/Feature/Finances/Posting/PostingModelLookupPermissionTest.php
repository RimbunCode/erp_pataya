<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileAccount;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 6.1 (catatan S3): endpoint lookup generik `ModelController` (`model`, `model.selectData`,
 * `model.datatable`) tidak memeriksa izin `select` model sasaran. Model baru Posting Profile dan Parity Log ikut
 * serta lewat `lookupRequiresSelectPermission()`; tanpa izin `select` lookup ditolak 403.
 */
class PostingModelLookupPermissionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class]);

        $account = $this->makeAccount('1231', 'Piutang Dagang', 'asset', 'debit', 'receivable');
        app(PostingProfileService::class)->createDraft('Profil Rahasia', '2026-01-01', null, [AccountRole::Receivable->value => $account->id]);
    }

    /**
     * @param  class-string  $model
     * @param  list<string>  $permissions
     */
    private function actingWith(string $model, array $permissions): static {
        return $this->withSession([
            'permissions' => [
                $model => [0 => [['model' => $model, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($permissions, true)]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])->actingAs($this->user);
    }

    /**
     * @return array<string, array{0: class-string}>
     */
    public static function guardedModels(): array {
        return [
            'posting profile' => [PostingProfile::class],
            'parity log'      => [PostingParityLog::class],
        ];
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('guardedModels')]
    public function test_select_data_requires_select_permission(string $model): void {
        $this->actingWith($model, ['read'])->postJson(route('model.selectData'), ['model' => $model])->assertForbidden();
        $this->actingWith($model, [])->postJson(route('model.selectData'), ['model' => $model])->assertForbidden();
        $this->actingWith($model, ['select'])->postJson(route('model.selectData'), ['model' => $model])->assertOk();
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('guardedModels')]
    public function test_select_data_does_not_accept_another_models_select_permission(string $model): void {
        $other = $model === PostingProfile::class ? PostingParityLog::class : PostingProfile::class;

        $this->actingWith($other, ['select'])->postJson(route('model.selectData'), ['model' => $model])->assertForbidden();
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('guardedModels')]
    public function test_dropdown_lookup_requires_select_permission(string $model): void {
        $this->actingWith($model, ['read'])->postJson(route('model'), ['model' => $model])->assertForbidden();
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('guardedModels')]
    public function test_datatable_lookup_requires_select_permission(string $model): void {
        $this->actingWith($model, ['read'])->postJson(route('model.datatable'), ['model' => $model, 'showedColumns' => []])->assertForbidden();
    }

    public function test_select_data_through_a_relation_of_a_guarded_parent_requires_select(): void {
        $this->actingWith(PostingProfile::class, ['read'])
            ->postJson(route('model.selectData'), ['model' => PostingProfile::class, 'select' => 'accounts'])
            ->assertForbidden();
    }

    public function test_select_data_with_permission_returns_the_profile(): void {
        $this->actingWith(PostingProfile::class, ['select'])
            ->postJson(route('model.selectData'), ['model' => PostingProfile::class])
            ->assertOk()
            ->assertJsonPath('data.data.0.name', 'Profil Rahasia');
    }

    /**
     * @return array<string, array{0: class-string}>
     */
    public static function childModels(): array {
        return [
            'profile account' => [PostingProfileAccount::class],
            'profile rule'    => [PostingProfileRule::class],
        ];
    }

    /**
     * @return list<array{0: string, 1: array<string, mixed>}>
     */
    private function lookupCalls(string $model): array {
        return [
            ['model.selectData', ['model' => $model]],
            ['model.selectData', ['model' => $model, 'with' => ['postingProfile']]],
            ['model', ['model' => $model, 'with' => ['postingProfile']]],
            ['model.datatable', ['model' => $model, 'showedColumns' => [], 'with' => ['postingProfile']]],
        ];
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('childModels')]
    public function test_child_models_require_select_on_posting_profile(string $model): void {
        foreach ($this->lookupCalls($model) as [$route, $payload]) {
            // Izin model anak sendiri, izin parity log, atau izin selain select tidak cukup.
            $this->actingWith($model, ['select', 'read'])->postJson(route($route), $payload)->assertForbidden();
            $this->actingWith(PostingParityLog::class, ['select'])->postJson(route($route), $payload)->assertForbidden();
            $this->actingWith(PostingProfile::class, ['read', 'write'])->postJson(route($route), $payload)->assertForbidden();
        }
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('childModels')]
    public function test_child_models_pass_the_guard_with_select_on_posting_profile(string $model): void {
        foreach ($this->lookupCalls($model) as [$route, $payload]) {
            // Guard lolos (bukan 403); model anak bukan model DataTable sehingga hasil akhirnya bukan 200.
            $this->assertNotSame(403, $this->actingWith(PostingProfile::class, ['select'])->postJson(route($route), $payload)->getStatusCode(), $route);
        }
    }
}
