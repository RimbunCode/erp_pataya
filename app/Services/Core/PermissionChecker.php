<?php

namespace App\Services\Core;

use App\Enums\Permission;
use App\Http\Middleware\AppMiddleware;
use Illuminate\Http\Request;

/**
 * Cek izin user di backend. Mirror logika frontend `checkPermission`
 * (`resources/js/lib/utils.js`) — backend sebelumnya tak punya helper ini.
 *
 * Map `permissions` berbentuk: model => level => onlyCreatorKey => {
 *   model, level, only_creator, permissions: { <action>: bool }
 * } (hasil `AppMiddleware::resolvePermissions`).
 *
 * Mendukung evaluasi pohon `visibleFor` (any/all bersarang) lewat `satisfies()`.
 *
 * @phpstan-type ActionNode Permission|array<string,mixed>|list<mixed>
 * @phpstan-type Node array<string,mixed>|list<mixed>
 */
class PermissionChecker {
    /** @param array<string,mixed> $permissions map model→level→list (lihat docblock) */
    public function __construct(private array $permissions) {}

    /**
     * Bangun dari Request: pakai permission yang sudah di-resolve `AppMiddleware`
     * ke session; fallback resolve langsung dari `RolePermission` bila kosong
     * (mis. konteks non-web/test tanpa session permission).
     */
    public static function forUser(Request $request): self {
        // Override eksplisit (test/konteks khusus) via container binding.
        if (app()->bound(self::class)) {
            return app(self::class);
        }

        $permissions = $request->hasSession()
            ? $request->session()->get('permissions')
            : null;

        if (! is_array($permissions)) {
            $user        = $request->user();
            $permissions = $user
                ? AppMiddleware::resolvePermissionsFor($user->id)
                : [];
        }

        return new self($permissions);
    }

    /**
     * True bila user punya `$action` pada `$model` di `$level`. Mirror FE checkPermission:
     * iterasi tiap entry level; entry only_creator atau bukan, asal flag aksi true.
     * (Cek only_creator/ownership di luar scope kolom-visibility — kolom hanya butuh
     * "punya aksi ini", bukan "boleh atas record tertentu".)
     */
    public function can(string $model, Permission $action, int $level = 0): bool {
        $levelPermissions = $this->permissions[$model][$level] ?? null;
        if (! is_array($levelPermissions)) {
            return false;
        }

        foreach ($levelPermissions as $entry) {
            $perms = $entry['permissions'] ?? [];
            if (! empty($perms[$action->value])) {
                return true;
            }
        }

        return false;
    }

    /**
     * True bila SATU-SATUNYA cara user punya `$action` pada `$model` di `$level`
     * adalah lewat entry `only_creator`-scoped — mirror `DataTable::_checkPermission()`
     * (least-restrictive-wins: begitu SATU entry granting yang TIDAK only_creator
     * ditemukan, langsung false — user boleh lihat semua, bukan cuma miliknya).
     * Beda dgn `guard()`/`_checkPermission()` di Controller: method itu terikat
     * `static::class` (satu model tetap per-controller) dan `abort(403)` bila
     * tak ada akses; di sini utk model DINAMIS (quickList lintas model) & tanpa
     * abort — pemanggil sudah pastikan `can()` true lebih dulu.
     */
    public function isOnlyCreator(string $model, Permission $action, int $level = 0): bool {
        $levelPermissions = $this->permissions[$model][$level] ?? null;
        if (! is_array($levelPermissions)) {
            return false;
        }

        $onlyCreator = false;
        foreach ($levelPermissions as $entry) {
            $perms = $entry['permissions'] ?? [];
            if (empty($perms[$action->value])) {
                continue;
            }
            if (empty($entry['only_creator'])) {
                return false;
            }
            $onlyCreator = true;
        }

        return $onlyCreator;
    }

    /**
     * Evaluasi pohon `visibleFor` (any/all bersarang, di level node MAUPUN aksi).
     *
     * node       := { any: node[] } | { all: node[] } | leaf
     * leaf       := [ Model::class, actionNode ]
     * actionNode := Permission | { any: actionNode[] } | { all: actionNode[] } | Permission[]
     * list datar := { any: [...] } (backward-compat)
     *
     * @param  Node  $node
     */
    public function satisfies(array $node): bool {
        // Grup eksplisit any/all.
        if (\array_key_exists('any', $node)) {
            foreach ((array) $node['any'] as $child) {
                if ($this->satisfies((array) $child)) {
                    return true;
                }
            }

            return false;
        }
        if (\array_key_exists('all', $node)) {
            foreach ((array) $node['all'] as $child) {
                if (! $this->satisfies((array) $child)) {
                    return false;
                }
            }

            return true;
        }

        // Leaf [Model::class, actionNode] — heuristik: indeks 0 = string class.
        if (isset($node[0]) && is_string($node[0])) {
            $model = $node[0];

            return $this->satisfiesAction($model, $node[1] ?? null);
        }

        // List datar node [leaf, leaf, ...] = { any: [...] }.
        foreach ($node as $child) {
            if (is_array($child) && $this->satisfies($child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Evaluasi actionNode pada satu model (any/all antar-aksi).
     *
     * @param  ActionNode  $action
     */
    private function satisfiesAction(string $model, mixed $action): bool {
        if ($action instanceof Permission) {
            return $this->can($model, $action);
        }

        if (is_array($action)) {
            if (\array_key_exists('any', $action)) {
                foreach ((array) $action['any'] as $a) {
                    if ($this->satisfiesAction($model, $a)) {
                        return true;
                    }
                }

                return false;
            }
            if (\array_key_exists('all', $action)) {
                foreach ((array) $action['all'] as $a) {
                    if (! $this->satisfiesAction($model, $a)) {
                        return false;
                    }
                }

                return true;
            }

            // List datar aksi = OR antar-aksi.
            foreach ($action as $a) {
                if ($this->satisfiesAction($model, $a)) {
                    return true;
                }
            }
        }

        return false;
    }
}
