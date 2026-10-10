<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Desk;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Prop bersama AppMiddleware (`permissions`, `ignorePermissionModels`, `branchSettings`)
 * adalah once prop: dikirim sekali, lalu dipakai ulang browser selama kuncinya sama.
 */
class AppMiddlewareSharedPropsTest extends TestCase {
    use RefreshDatabase;

    private const ONCE_PROPS = ['permissions', 'ignorePermissionModels', 'branchSettings'];

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([QueryDetectorMiddleware::class]);
    }

    /** @return array{0: User, 1: Branch, 2: Branch} */
    private function userWithTwoBranches(): array {
        $country = Country::factory()->create();
        $user    = User::factory()->create();
        $branchA = Branch::factory()->create(['billing_country_id' => $country->code, 'shipping_country_id' => $country->code]);
        $branchB = Branch::factory()->create(['billing_country_id' => $country->code, 'shipping_country_id' => $country->code]);
        $user->branches()->attach([$branchA->id, $branchB->id]);

        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id, 'default_branch_id' => $branchA->id]);

        return [$user, $branchA, $branchB];
    }

    private function version(User $user): string {
        $this->flushHeaders();
        $initial = $this->actingAs($user)->withCookie('lang', 'en')->get(route('dashboard'));
        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $initial->getContent(), $matches);

        return json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR)['version'] ?? '';
    }

    /**
     * Satu kunjungan Inertia ke dashboard; $loadedKeys meniru header
     * X-Inertia-Except-Once-Props dari browser.
     *
     * @param  list<string>  $loadedKeys
     * @return array<string, mixed>
     */
    private function visit(User $user, string $version, array $loadedKeys = [], ?string $branchId = null): array {
        $request = $this->actingAs($user)->withCookie('lang', 'en');
        if ($branchId !== null) {
            $request = $request->withSession(['currentBranch' => $branchId]);
        }

        return $request->withHeaders([
            'X-Inertia'         => 'true',
            'X-Inertia-Version' => $version,
            ...($loadedKeys !== [] ? ['X-Inertia-Except-Once-Props' => implode(',', $loadedKeys)] : []),
        ])->get(route('dashboard'))->assertOk()->json();
    }

    /** @return list<string> kunci once prop milik prop tertentu */
    private function keysOf(array $page, string $prop): array {
        return array_values(array_filter(
            array_keys($page['onceProps'] ?? []),
            fn (string $key) => str_starts_with($key, $prop . ':'),
        ));
    }

    /** @param  array<string, mixed>  $page */
    private function assertOnceProps(array $page, bool $inline): void {
        foreach (self::ONCE_PROPS as $prop) {
            $this->assertCount(1, $this->keysOf($page, $prop), "metadata once untuk {$prop}");
            $inline
                ? $this->assertArrayHasKey($prop, $page['props'], "{$prop} harus ikut di respons")
                : $this->assertArrayNotHasKey($prop, $page['props'], "{$prop} tak boleh dikirim ulang");
        }
    }

    /** @return list<string> semua kunci once yang dipegang browser */
    private function allKeys(array $page): array {
        return array_keys($page['onceProps']);
    }

    public function test_first_visit_sends_shared_props_inline_with_once_metadata(): void {
        [$user] = $this->userWithTwoBranches();

        $page = $this->visit($user, $this->version($user));

        $this->assertOnceProps($page, inline: true);
        $this->assertIsArray($page['props']['branchSettings']['branches']);
        $this->assertCount(2, $page['props']['branchSettings']['branches']);
    }

    public function test_next_visit_with_same_keys_skips_shared_props_and_their_queries(): void {
        [$user]  = $this->userWithTwoBranches();
        $version = $this->version($user);
        $first   = $this->visit($user, $version);

        DB::enableQueryLog();
        $second = $this->visit($user, $version, $this->allKeys($first));
        $log    = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertOnceProps($second, inline: false);
        $this->assertStringNotContainsString('ignore_permission', $log, 'query ignorePermissionModels tak boleh jalan');
        $this->assertStringNotContainsString('user_branch', $log, 'query branchSettings tak boleh jalan');
    }

    public function test_permission_change_resends_permissions_but_not_branch_settings(): void {
        [$user]  = $this->userWithTwoBranches();
        $version = $this->version($user);
        $first   = $this->visit($user, $version);

        $role = Role::create(['name' => 'role-' . uniqid()]);
        $user->roles()->attach($role->id);
        $permission = Permission::create([
            'name'        => 'Test Permission ' . uniqid(),
            'model'       => Country::class,
            'module'      => 'Test',
            'permissions' => [PermissionEnum::Select->value],
        ]);
        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'model'         => Country::class,
            'module'        => 'Test',
            'name'          => 'Test Permission',
            'level'         => 0,
            'only_creator'  => false,
            'permissions'   => [PermissionEnum::Select->value => true],
        ]);

        $second = $this->visit($user, $version, $this->allKeys($first));

        $this->assertArrayHasKey('permissions', $second['props'], 'permission berubah => dikirim ulang');
        $this->assertArrayNotHasKey('branchSettings', $second['props'], 'cabang tak berubah => tak dikirim ulang');
        $this->assertNotSame($this->keysOf($first, 'permissions'), $this->keysOf($second, 'permissions'));
    }

    public function test_switching_current_branch_resends_branch_settings(): void {
        [$user, $branchA, $branchB] = $this->userWithTwoBranches();
        $version                    = $this->version($user);
        $first                      = $this->visit($user, $version, [], $branchA->id);

        $second = $this->visit($user, $version, $this->allKeys($first), $branchB->id);

        $this->assertArrayHasKey('branchSettings', $second['props']);
        $this->assertSame($branchB->id, $second['props']['branchSettings']['currentBranch']['id']);
        $this->assertArrayNotHasKey('ignorePermissionModels', $second['props']);
    }

    /**
     * `->without(['billingCountry','shippingCountry'])` saja tak cukup: accessor
     * $appends (shippingAddress/billingAddress) memuat relasi negara lagi per cabang.
     */
    public function test_branch_settings_does_not_lazy_load_countries_per_branch(): void {
        [$user]  = $this->userWithTwoBranches();
        $version = $this->version($user);

        DB::enableQueryLog();
        $this->visit($user, $version);
        $countryQueries = collect(DB::getQueryLog())
            ->pluck('query')
            ->filter(fn (string $q) => (bool) preg_match('/from ["`]countries["`] where/i', $q))
            ->count();
        DB::disableQueryLog();

        $this->assertSame(0, $countryQueries);
    }
}
