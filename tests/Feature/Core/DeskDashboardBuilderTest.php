<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Models\Core\Country;
use App\Models\Core\Dashboard;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\DashboardWidget;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Model test-only submitable (mirror pola `NoServicePropertyModel` di
 * `SubmitableCheckApprovalGuardTest`) — dipakai khusus test filter
 * draft-privacy quickList(). Butuh kolom `submitted_at` yang TIDAK dimiliki
 * fixture submitable lain di test suite ini.
 */
class QuickListSubmitableTestDoc extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'quick_list_submitable_test_docs';
    protected $guarded = ['id'];
}

/**
 * desk-dashboard-builder — feature test untuk endpoint Desk Home
 * (DeskController::home()/updateDashboardWidgets()) dan validasi nesting
 * depth-aware (DashboardWidgetRequest).
 */
class DeskDashboardBuilderTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('quick_list_submitable_test_docs')) {
            Schema::create('quick_list_submitable_test_docs', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('status')->nullable();
                $t->timestamp('submitted_at')->nullable();
                $t->timestamps();
            });
        }

        $this->user = User::factory()->create();
    }

    private function ownDesk(): Desk {
        return Desk::factory()->create([
            'type'     => DeskType::Custom,
            'owner_id' => $this->user->id,
        ]);
    }

    private function actingAsOwner(Desk $desk): static {
        return $this
            ->withCookie('active_desk', $desk->id)
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user);
    }

    private function actingAsNonOwner(Desk $desk, bool $withWritePermission = false): static {
        // Desk Custom milik user lain HARUS visible dulu (is_shared_all)
        // supaya DeskResolverService bisa resolve-nya utk non-owner — kalau
        // tidak, resolve() throw sebelum sempat sampai ke pengecekan
        // canEditDashboard() yang mau diuji test ini (visibility != write
        // authorization, dua gerbang terpisah).
        $desk->update(['is_shared_all' => true]);

        $otherUser = User::factory()->create();

        $session = [
            'permissions' => [
                Desk::class => [
                    0 => [
                        [
                            'model'        => Desk::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => $withWritePermission,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];

        return $this
            ->withSession($session)
            ->withCookie('active_desk', $desk->id)
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($otherUser);
    }

    // ── Requirement 4.2: Desk Home wiring ──────────────────────────────

    public function test_home_resolves_dashboard_automatically_when_desk_has_none(): void {
        $desk = $this->ownDesk();
        $this->assertNull($desk->dashboard_id);

        $response = $this->actingAsOwner($desk)->get(route('dashboard'));

        $response->assertOk();
        $this->assertNotNull($desk->refresh()->dashboard_id);
    }

    // ── Requirement 3.2, Correctness Property 1/4: full-replace 2-level ─

    public function test_update_persists_two_level_nested_structure(): void {
        $desk = $this->ownDesk();

        $payload = [
            'widgets' => [
                ['ref' => 'sec1', 'type' => 'section', 'config' => ['label' => ['json' => [], 'html' => 'Judul'], 'description' => null], 'width' => 12],
                ['ref'  => 'lc1', 'type' => 'link_card', 'parent_ref' => 'sec1', 'config' => ['label' => 'Laporan'], 'width' => 6],
                ['type' => 'link_card_item', 'parent_ref' => 'lc1', 'config' => ['label' => 'Item A', 'link_type' => 'url', 'link_to' => '/foo'], 'width' => 4],
                ['type' => 'link_card_item', 'parent_ref' => 'lc1', 'config' => ['label' => 'Item B', 'link_type' => 'url', 'link_to' => '/bar'], 'width' => 4],
            ],
        ];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);
        $response->assertNoContent();

        $desk->refresh();
        $dashboard = $desk->dashboard;
        $root      = DashboardWidget::where('dashboard_id', $dashboard->id)->whereNull('parent_id')->get();

        $this->assertCount(1, $root);
        $this->assertSame('section', $root->first()->type);

        $level1 = DashboardWidget::where('parent_id', $root->first()->id)->get();
        $this->assertCount(1, $level1);
        $this->assertSame('link_card', $level1->first()->type);

        $level2 = DashboardWidget::where('parent_id', $level1->first()->id)->get();
        $this->assertCount(2, $level2);
        $this->assertTrue($level2->every(fn ($row) => $row->type === 'link_card_item'));
    }

    public function test_update_persists_mixed_children_directly_inside_section(): void {
        $desk = $this->ownDesk();

        $payload = [
            'widgets' => [
                ['ref' => 'sec1', 'type' => 'section', 'config' => ['label' => ['json' => [], 'html' => 'Judul'], 'description' => null], 'width' => 12],
                ['type' => 'text', 'parent_ref' => 'sec1', 'config' => ['json' => [], 'html' => '<p>Halo</p>'], 'width' => 6],
                ['type' => 'spacer', 'parent_ref' => 'sec1', 'config' => null, 'width' => 6],
            ],
        ];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);
        $response->assertNoContent();

        $desk->refresh();
        $root     = DashboardWidget::where('dashboard_id', $desk->dashboard_id)->whereNull('parent_id')->first();
        $children = DashboardWidget::where('parent_id', $root->id)->pluck('type')->sort()->values();

        $this->assertSame(['spacer', 'text'], $children->toArray());
    }

    public function test_update_is_idempotent(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['type' => 'spacer', 'config' => null, 'width' => 12],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();
        $countAfterFirst = DashboardWidget::count();

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();
        $countAfterSecond = DashboardWidget::count();

        $this->assertSame($countAfterFirst, $countAfterSecond);
    }

    // ── Requirement 1.6-1.11: nesting depth guard ──────────────────────

    public function test_link_card_item_cannot_parent_another_link_card_item(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['ref' => 'lci1', 'type' => 'link_card_item', 'parent_ref' => 'lc1', 'config' => ['label' => 'A', 'link_type' => 'url', 'link_to' => '/a'], 'width' => 4],
            ['type' => 'link_card_item', 'parent_ref' => 'lci1', 'config' => ['label' => 'B', 'link_type' => 'url', 'link_to' => '/b'], 'width' => 4],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertStatus(422);
    }

    public function test_section_cannot_have_parent_ref(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['ref' => 'sec1', 'type' => 'section', 'config' => ['label' => ['json' => [], 'html' => 'A'], 'description' => null], 'width' => 12],
            ['type' => 'section', 'parent_ref' => 'sec1', 'config' => ['label' => ['json' => [], 'html' => 'B'], 'description' => null], 'width' => 12],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertStatus(422);
    }

    public function test_link_card_cannot_parent_another_link_card(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['ref' => 'lc1', 'type' => 'link_card', 'config' => ['label' => 'A'], 'width' => 6],
            ['type' => 'link_card', 'parent_ref' => 'lc1', 'config' => ['label' => 'B'], 'width' => 6],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertStatus(422);
    }

    // ── Requirement 5.1-5.3: otorisasi ─────────────────────────────────

    public function test_update_forbidden_for_user_without_write_permission_and_not_owner(): void {
        $desk = $this->ownDesk();

        $response = $this->actingAsNonOwner($desk, withWritePermission: false)
            ->post(route('dashboard.widgets.update'), ['widgets' => []]);

        $response->assertForbidden();
    }

    public function test_home_reports_can_edit_false_for_user_without_write_permission(): void {
        $desk = $this->ownDesk();

        $response = $this->actingAsNonOwner($desk, withWritePermission: false)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('canEdit', false));
    }

    // ── Requirement 2.9-2.10: keamanan link bebas ──────────────────────

    /** @dataProvider dangerousUrlSchemes */
    public function test_dangerous_url_schemes_are_rejected(string $url): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['type' => 'shortcut', 'config' => ['icon' => 'Home', 'link_type' => 'url', 'link_to' => $url, 'color' => null, 'stats_filter' => null], 'width' => 4],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertStatus(422);
    }

    public static function dangerousUrlSchemes(): array {
        return [
            'javascript' => ['javascript:alert(1)'],
            'data'       => ['data:text/html,<script>alert(1)</script>'],
            'vbscript'   => ['vbscript:msgbox(1)'],
        ];
    }

    /** @dataProvider safeUrlSchemes */
    public function test_safe_url_schemes_are_accepted(string $url): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['type' => 'shortcut', 'config' => ['icon' => 'Home', 'link_type' => 'url', 'link_to' => $url, 'color' => null, 'stats_filter' => null], 'width' => 4],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertNoContent();
    }

    public static function safeUrlSchemes(): array {
        return [
            'https'    => ['https://example.com'],
            'relative' => ['/internal/page'],
        ];
    }

    public function test_menu_item_link_requires_existing_menu_item(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['type' => 'shortcut', 'config' => ['icon' => 'Home', 'link_type' => 'menu_item', 'link_to' => (string) Str::ulid(), 'color' => null, 'stats_filter' => null], 'width' => 4],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertStatus(422);
    }

    /**
     * Regresi bug nyata: closure validasi format URL pada `config.link_to`
     * SEBELUMNYA jalan utk SEMUA baris yang link_to-nya terisi — termasuk
     * `link_type = menu_item` yang nilainya ULID MenuItem (bukan URL), jadi
     * otomatis gagal regex `#^(https?://|/)#` dan seluruh dashboard TIDAK
     * BISA disimpan begitu ada satu link berbasis menu. Closure sekarang
     * membaca `link_type` baris yang SAMA dan hanya memvalidasi format URL
     * saat link_type benar-benar "url".
     */
    public function test_menu_item_link_with_valid_menu_item_is_accepted(): void {
        $desk     = $this->ownDesk();
        $menuItem = MenuItem::query()->first() ?? MenuItem::factory()->create();

        $payload = ['widgets' => [
            ['ref' => 'lc1', 'type' => 'link_card', 'config' => ['label' => 'Grup', 'icon' => null, 'description' => ''], 'width' => 6],
            ['type' => 'link_card_item', 'parent_ref' => 'lc1', 'config' => ['label' => 'PO', 'link_type' => 'menu_item', 'link_to' => $menuItem->id], 'width' => 12],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertNoContent();

        $this->assertDatabaseHas('dashboard_widgets', [
            'dashboard_id' => $desk->fresh()->dashboard_id,
            'type'         => 'link_card_item',
        ]);
    }

    /**
     * Regresi: link_type=menu_item pada block `shortcut` (bukan hanya
     * link_card_item) juga harus lolos — bug yang sama menyerang keduanya
     * karena rule-nya generik `widgets.*.config.link_to`.
     */
    public function test_shortcut_with_valid_menu_item_link_is_accepted(): void {
        $desk     = $this->ownDesk();
        $menuItem = MenuItem::query()->first() ?? MenuItem::factory()->create();

        $payload = ['widgets' => [
            ['type' => 'shortcut', 'config' => ['icon' => 'Home', 'link_type' => 'menu_item', 'link_to' => $menuItem->id, 'background_color' => null, 'foreground_color' => null, 'stats_filter' => null], 'width' => 3],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();
    }

    // ── Requirement 2a, 2.1b, 2.1c: sanitasi HTML ──────────────────────

    public function test_text_block_html_is_sanitized_and_extra_tags_preserved(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            [
                'type'   => 'text',
                'config' => [
                    'json' => [],
                    'html' => '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><blockquote>Q</blockquote><code>c</code><u>u</u>',
                ],
                'width' => 12,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();

        $this->assertStringNotContainsString('<script', $stored->config['html']);
        $this->assertStringNotContainsString('onerror', $stored->config['html']);
        $this->assertStringNotContainsString('javascript:', $stored->config['html']);
        $this->assertStringContainsString('<blockquote>', $stored->config['html']);
        $this->assertStringContainsString('<code>', $stored->config['html']);
        $this->assertStringContainsString('<u>', $stored->config['html']);
    }

    public function test_section_label_html_uses_strict_whitelist(): void {
        $desk = $this->ownDesk();
        // Dibungkus <p> — bentuk NYATA yang dihasilkan TipTap getHTML()
        // (paragraph node selalu ada, bahkan utk teks satu-baris). Payload
        // tanpa wrapper <p> tidak mencerminkan data sungguhan dan pernah
        // menyembunyikan bug nyata: whitelist ketat tanpa "p" menghapus
        // SELURUH konten (root elemen <p> dihapus beserta text di dalamnya).
        $payload = ['widgets' => [
            [
                'type'   => 'section',
                'config' => [
                    'label'       => ['json' => [], 'html' => '<p><img src=x onerror=alert(1)><table><tr><td>t</td></tr></table><a href="/x">link</a><span onclick="alert(1)">teks</span></p>'],
                    'description' => null,
                ],
                'width' => 12,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();
        $html   = $stored->config['label']['html'];

        $this->assertStringContainsString('<p>', $html);
        $this->assertStringContainsString('teks', $html);
        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('<table', $html);
        $this->assertStringNotContainsString('<a ', $html);
        $this->assertStringContainsString('<span', $html);
        $this->assertStringNotContainsString('onclick', $html);
    }

    /**
     * Requirement 2.1b — regression test khusus bentuk data NYATA yang
     * dihasilkan TiptapEditor.getHTML() (selalu wrapped <p>...</p>), bukan
     * fragment tanpa wrapper. Bug nyata ditemukan saat verifikasi visual:
     * label section tersimpan html:"" walau json terisi benar, karena
     * whitelist ketat sebelumnya tidak mengizinkan tag "p" sama sekali.
     */
    public function test_section_label_survives_realistic_tiptap_paragraph_wrapper(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            [
                'type'   => 'section',
                'config' => [
                    'label'       => ['json' => [], 'html' => '<p>Ringkasan Aktivitas</p>'],
                    'description' => null,
                ],
                'width' => 12,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();

        $this->assertSame('<p>Ringkasan Aktivitas</p>', $stored->config['label']['html']);
    }

    public function test_section_description_is_optional_and_sanitized_when_present(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            [
                'type'   => 'section',
                'config' => [
                    'label'       => ['json' => [], 'html' => 'Judul'],
                    'description' => ['json' => [], 'html' => '<blockquote>desc</blockquote><script>alert(1)</script>'],
                ],
                'width' => 12,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();

        $this->assertStringContainsString('<blockquote>', $stored->config['description']['html']);
        $this->assertStringNotContainsString('<script', $stored->config['description']['html']);
    }

    /**
     * Feedback user: description Link Card & Quick List kini memakai
     * TiptapEditor (bentuk {json, html}), jadi harus ikut jalur sanitasi
     * yang sama seperti description Section — bukan disimpan mentah.
     */
    public function test_link_card_description_html_is_sanitized(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            [
                'type'   => 'link_card',
                'config' => [
                    'label'       => 'Grup',
                    'icon'        => null,
                    'description' => [
                        'json' => [],
                        'html' => '<script>alert(1)</script><p>Aman</p><blockquote>Kutipan</blockquote>',
                    ],
                ],
                'width' => 6,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();

        $this->assertStringNotContainsString('<script', $stored->config['description']['html']);
        $this->assertStringContainsString('Aman', $stored->config['description']['html']);
        $this->assertStringContainsString('<blockquote>', $stored->config['description']['html']);
    }

    public function test_quick_list_label_icon_and_description_are_persisted(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            [
                'type'   => 'quick_list',
                'config' => [
                    'label'       => 'Negara Terbaru',
                    'icon'        => 'ListIcon',
                    'description' => [
                        'json' => [],
                        'html' => '<p>Lima negara terakhir</p><img src=x onerror=alert(1)>',
                    ],
                    'model_id'       => null,
                    'model_class'    => Country::class,
                    'filters'        => null,
                    'sort_by'        => 'name',
                    'sort_direction' => 'asc',
                    'limit'          => 5,
                ],
                'width' => 6,
            ],
        ]];

        $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload)->assertNoContent();

        $stored = DashboardWidget::where('dashboard_id', $desk->refresh()->dashboard_id)->first();

        $this->assertSame('Negara Terbaru', $stored->config['label']);
        $this->assertSame('ListIcon', $stored->config['icon']);
        $this->assertStringContainsString('Lima negara terakhir', $stored->config['description']['html']);
        $this->assertStringNotContainsString('onerror', $stored->config['description']['html']);
    }

    public function test_section_without_description_is_accepted(): void {
        $desk    = $this->ownDesk();
        $payload = ['widgets' => [
            ['type' => 'section', 'config' => ['label' => ['json' => [], 'html' => 'Judul'], 'description' => null], 'width' => 12],
        ]];

        $response = $this->actingAsOwner($desk)->post(route('dashboard.widgets.update'), $payload);

        $response->assertNoContent();
    }

    // ── Quick List: endpoint data (columns whitelist + operator whitelist) ──

    /**
     * Session permission `select` untuk satu model — dipakai test quickList
     * (endpoint menyaring diam-diam via PermissionChecker, bukan abort).
     */
    private function actingWithSelectPermission(string $modelClass, bool $onlyCreator = false): static {
        return $this
            ->withSession([
                'permissions' => [
                    $modelClass => [
                        0 => [[
                            'model'        => $modelClass,
                            'level'        => 0,
                            'only_creator' => $onlyCreator,
                            'permissions'  => ['select' => true, 'read' => true],
                        ]],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user);
    }

    private function quickListUrl(): string {
        return route('dashboard.quickList');
    }

    public function test_quick_list_returns_only_whitelisted_columns(): void {
        MenuItem::factory()->count(3)->create();

        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            ['model' => MenuItem::class, 'columns' => ['label', 'kolom_tidak_ada'], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertNotEmpty($rows);
        // 'id' selalu disertakan (dibutuhkan React key), kolom fiktif dibuang.
        $this->assertEqualsCanonicalizing(['id', 'label'], array_keys($rows[0]));
    }

    public function test_quick_list_denies_model_without_select_permission(): void {
        MenuItem::factory()->create();

        $response = $this
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user)
            ->post($this->quickListUrl(), ['model' => MenuItem::class, 'limit' => 5]);

        $response->assertOk();
        $this->assertSame([], $response->json('data'));
        $this->assertSame(0, $response->json('total'));
    }

    public function test_quick_list_applies_whitelisted_filter_operator(): void {
        MenuItem::factory()->create(['label' => 'Alpha']);
        MenuItem::factory()->create(['label' => 'Beta']);

        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            [
                'model'   => MenuItem::class,
                'columns' => ['label'],
                'filters' => [['label', '=', 'Alpha']],
                'limit'   => 10,
            ],
        );

        $response->assertOk();
        $labels = array_column($response->json('data'), 'label');
        $this->assertContains('Alpha', $labels);
        $this->assertNotContains('Beta', $labels);
    }

    /**
     * Operator di luar whitelist (`FILTER_OPERATORS`) diabaikan diam-diam —
     * TIDAK diteruskan mentah ke query builder (cegah operator injection).
     */
    public function test_quick_list_ignores_unknown_filter_operator(): void {
        MenuItem::factory()->count(2)->create();

        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            [
                'model'   => MenuItem::class,
                'columns' => ['label'],
                'filters' => [['label', 'DROP TABLE', 'x']],
                'limit'   => 10,
            ],
        );

        $response->assertOk();
        // Filter diabaikan -> semua baris tetap kembali (bukan error/kosong).
        $this->assertCount(2, $response->json('data'));
    }

    public function test_quick_list_rejects_malformed_filter_shape(): void {
        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            ['model' => MenuItem::class, 'filters' => [['label', '=']]], // hanya 2 elemen, harus 3
        );

        $response->assertStatus(422);
    }

    /**
     * Regresi bug nyata: endpoint SEBELUMNYA hardcode kolom 'id' sebagai
     * primary key yang selalu disertakan — model dengan primary key lain
     * (mis. Country pakai 'code') memicu SQL error 500 "Unknown column
     * 'id' in 'field list'". Sekarang primary key diambil dari
     * $model->getKeyName() dan hanya disertakan bila kolomnya memang ada.
     */
    public function test_quick_list_supports_model_with_non_id_primary_key(): void {
        $countryClass = Country::class;
        $country      = new $countryClass;
        $this->assertNotSame('id', $country->getKeyName(), 'Prasyarat test: Country harus punya primary key selain id.');

        $countryClass::query()->firstOrCreate(
            ['code' => 'ZZ'],
            ['name' => 'Zedland'],
        );

        $response = $this->actingWithSelectPermission($countryClass)->post(
            $this->quickListUrl(),
            ['model' => $countryClass, 'columns' => ['name'], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertNotEmpty($rows);
        // primary key ('code') otomatis disertakan, bukan 'id'.
        $this->assertArrayHasKey('code', $rows[0]);
        $this->assertArrayHasKey('name', $rows[0]);
        $this->assertArrayNotHasKey('id', $rows[0]);
    }

    public function test_quick_list_limit_is_capped(): void {
        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            ['model' => MenuItem::class, 'limit' => 999],
        );

        $response->assertStatus(422);
    }

    public function test_quick_list_paginates_server_side(): void {
        MenuItem::factory()->count(5)->create();

        $response = $this->actingWithSelectPermission(MenuItem::class)->post(
            $this->quickListUrl(),
            ['model' => MenuItem::class, 'columns' => ['label'], 'limit' => 2, 'page' => 2],
        );

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
        $this->assertSame(5, $response->json('total'));
        $this->assertSame(2, $response->json('current_page'));
        $this->assertSame(3, $response->json('last_page'));
    }

    /**
     * Grant izin Select utk beberapa model class sekaligus — dibutuhkan
     * test kolom relasi (butuh izin ke model UTAMA + model relasinya).
     */
    private function actingWithSelectPermissionForModels(array $modelClasses): static {
        $permissions = [];
        foreach ($modelClasses as $modelClass) {
            $permissions[$modelClass] = [
                0 => [[
                    'model'        => $modelClass,
                    'level'        => 0,
                    'only_creator' => false,
                    'permissions'  => ['select' => true, 'read' => true],
                ]],
            ];
        }

        return $this
            ->withSession([
                'permissions'         => $permissions,
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user);
    }

    /**
     * Regresi fitur baru: kolom relasi singular (BelongsTo, mis.
     * DashboardWidget::dashboard()) sekarang bisa dipilih di Quick List —
     * endpoint eager-load relasinya & serialize objeknya utuh (dipakai
     * convertTemplateLink() FE utk render label), bukan cuma FK id mentah.
     */
    public function test_quick_list_includes_permitted_relation_column(): void {
        $dashboard = Dashboard::create(['title' => 'Test Dashboard', 'created_by_id' => $this->user->id]);
        $widget    = DashboardWidget::query()->create([
            'width'        => 'full',
            'dashboard_id' => $dashboard->id,
            'type'         => 'text',
            'order'        => 99,
            'is_visible'   => true,
        ]);

        $response = $this->actingWithSelectPermissionForModels([DashboardWidget::class, Dashboard::class])->post(
            $this->quickListUrl(),
            ['model' => DashboardWidget::class, 'columns' => ['type', 'dashboard'], 'filters' => [['id', '=', $widget->id]], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertArrayHasKey('dashboard', $rows[0]);
        $this->assertSame($dashboard->id, $rows[0]['dashboard']['id']);
    }

    /**
     * Kolom relasi TETAP disaring bila user tidak punya izin Select ke
     * model relasinya — walau punya izin Select ke model utama. Cegah
     * widget membocorkan model yang tidak seharusnya bisa dilihat
     * pembuatnya.
     */
    public function test_quick_list_excludes_relation_column_without_permission(): void {
        $dashboard = Dashboard::create(['title' => 'Test Dashboard', 'created_by_id' => $this->user->id]);
        $widget    = DashboardWidget::query()->create([
            'width'        => 'full',
            'dashboard_id' => $dashboard->id,
            'type'         => 'text',
            'order'        => 99,
            'is_visible'   => true,
        ]);

        $response = $this->actingWithSelectPermissionForModels([DashboardWidget::class])->post(
            $this->quickListUrl(),
            ['model' => DashboardWidget::class, 'columns' => ['type', 'dashboard'], 'filters' => [['id', '=', $widget->id]], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertArrayHasKey('type', $rows[0]);
        $this->assertArrayNotHasKey('dashboard', $rows[0]);
    }

    /**
     * Bug ditemukan saat verifikasi manual browser: Cell Table2 (dipakai FE
     * QuickListBlock) butuh `created_by_id` row utk cek permission onlyCreator
     * kolom `isLink` (mis. Dashboard::title) — endpoint SEBELUMNYA tak pernah
     * menyertakannya sama sekali, sehingga navigasi link FE selalu gagal
     * (thisModel juga dibutuhkan, tapi itu dikirim FE sendiri — sudah tahu
     * modelClass dari request, tak perlu bulat-bulat dari backend).
     */
    public function test_quick_list_includes_created_by_id_when_link_column_requested(): void {
        $dashboard = Dashboard::create(['title' => 'Test Dashboard', 'created_by_id' => $this->user->id]);

        $response = $this->actingWithSelectPermission(Dashboard::class)->post(
            $this->quickListUrl(),
            ['model' => Dashboard::class, 'columns' => ['title'], 'filters' => [['id', '=', $dashboard->id]], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertArrayHasKey('created_by_id', $rows[0]);
        $this->assertSame($this->user->id, $rows[0]['created_by_id']);
    }

    /**
     * created_by_id TIDAK disertakan bila tidak ada kolom isLink yang
     * diminta — whitelist kolom tetap ketat, bukan melebar diam-diam.
     */
    public function test_quick_list_omits_created_by_id_without_link_column(): void {
        $dashboard = Dashboard::create(['title' => 'Test Dashboard', 'created_by_id' => $this->user->id]);

        $response = $this->actingWithSelectPermissionForModels([Dashboard::class, User::class])->post(
            $this->quickListUrl(),
            ['model' => Dashboard::class, 'columns' => ['created_by'], 'filters' => [['id', '=', $dashboard->id]], 'limit' => 5],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertArrayNotHasKey('created_by_id', $rows[0]);
        $this->assertArrayHasKey('created_by', $rows[0]);
    }

    // ── Quick List: filter privasi wajib (submitable draft + onlyCreator) ──

    /**
     * Regresi keamanan (feedback user): quickList() membangun query manual
     * sendiri, TIDAK lewat macro `DataTable::dataTable()` — aturan wajib
     * "draft submitable hanya terlihat pembuatnya" (persis snippet
     * `DataTableScope::addDataTable()`) SEBELUMNYA tidak pernah diterapkan.
     * Draft user lain wajib tersembunyi; draft sendiri & dokumen submitted
     * (milik siapapun) tetap terlihat.
     */
    public function test_quick_list_hides_other_users_draft_for_submitable_model(): void {
        $otherUser = User::factory()->create();

        $ownDraft = QuickListSubmitableTestDoc::create([
            'created_by_id' => $this->user->id,
            'submitted_at'  => null,
        ]);
        $otherDraft = QuickListSubmitableTestDoc::create([
            'created_by_id' => $otherUser->id,
            'submitted_at'  => null,
        ]);
        $otherSubmitted = QuickListSubmitableTestDoc::create([
            'created_by_id' => $otherUser->id,
            'submitted_at'  => now(),
        ]);

        $response = $this->actingWithSelectPermission(QuickListSubmitableTestDoc::class)->post(
            $this->quickListUrl(),
            ['model' => QuickListSubmitableTestDoc::class, 'limit' => 10],
        );

        $response->assertOk();
        $ids = array_column($response->json('data'), 'id');
        $this->assertContains($ownDraft->id, $ids);
        $this->assertContains($otherSubmitted->id, $ids);
        $this->assertNotContains($otherDraft->id, $ids);
    }

    /**
     * Regresi keamanan (feedback user): bila satu-satunya izin Select user
     * ke suatu model only_creator-scoped, quickList() SEBELUMNYA tetap
     * mengembalikan SEMUA baris — parity dgn `Controller::guard()` yang
     * otomatis jalan di listing biasa (lewat constructor-middleware), tapi
     * dilewati quickList() krn model-nya dinamis per-request. Sekarang
     * dibatasi lewat `PermissionChecker::isOnlyCreator()`.
     */
    public function test_quick_list_restricts_to_own_rows_when_only_creator_scoped(): void {
        $otherUser = User::factory()->create();

        $mine = Dashboard::create(['title' => 'Milik Saya', 'created_by_id' => $this->user->id]);
        Dashboard::create(['title' => 'Milik Orang Lain', 'created_by_id' => $otherUser->id]);

        $response = $this->actingWithSelectPermission(Dashboard::class, onlyCreator: true)->post(
            $this->quickListUrl(),
            ['model' => Dashboard::class, 'columns' => ['title'], 'limit' => 10],
        );

        $response->assertOk();
        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($mine->id, $rows[0]['id']);
    }
}
