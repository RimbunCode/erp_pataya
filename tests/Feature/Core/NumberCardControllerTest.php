<?php

namespace Tests\Feature\Core;

use App\Enums\Permission;
use App\Models\Core\NumberCard;
use App\Models\Model as AppModel;
use App\Models\User\Permission as PermissionModel;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NumberCardTargetRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'number_card_target_records';
    protected $guarded = ['id'];
}

class NumberCardControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('number_card_target_records')) {
            Schema::create('number_card_target_records', function ($t) {
                $t->ulid('id')->primary();
                $t->decimal('amount', 15, 2)->default(0);
                $t->timestamps();
            });
        }

        $this->user = User::factory()->create();
    }

    /** Full CRUD ke NumberCard sendiri, plus (opsional) Select ke target model. */
    private function actingWith(array $targetPermissions = []): static {
        $permissions = [
            NumberCard::class => [0 => [[
                'model'       => NumberCard::class, 'level' => 0, 'only_creator' => false,
                'permissions' => ['select' => true, 'create' => true, 'write' => true, 'delete' => true, 'read' => true],
            ]]],
        ];
        foreach ($targetPermissions as $class) {
            $permissions[$class] = [0 => [[
                'model'       => $class, 'level' => 0, 'only_creator' => false,
                'permissions' => ['select' => true, 'read' => true],
            ]]];
        }

        return $this
            ->withSession(['permissions' => $permissions, 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->withHeader('X-Inertia', 'true')
            ->actingAs($this->user);
    }

    public function test_store_and_show_happy_path(): void {
        $permission = PermissionModel::create(['model' => NumberCardTargetRecord::class, 'module' => 'Core', 'name' => 'Number Card Target Record']);

        $response = $this->actingWith([NumberCardTargetRecord::class])->post(route('numberCards.store'), [
            'label' => 'Total Records', 'source_type' => 'document_type', 'function' => 'count',
            'model' => ['id' => $permission->id, 'model' => NumberCardTargetRecord::class],
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('number_cards', ['label' => 'Total Records', 'model_class' => NumberCardTargetRecord::class]);
    }

    /**
     * Feedback user: "Compare Against" (stats_time_interval) membingungkan
     * kalau dibiarkan opsional saat "Show Percentage Stats" aktif — backend
     * punya default implisit (match's `default` arm di
     * NumberCardService::resolveAsOfDate() jatuh ke "daily"), tapi itu tidak
     * jelas bagi user yang mengisi form. Sekarang wajib diisi eksplisit.
     */
    public function test_store_rejects_missing_stats_time_interval_when_percentage_stats_enabled(): void {
        $permission = PermissionModel::create(['model' => NumberCardTargetRecord::class, 'module' => 'Core', 'name' => 'Number Card Target Record']);

        $response = $this->actingWith([NumberCardTargetRecord::class])->post(route('numberCards.store'), [
            'label'                 => 'Total Records', 'source_type' => 'document_type', 'function' => 'count',
            'model'                 => ['id' => $permission->id, 'model' => NumberCardTargetRecord::class],
            'show_percentage_stats' => true,
        ]);

        // Accept: application/json (set di actingWith()) -> Laravel balikin
        // 422 JSON body, bukan redirect+session flash.
        $response->assertJsonValidationErrors(['stats_time_interval']);
        $this->assertDatabaseMissing('number_cards', ['label' => 'Total Records']);
    }

    public function test_store_accepts_stats_time_interval_when_percentage_stats_enabled(): void {
        $permission = PermissionModel::create(['model' => NumberCardTargetRecord::class, 'module' => 'Core', 'name' => 'Number Card Target Record']);

        $response = $this->actingWith([NumberCardTargetRecord::class])->post(route('numberCards.store'), [
            'label'                 => 'Total Records', 'source_type' => 'document_type', 'function' => 'count',
            'model'                 => ['id' => $permission->id, 'model' => NumberCardTargetRecord::class],
            'show_percentage_stats' => true,
            'stats_time_interval'   => 'weekly',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('number_cards', ['label' => 'Total Records', 'stats_time_interval' => 'weekly']);
    }

    /**
     * Requirement 8.1/8.2 — level query (bukan lewat halaman Inertia index(),
     * yang butuh Vite manifest belum ada sampai Task 7/8 frontend selesai;
     * verifikasi end-to-end lewat browser tetap dilakukan di Task 11).
     * Mereplikasi persis logika `NumberCardController::scopeVisible()`.
     */
    public function test_visible_when_has_target_permission_without_share(): void {
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTargetRecord::class]);

        $checker = new PermissionChecker([
            NumberCardTargetRecord::class => [0 => [['model' => NumberCardTargetRecord::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true]]]],
        ]);
        $permitted = NumberCard::query()->whereNotNull('model_class')->distinct()->pluck('model_class')
            ->filter(fn ($c) => $checker->can($c, Permission::Select))->all();

        $visible = NumberCard::query()
            ->where(fn ($q) => $q->whereIn('model_class', $permitted))
            ->orWhere(fn ($q) => $q->visibleByShare($this->user, []))
            ->pluck('id');

        $this->assertTrue($visible->contains($card->id));
    }

    /** Requirement 8.2 — TANPA permission target tapi is_shared_all -> tetap terlihat. */
    public function test_visible_when_shared_all_without_target_permission(): void {
        $card = NumberCard::create(['label' => 'Shared', 'model_class' => NumberCardTargetRecord::class, 'is_shared_all' => true]);

        $checker   = new PermissionChecker([]); // TANPA permission apapun
        $permitted = NumberCard::query()->whereNotNull('model_class')->distinct()->pluck('model_class')
            ->filter(fn ($c) => $checker->can($c, Permission::Select))->all();

        $visible = NumberCard::query()
            ->where(fn ($q) => $q->whereIn('model_class', $permitted))
            ->orWhere(fn ($q) => $q->visibleByShare($this->user, []))
            ->pluck('id');

        $this->assertTrue($visible->contains($card->id));
    }

    /**
     * Requirement 8.4: endpoint value WAJIB re-cek gate per request — card
     * yang tidak visible (tanpa permission target & tanpa share) ditolak 403,
     * bukan cuma diam-diam disaring di listing.
     */
    public function test_get_value_rejected_when_not_visible(): void {
        $card = NumberCard::create(['label' => 'Private', 'model_class' => NumberCardTargetRecord::class, 'function' => 'count']);

        $response = $this->actingWith([])->post(route('numberCards.getValue', $card));

        $response->assertStatus(403);
    }

    public function test_get_value_allowed_when_visible(): void {
        NumberCardTargetRecord::create(['amount' => 10]);
        NumberCardTargetRecord::create(['amount' => 20]);
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTargetRecord::class, 'function' => 'count']);

        $response = $this->actingWith([NumberCardTargetRecord::class])->post(route('numberCards.getValue', $card));

        $response->assertOk();
        $this->assertEquals(2.0, $response->json('value'));
    }

    /**
     * Gate DASAR (bukan Requirement 8) — permission Select ke entity
     * NumberCard itu sendiri, via mekanisme standar Controller::guard()
     * (bukan mekanisme khusus quickList). Mirror `WidgetPermissionTest`
     * lama yang dihapus krn Widget/get-chart sudah tidak ada.
     */
    public function test_get_value_blocked_without_select_permission_on_number_card_entity(): void {
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTargetRecord::class, 'function' => 'count', 'is_shared_all' => true]);

        $response = $this
            ->withSession(['permissions' => [], 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user)
            ->post(route('numberCards.getValue', $card));

        $response->assertForbidden();
    }

    /** Requirement 1.4: model_class sudah tidak exists -> empty state, bukan 500. */
    public function test_get_value_handles_missing_model_class_gracefully(): void {
        $card = NumberCard::create([
            'label'    => 'Ghost', 'model_class' => 'App\\Models\\NonExistentClass',
            'function' => 'count', 'is_shared_all' => true,
        ]);

        $response = $this->actingWith([])->post(route('numberCards.getValue', $card));

        $response->assertOk();
        $this->assertEquals(0.0, $response->json('value'));
    }
}
