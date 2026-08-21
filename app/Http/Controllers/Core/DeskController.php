<?php

namespace App\Http\Controllers\Core;

use App\Enums\DeskType;
use App\Enums\Permission;
use App\Http\Middleware\AppMiddleware;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Services\Core\Desk\DeskResolverService;
use App\Services\Core\PermissionChecker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route as RouteFacade;
use Inertia\Inertia;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class DeskController {
    public function __construct(private DeskResolverService $resolver) {}

    public function index(Request $request) {
        $user  = $request->user();
        $desks = $this->resolver->visibleDesksFor($user)
            ->map(fn (Desk $desk) => [
                ...$desk->only(['id', 'name', 'icon', 'color']),
                'isDefault' => $desk->id === $user->default_desk_id,
            ]);

        return Inertia::render('Core/DeskList', [
            'desks' => $desks->values(),
        ]);
    }

    public function store(Request $request) {
        $request->validate([
            'name'    => ['required', 'string', 'max:255'],
            'icon'    => ['required', 'string'],
            'color'   => ['nullable', 'string'],
            'role_id' => ['nullable', 'string', 'exists:roles,id'],
        ]);

        if ($request->role_id) {
            $checker = new PermissionChecker(AppMiddleware::resolvePermissionsFor($request->user()->id));
            abort_unless($checker->can(Desk::class, Permission::Create), 403);
        }

        $desk = Desk::create([
            'name'     => $request->name,
            'icon'     => $request->icon,
            'color'    => $request->color,
            'type'     => DeskType::Custom,
            'owner_id' => $request->role_id ? null : $request->user()->id,
        ]);

        if ($request->role_id) {
            $desk->roles()->attach($request->role_id);
        }

        return redirect()->route('desks.index');
    }

    public function switch(Request $request) {
        $request->validate([
            'desk_id'               => ['required', 'string'],
            'redirect_to_dashboard' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();
        $desk = $this->resolver->visibleDesksFor($user)->firstWhere('id', $request->desk_id);

        abort_unless($desk, 403);

        $cookie = cookie('active_desk', $desk->id, 60 * 24 * 30);

        // Dipicu eksplisit dari halaman /desks (DeskList.jsx) — asal klik
        // SELALU /desks, yang bukan MenuItem desk manapun, jadi TIDAK PERNAH
        // relevan (currentPageIrrelevantToDesk() lewat Referer jadi mubazir di
        // sini, redirect dashboard sudah pasti benar tanpa perlu dicek).
        if ($request->boolean('redirect_to_dashboard')) {
            return redirect()->route('dashboard')->withCookie($cookie);
        }

        if ($this->currentPageIrrelevantToDesk($request, $desk)) {
            return redirect()->route('dashboard')->withCookie($cookie);
        }

        return back()->withCookie($cookie);
    }

    /**
     * Requirement 6 AC 4 pengecualian: halaman asal (Referer) tidak boleh
     * "meninggalkan" user di halaman yang tidak lagi relevan setelah pindah
     * Desk. WHERE Referer tidak dapat di-resolve ke route bernama atau route
     * tersebut tidak terdaftar sebagai MenuItem sama sekali, dianggap relevan
     * (tidak ada dasar untuk memutuskan sebaliknya).
     */
    private function currentPageIrrelevantToDesk(Request $request, Desk $desk): bool {
        $referer = $request->headers->get('referer');
        if (! $referer) {
            return false;
        }

        try {
            $refererRequest = Request::create($referer);
            $routeName      = RouteFacade::getRoutes()->match($refererRequest)->getName();
        } catch (ResourceNotFoundException) {
            return false;
        }

        if (! $routeName) {
            return false;
        }

        $menuItem = MenuItem::forRoute($routeName);
        if (! $menuItem) {
            return false;
        }

        return ! $menuItem->desks()->where('desks.id', $desk->id)->exists();
    }

    public function setDefault(Request $request, Desk $desk) {
        $user = $request->user();

        abort_unless(
            $this->resolver->visibleDesksFor($user)->contains('id', $desk->id),
            403,
        );

        $user->update(['default_desk_id' => $desk->id]);

        return back();
    }

    public function storeRoleScoped(Request $request, Desk $desk) {
        $checker = new PermissionChecker(AppMiddleware::resolvePermissionsFor($request->user()->id));

        abort_unless($checker->can(Desk::class, Permission::Create), 403);

        $request->validate(['role_id' => ['required', 'string', 'exists:roles,id']]);

        $desk->roles()->syncWithoutDetaching([$request->role_id]);

        return back();
    }
}
