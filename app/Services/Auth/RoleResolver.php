<?php

namespace App\Services\Auth;

use Symfony\Component\HttpFoundation\Cookie;

class RoleResolver {
    public const LAST_ACTIVE_ROLE_COOKIE = 'last_active_role';

    /**
     * @var array<int, string>
     */
    private const APP_ROLES = ['student', 'instructor', 'organization', 'admin'];

    /**
     * @return array<int, string>
     */
    public function appRoles(): array {
        return self::APP_ROLES;
    }

    public function normalizeRole(mixed $role): ?string {
        if (! \is_string($role)) {
            return null;
        }

        $normalizedRole = trim(strtolower($role));

        return \in_array($normalizedRole, self::APP_ROLES, true) ? $normalizedRole : null;
    }

    /**
     * @param  array<int, mixed>  $roles
     * @return array<int, string>
     */
    public function normalizeRoles(array $roles): array {
        $normalizedRoles = [];

        foreach ($roles as $role) {
            $normalizedRole = $this->normalizeRole($role);
            if ($normalizedRole === null || \in_array($normalizedRole, $normalizedRoles, true)) {
                continue;
            }

            $normalizedRoles[] = $normalizedRole;
        }

        return $normalizedRoles;
    }

    public function roleFromPath(?string $path): ?string {
        if (! \is_string($path) || trim($path) === '') {
            return null;
        }

        $resolvedPath = parse_url($path, PHP_URL_PATH);
        if (! \is_string($resolvedPath) || trim($resolvedPath) === '') {
            return null;
        }

        $firstSegment = explode('/', trim($resolvedPath, '/'))[0] ?? null;

        return $this->normalizeRole($firstSegment);
    }

    /**
     * @param  array<int, mixed>  $ownedRoles
     */
    public function isRoleOwned(?string $role, array $ownedRoles): bool {
        $normalizedRole = $this->normalizeRole($role);
        if ($normalizedRole === null) {
            return false;
        }

        return \in_array($normalizedRole, $this->normalizeRoles($ownedRoles), true);
    }

    /**
     * @param  array<int, mixed>  $ownedRoles
     */
    public function resolvePreferredOwnedRole(array $ownedRoles, ?string $preferredRole, ?string $cookieRole): ?string {
        $normalizedOwnedRoles = $this->normalizeRoles($ownedRoles);
        if (\count($normalizedOwnedRoles) === 0) {
            return null;
        }

        foreach ([$preferredRole, $cookieRole] as $candidate) {
            $normalizedCandidate = $this->normalizeRole($candidate);
            if ($normalizedCandidate !== null && \in_array($normalizedCandidate, $normalizedOwnedRoles, true)) {
                return $normalizedCandidate;
            }
        }

        return $normalizedOwnedRoles[0];
    }

    /**
     * @param  array<int, mixed>  $ownedRoles
     */
    public function resolveActiveRoleFromRequestPath(array $ownedRoles, ?string $path, ?string $cookieRole): ?string {
        $normalizedOwnedRoles = $this->normalizeRoles($ownedRoles);
        if (\count($normalizedOwnedRoles) === 0) {
            return null;
        }

        $pathRole = $this->roleFromPath($path);
        if ($pathRole !== null && \in_array($pathRole, $normalizedOwnedRoles, true)) {
            return $pathRole;
        }

        $normalizedCookieRole = $this->normalizeRole($cookieRole);
        if ($normalizedCookieRole !== null && \in_array($normalizedCookieRole, $normalizedOwnedRoles, true)) {
            return $normalizedCookieRole;
        }

        return $normalizedOwnedRoles[0];
    }

    public function dashboardRouteName(string $role): string {
        return match ($this->normalizeRole($role)) {
            'student'      => 'student.dashboard',
            'instructor'   => 'instructor.dashboard',
            'organization' => 'organization.dashboard',
            'admin'        => 'admin.dashboard',
            default        => 'student.dashboard',
        };
    }

    public function dashboardPath(string $role): string {
        return route($this->dashboardRouteName($role), absolute: false);
    }

    public function makeLastActiveRoleCookie(string $role): Cookie {
        $normalizedRole = $this->normalizeRole($role) ?? 'student';

        return cookie(
            self::LAST_ACTIVE_ROLE_COOKIE,
            $normalizedRole,
            60 * 24 * 30,
            '/',
            null,
            null,
            true,
            false,
            'lax',
        );
    }
}
