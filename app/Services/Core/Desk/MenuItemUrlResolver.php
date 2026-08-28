<?php

namespace App\Services\Core\Desk;

use App\Models\Core\MenuItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route as RouteFacade;
use Symfony\Component\Routing\Exception\RouteNotFoundException;

/**
 * Menerjemahkan MenuItem menjadi satu URL konkret.
 *
 * Logika ini SEBELUMNYA hanya hidup sebagai method privat di
 * ResolveActiveDesk (dipakai membangun sidebar). Dashboard block
 * (shortcut & link_card_item) juga perlu URL yang SAMA, dan prop
 * `allMenuItems` sebelumnya dikirim tanpa URL sama sekali — akibatnya
 * setiap link bertipe `menu_item` di dashboard tidak pernah bisa diklik.
 * Diekstrak ke sini supaya kedua pemakai memakai satu sumber kebenaran,
 * bukan dua implementasi yang bisa menyimpang.
 */
class MenuItemUrlResolver {
    /**
     * `url_override` (URL literal, divalidasi saat seeding) adalah
     * prioritas tertinggi. Kalau kosong, `route_name` di-resolve — bisa
     * berupa nama route persis ATAU pola wildcard (mis. "users.*").
     * Untuk wildcard, kandidat "*.index" selalu dicoba lebih dulu karena
     * halaman listing adalah tujuan klik yang wajar; urutan alfabetis
     * murni tidak aman (mis. "create" mendahului "index").
     */
    public function resolve(MenuItem $item): ?string {
        if ($item->url_override !== null) {
            return $item->url_override;
        }

        $routeName = $item->route_name;

        if (! $routeName) {
            return null;
        }

        if (! \str_contains($routeName, '*')) {
            try {
                return route($routeName);
            } catch (RouteNotFoundException $e) {
                Log::warning("MenuItem route_name tidak dapat di-resolve: {$routeName}", ['exception' => $e]);

                return null;
            }
        }

        $candidates = collect(RouteFacade::getRoutes())
            ->map(fn ($route) => $route->getName())
            ->filter()
            ->unique()
            ->filter(fn ($name) => fnmatch($routeName, $name))
            ->sort()
            ->sortByDesc(fn ($name) => \str_ends_with($name, '.index'));

        foreach ($candidates as $candidate) {
            try {
                return route($candidate);
            } catch (\Throwable $e) {
                continue;
            }
        }

        Log::warning("MenuItem route_name wildcard tidak menemukan route tanpa parameter wajib: {$routeName}");

        return null;
    }
}
