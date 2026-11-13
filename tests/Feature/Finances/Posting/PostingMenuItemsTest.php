<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Core\MenuItem;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use Database\Seeders\DeskSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 6.3 (Requirement 8.5): Posting Profile dan Parity Log didaftarkan sebagai menu item pada grup
 * Module Settings di desk Core dan Finances; seeder idempoten.
 */
class PostingMenuItemsTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, array{0: string, 1: class-string}>
     */
    public static function items(): array {
        return [
            'posting profiles' => ['postingProfiles.*', PostingProfile::class],
            'parity logs'      => ['postingParityLogs.*', PostingParityLog::class],
        ];
    }

    /**
     * @param  class-string  $model
     */
    #[DataProvider('items')]
    public function test_seeder_registers_the_page_in_module_settings_on_core_and_finances(string $routeName, string $model): void {
        (new DeskSeeder)->run();
        (new DeskSeeder)->run();

        $items = MenuItem::where('route_name', $routeName)->get();
        $this->assertCount(1, $items);

        $item = $items->first();
        $this->assertSame($model, $item->model);
        $this->assertSame('_group.module-settings', $item->parent?->route_name);
        $this->assertSame(['core', 'finances'], $item->desks()->pluck('domain')->map(fn ($domain): string => $domain->value)->sort()->values()->all());
    }
}
