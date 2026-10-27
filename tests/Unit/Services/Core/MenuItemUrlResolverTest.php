<?php

namespace Tests\Unit\Services\Core;

use App\Models\Core\MenuItem;
use App\Services\Core\Desk\MenuItemUrlResolver;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class MenuItemUrlResolverTest extends TestCase {
    public function test_synthetic_menu_group_has_no_url_and_does_not_log_missing_route(): void {
        Log::shouldReceive('warning')->never();

        $menuItem = new MenuItem(['route_name' => '_group.module-settings']);

        $this->assertNull(app(MenuItemUrlResolver::class)->resolve($menuItem));
    }
}
