<?php

namespace Tests\Feature\Core\Notification;

use App\Models\Asset\AssetService;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use App\Services\Core\Mention\MentionAudienceResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\GrantsDocumentAccess;
use Tests\TestCase;

class MentionAudienceTest extends TestCase {
    use GrantsDocumentAccess;
    use RefreshDatabase;

    private User $actor;

    protected function setUp(): void {
        parent::setUp();

        $this->prepareDocumentPermission();
        $this->actor = User::factory()->create(['name' => 'Aktor Utama']);
    }

    private function asActor(): static {
        return $this
            ->withSession($this->actorSession())
            ->withCookie('lang', 'en')
            ->actingAs($this->actor);
    }

    /**
     * Meniru panggilan axios dari Comments.jsx (XHR + JSON). Sengaja bukan getJson():
     * helper itu mengirim cookie `lang` tanpa dienkripsi sehingga LanguageMiddleware
     * mengalihkan ke /lang.
     *
     * @param  array<string, mixed>  $query
     */
    private function getAutocomplete(array $query): TestResponse {
        return $this->asActor()->get(route('users.index', $query), [
            'Accept'           => 'application/json',
            'X-Requested-With' => 'XMLHttpRequest',
        ]);
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<int, string>
     */
    private function candidateIds(array $query): array {
        $response = $this->getAutocomplete($query)->assertOk();

        return collect($response->json())->pluck('id')->sort()->values()->all();
    }

    public function test_resolver_filters_candidates_with_single_bulk_query(): void {
        $reader     = User::factory()->create();
        $ownerOnly  = User::factory()->create();
        $noAccess   = User::factory()->create();
        $wrongLevel = User::factory()->create();
        $this->grantDocumentAccess($reader);
        $this->grantDocumentAccess($ownerOnly, onlyCreator: true);
        $this->grantDocumentAccess($wrongLevel, level: 1);

        $candidates = [$reader->id, $ownerOnly->id, $noAccess->id, $wrongLevel->id];

        DB::enableQueryLog();
        $allowed = app(MentionAudienceResolver::class)->readableBy(AssetService::class, null, $candidates);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([$reader->id], $allowed);
        $this->assertCount(1, $queries);

        $this->assertEqualsCanonicalizing(
            [$reader->id, $ownerOnly->id],
            app(MentionAudienceResolver::class)->readableBy(
                AssetService::class,
                $this->makeDocument($ownerOnly->id),
                $candidates,
            ),
        );
    }

    public function test_resolve_model_class_rejects_unsafe_input(): void {
        $resolver = app(MentionAudienceResolver::class);

        $this->assertSame(AssetService::class, $resolver->resolveModelClass(AssetService::class));
        $this->assertNull($resolver->resolveModelClass(null));
        $this->assertNull($resolver->resolveModelClass(''));
        $this->assertNull($resolver->resolveModelClass('Not\\A\\Real\\Class'));
        // Class nyata tapi bukan model Eloquent.
        $this->assertNull($resolver->resolveModelClass(\stdClass::class));
        // Model Eloquent nyata tapi tidak terdaftar di tabel permissions.
        $this->assertNull($resolver->resolveModelClass(User::class));
    }

    public function test_users_index_without_document_context_is_unchanged(): void {
        $reader   = User::factory()->create();
        $noAccess = User::factory()->create();
        $this->grantDocumentAccess($reader);

        $ids = $this->candidateIds([]);

        $this->assertContains($reader->id, $ids);
        $this->assertContains($noAccess->id, $ids);
        $this->assertContains($this->actor->id, $ids);
    }

    public function test_users_index_restricts_candidates_to_document_readers(): void {
        $reader   = User::factory()->create(['name' => 'Pembaca Satu']);
        $noAccess = User::factory()->create(['name' => 'Pembaca Dua']);
        $this->grantDocumentAccess($reader);
        $order = $this->makeDocument();

        $ids = $this->candidateIds([
            'search'         => 'Pembaca',
            'document_model' => AssetService::class,
            'document_id'    => $order->id,
        ]);

        $this->assertSame([$reader->id], $ids);
        $this->assertNotContains($noAccess->id, $ids);
    }

    public function test_users_index_only_creator_candidate_appears_only_for_own_document(): void {
        $ownerOnly = User::factory()->create(['name' => 'Pemilik Saja']);
        $this->grantDocumentAccess($ownerOnly, onlyCreator: true);

        $othersOrder = $this->makeDocument();
        $ownOrder    = $this->makeDocument($ownerOnly->id);

        $this->assertSame([], $this->candidateIds([
            'search'         => 'Pemilik Saja',
            'document_model' => AssetService::class,
            'document_id'    => $othersOrder->id,
        ]));
        $this->assertSame([$ownerOnly->id], $this->candidateIds([
            'search'         => 'Pemilik Saja',
            'document_model' => AssetService::class,
            'document_id'    => $ownOrder->id,
        ]));
    }

    /**
     * Model ber-HasBranch (Warehouse) tidak boleh membocorkan dokumen cabang lain:
     * notifikasi mention memuat code/name dokumen, jadi kandidat yang tidak
     * terafiliasi ke cabang dokumen harus tersaring sebelum dikirimi apa pun.
     * Dicek langsung di resolver karena helper GrantsDocumentAccess memakai
     * AssetService yang tidak ber-HasBranch.
     */
    public function test_resolver_filters_branch_scoped_candidates_by_document_branch(): void {
        $documentBranch = $this->makeBranch();
        $otherBranch    = $this->makeBranch();
        $mainBranch     = $this->makeBranch(isMain: true);

        $sameBranchUser  = $this->userInBranch($documentBranch);
        $otherBranchUser = $this->userInBranch($otherBranch);
        $mainBranchUser  = $this->userInBranch($mainBranch);
        $branchlessUser  = User::factory()->create();

        // Keempatnya diberi read pada Warehouse, supaya yang membedakan hasil
        // hanya afiliasi cabang, bukan ketiadaan permission.
        foreach ([$sameBranchUser, $otherBranchUser, $mainBranchUser, $branchlessUser] as $candidate) {
            $this->grantWarehouseAccess($candidate);
        }

        $warehouse = $this->makeWarehouse($documentBranch, 'WH-BRANCH-1');

        $candidates = [
            (string) $sameBranchUser->id,
            (string) $otherBranchUser->id,
            (string) $mainBranchUser->id,
            (string) $branchlessUser->id,
        ];

        $allowed = app(MentionAudienceResolver::class)
            ->readableBy(Warehouse::class, $warehouse, $candidates);

        $this->assertContains((string) $sameBranchUser->id, $allowed);
        $this->assertContains((string) $mainBranchUser->id, $allowed);
        $this->assertNotContains((string) $otherBranchUser->id, $allowed);
        $this->assertNotContains((string) $branchlessUser->id, $allowed);
    }

    /**
     * Cabang yang sudah di-soft-delete tidak boleh membebaskan kandidat: query
     * pivot memakai query builder mentah yang melewati global scope SoftDeletes.
     */
    public function test_resolver_ignores_soft_deleted_main_branch(): void {
        $documentBranch  = $this->makeBranch();
        $deletedMain     = $this->makeBranch(isMain: true, deleted: true);
        $deletedMainUser = $this->userInBranch($deletedMain);
        $this->grantWarehouseAccess($deletedMainUser);

        $warehouse = $this->makeWarehouse($documentBranch, 'WH-BRANCH-2');

        $allowed = app(MentionAudienceResolver::class)
            ->readableBy(Warehouse::class, $warehouse, [(string) $deletedMainUser->id]);

        $this->assertSame([], $allowed);
    }

    /**
     * Model tanpa HasBranch (AssetService) tidak boleh ikut tersaring filter cabang:
     * tidak ada kolom cabang untuk dibandingkan, jadi kandidat dari cabang mana pun
     * tetap lolos selama permission read-nya ada.
     */
    public function test_resolver_skips_branch_filter_for_model_without_has_branch(): void {
        $user = $this->userInBranch($this->makeBranch());
        $this->grantDocumentAccess($user);

        $allowed = app(MentionAudienceResolver::class)
            ->readableBy(AssetService::class, $this->makeDocument(), [(string) $user->id]);

        $this->assertSame([(string) $user->id], $allowed);
    }

    private function makeWarehouse(string $branchId, string $code): Warehouse {
        return Warehouse::withoutGlobalScope('branch')->forceCreate([
            'id'        => (string) Str::ulid(),
            'code'      => $code,
            'name'      => 'Gudang ' . $code,
            'branch_id' => $branchId,
        ]);
    }

    /**
     * Warehouse tidak mengabaikan permission, jadi kandidat butuh entry `read`
     * pada modelnya sendiri (terpisah dari permission AssetService di helper).
     */
    private function grantWarehouseAccess(User $user): void {
        $permissionId = DB::table('permissions')->where('model', Warehouse::class)->value('id');
        if ($permissionId === null) {
            $permissionId = (string) Str::ulid();
            DB::table('permissions')->insert([
                'id'                 => $permissionId,
                'module'             => 'test',
                'name'               => 'Warehouse',
                'model'              => Warehouse::class,
                'route'              => 'test-warehouse',
                'permissions'        => '[]',
                'is_submitable'      => 0,
                'allow_only_creator' => 1,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }

        $roleId = (string) Str::ulid();
        DB::table('roles')->insert([
            'id'          => $roleId,
            'name'        => 'Role WH ' . $roleId,
            'description' => '',
            'is_disabled' => 0,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
        DB::table('user_role')->insert([
            'user_id'    => $user->id,
            'role_id'    => $roleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('role_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'permission_id' => $permissionId,
            'module'        => 'test',
            'name'          => 'Warehouse',
            'model'         => Warehouse::class,
            'role_id'       => $roleId,
            'level'         => 0,
            'only_creator'  => 0,
            'is_submitable' => 0,
            'permissions'   => json_encode(['select' => true, 'read' => true]),
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    private function makeBranch(bool $isMain = false, bool $deleted = false): string {
        $id = (string) Str::ulid();
        DB::table('branches')->insert([
            'id'             => $id,
            'code'           => 'BR-' . substr($id, -6),
            'name'           => 'Cabang ' . substr($id, -6),
            'is_main_branch' => $isMain ? 1 : 0,
            'created_at'     => now(),
            'updated_at'     => now(),
            'deleted_at'     => $deleted ? now() : null,
        ]);

        return $id;
    }

    private function userInBranch(string $branchId): User {
        $user = User::factory()->create();
        DB::table('user_branch')->insert([
            'user_id'    => $user->id,
            'branch_id'  => $branchId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }

    public function test_users_index_rejects_invalid_document_model(): void {
        foreach ([\stdClass::class, 'Not\\A\\Real\\Class', User::class] as $badModel) {
            $this->getAutocomplete(['document_model' => $badModel, 'document_id' => 'x'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('document_model');
        }
    }

    /**
     * @param  array<string, mixed>  $permissions
     */
    private function asSession(array $permissions): static {
        return $this
            ->withSession(['permissions' => $permissions, 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->actingAs($this->actor);
    }

    public function test_users_index_forbidden_without_document_model_access(): void {
        $order = $this->makeDocument();

        // Aktor hanya punya izin atas User, tidak atas AssetService: tidak boleh mengintip pembaca dokumen.
        $this->asSession([User::class => [0 => [[
            'model'       => User::class, 'level' => 0, 'only_creator' => false,
            'permissions' => ['select' => true, 'read' => true],
        ]]]])
            ->get(route('users.index', ['document_model' => AssetService::class, 'document_id' => $order->id]), [
                'Accept'           => 'application/json',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->assertForbidden();
    }

    public function test_users_index_only_creator_forbidden_for_others_document(): void {
        $othersOrder = $this->makeDocument();

        $this->asSession([AssetService::class => [0 => [[
            'model'       => AssetService::class, 'level' => 0, 'only_creator' => true,
            'permissions' => ['select' => true, 'read' => true],
        ]]]])
            ->get(route('users.index', ['document_model' => AssetService::class, 'document_id' => $othersOrder->id]), [
                'Accept'           => 'application/json',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->assertForbidden();
    }
}
