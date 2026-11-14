<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\StockEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Halaman pembuatan Entri Stok harus terbuka tanpa rujukan dokumen (`/stockEntries/create`),
 * seperti controller lain; sebelumnya `$ref` wajib sehingga rute tanpa rujukan menghasilkan HTTP 500.
 */
class StockEntryCreateRouteTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class]);
    }

    private function http(): static {
        return $this
            ->withSession([
                'permissions' => [
                    StockEntry::class => [
                        0 => [
                            [
                                'model'        => StockEntry::class,
                                'level'        => 0,
                                'only_creator' => false,
                                'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true],
                            ],
                        ],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_create_page_opens_without_reference(): void {
        $response = $this->http()->get('/stockEntries/create');

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Inventory/StockEntries/Show')
                ->where('defaultData', null),
        );
    }

    public function test_create_page_opens_with_unknown_reference(): void {
        $response = $this->http()->get('/stockEntries/create/x');

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page->component('Inventory/StockEntries/Show')->where('defaultData', null),
        );
    }
}
