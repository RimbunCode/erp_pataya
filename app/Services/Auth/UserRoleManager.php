<?php

namespace App\Services\Auth;

use App\Models\User\Role;
use App\Models\User\User;

class UserRoleManager {
    public function ensureStudentRole(User $user): void {
        $studentRole = $this->resolveRoleByName('student');
        $this->attachRole($user, $studentRole->id);
    }

    public function attachInstructorRole(User $user): void {
        $instructorRole = Role::query()
            ->where('name', 'instructor')
            ->where('is_disabled', false)
            ->first();

        if (! $instructorRole) {
            return;
        }

        $this->attachRole($user, $instructorRole->id);
    }

    public function attachOrganizationRole(User $user): void {
        $organizationRole = Role::query()
            ->where('name', 'organization')
            ->where('is_disabled', false)
            ->first();

        if (! $organizationRole) {
            return;
        }

        $this->attachRole($user, $organizationRole->id);
    }

    public function applyPublicRegistrationRoles(User $user, bool $wantsInstructor): void {
        $this->ensureStudentRole($user);

        if ($wantsInstructor) {
            $this->attachInstructorRole($user);
        }
    }

    public function resolveWantsInstructor(mixed $wantsInstructor, ?string $legacyRole = null): bool {
        if (filter_var($wantsInstructor, FILTER_VALIDATE_BOOLEAN)) {
            return true;
        }

        return strtolower(trim((string) $legacyRole)) === 'instructor';
    }

    private function resolveRoleByName(string $roleName): Role {
        return Role::query()->firstOrCreate(
            ['name' => $roleName],
            [
                'description' => $this->defaultDescription($roleName),
                'is_disabled' => false,
            ],
        );
    }

    private function attachRole(User $user, string $roleId): void {
        $user->roles()->syncWithoutDetaching([$roleId]);
    }

    private function defaultDescription(string $roleName): string {
        return match ($roleName) {
            'student'      => 'Access courses, track progress, and get certified.',
            'instructor'   => 'Create courses, manage students, and view earnings.',
            'organization' => 'Manage affiliate trainers and corporate training.',
            'admin'        => 'System-wide management, approvals, and CMS.',
            default        => ucfirst($roleName) . ' role',
        };
    }
}
