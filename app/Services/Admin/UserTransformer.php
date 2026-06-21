<?php

namespace App\Services\Admin;

use App\FormStatus;
use App\Models\RoleRequest;
use App\Models\User\User;
use App\Traits\HasInitials;
use Illuminate\Support\Collection;

class UserTransformer {
    use HasInitials;

    public function transformUser(User $user): array {
        $roleNames   = $this->normalizeRoleNames($user->roles->pluck('name'));
        $displayRole = $this->resolveDisplayRole($roleNames);

        return [
            'id'               => (string) $user->id,
            'name'             => (string) $user->name,
            'email'            => (string) $user->email,
            'avatar'           => $this->initials((string) $user->name),
            'role'             => $displayRole,
            'roles'            => $roleNames,
            'status'           => $this->statusValue($user->status),
            'joinedAt'         => $user->created_at?->toIso8601String(),
            'inactiveReason'   => $user->inactive_reason,
            'inactiveBy'       => $user->inactive_by,
            'inactiveByName'   => $user->inactiveByUser?->name,
            'inactiveAt'       => $user->inactive_at?->toIso8601String(),
            'enrolledCourses'  => 0,
            'completedCourses' => 0,
            'totalSpent'       => 0,
            'courses'          => 0,
            'totalStudents'    => 0,
            'totalEarnings'    => 0,
            'members'          => 0,
            'activeLicenses'   => 0,
            'plan'             => null,
        ];
    }

    /**
     * @param  Collection<int, RoleRequest>  $requestsByContext
     */
    public function transformRoleRequest(RoleRequest $request, Collection $requestsByContext): array {
        $requesterRoleNames = $request->user
            ? $this->normalizeRoleNames($request->user->roles->pluck('name'))
            : [];

        $history = $this->mapRoleRequestRejectionHistory(
            $request,
            $requestsByContext->get($this->roleRequestHistoryKey($request), collect()),
        );

        return [
            'id'            => (string) $request->id,
            'userId'        => (string) ($request->user_id ?? ''),
            'userName'      => (string) ($request->user?->name ?? '-'),
            'userEmail'     => (string) ($request->user?->email ?? '-'),
            'avatar'        => $this->initials((string) ($request->user?->name ?? 'NA')),
            'currentRole'   => $this->resolveDisplayRole($requesterRoleNames),
            'requestedRole' => (string) $request->requested_role,
            'submittedAt'   => $request->created_at?->toIso8601String(),
            'status'        => (string) $request->status,
            'reason'        => (string) $request->reason,
            'proofUrl'      => route('files.preview', $request->proof_file_id),
            'proofFileName' => $request->proofFile
                ? trim("{$request->proofFile->name}.{$request->proofFile->extension}", '.')
                : null,
            'approvedBy'            => $request->status === FormStatus::APPROVED->value ? $request->reviewer?->name : null,
            'approvedAt'            => $request->status === FormStatus::APPROVED->value ? $request->reviewed_at?->toIso8601String() : null,
            'rejectedBy'            => $request->status === FormStatus::REJECTED->value ? $request->reviewer?->name : null,
            'rejectedAt'            => $request->status === FormStatus::REJECTED->value ? $request->reviewed_at?->toIso8601String() : null,
            'rejectReason'          => $request->rejection_reason,
            'rejectionHistory'      => $history,
            'rejectionHistoryCount' => $history->count(),
        ];
    }

    public function transformAdmin(User $user, AdminPermissionService $permissionService): array {
        $permissions = $permissionService->resolveUserPermissionNames($user);

        return [
            'id'          => (string) $user->id,
            'name'        => (string) $user->name,
            'email'       => (string) $user->email,
            'avatar'      => $this->initials((string) $user->name),
            'role'        => \in_array('super_admin', $permissions, true) ? 'super_admin' : 'admin',
            'status'      => $this->statusValue($user->status),
            'permissions' => $permissions,
            'lastActive'  => $user->updated_at?->toIso8601String(),
            'createdAt'   => $user->created_at?->toIso8601String(),
        ];
    }

    public function roleRequestHistoryKey(RoleRequest $roleRequest): string {
        return "{$roleRequest->user_id}|{$roleRequest->requested_role}";
    }

    /**
     * @param  array<int, string>  $roles
     */
    public function resolveDisplayRole(array $roles): string {
        foreach (['admin', 'organization', 'instructor', 'student'] as $roleName) {
            if (\in_array($roleName, $roles, true)) {
                return $roleName;
            }
        }

        return 'student';
    }

    /**
     * @param  Collection<int, RoleRequest>  $relatedRequests
     * @return Collection<int, array{id: string, reason: string, reviewedBy: string, reviewedAt: ?string, submittedAt: ?string}>
     */
    public function mapRoleRequestRejectionHistory(
        RoleRequest $roleRequest,
        Collection $relatedRequests,
    ): Collection {
        return $relatedRequests
            ->filter(function (RoleRequest $historyRequest) use ($roleRequest): bool {
                return (string) $historyRequest->id !== (string) $roleRequest->id
                    && (string) $historyRequest->status === FormStatus::REJECTED->value
                    && filled($historyRequest->rejection_reason);
            })
            ->sortByDesc(fn (RoleRequest $historyRequest) => $historyRequest->reviewed_at ?? $historyRequest->updated_at ?? $historyRequest->created_at)
            ->map(function (RoleRequest $historyRequest): array {
                $reviewedAt = $historyRequest->reviewed_at ?? $historyRequest->updated_at ?? $historyRequest->created_at;

                return [
                    'id'          => (string) $historyRequest->id,
                    'reason'      => (string) $historyRequest->rejection_reason,
                    'reviewedBy'  => (string) ($historyRequest->reviewer?->name ?? '-'),
                    'reviewedAt'  => $reviewedAt?->toIso8601String(),
                    'submittedAt' => $historyRequest->created_at?->toIso8601String(),
                ];
            })
            ->values();
    }

    private function statusValue(mixed $status): string {
        if ($status instanceof FormStatus) {
            return $status->value;
        }

        return strtolower(trim((string) $status));
    }

    /**
     * @param  Collection<int, mixed>  $names
     * @return array<int, string>
     */
    private function normalizeRoleNames(Collection $names): array {
        return $names
            ->map(fn ($roleName) => strtolower((string) $roleName))
            ->values()
            ->all();
    }
}
