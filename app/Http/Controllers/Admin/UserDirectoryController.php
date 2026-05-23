<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectInstructorRoleRequestRequest;
use App\Http\Requests\Admin\UpdateUserStatusRequest;
use App\Models\RoleRequest;
use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Auth\UserRoleManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserDirectoryController extends Controller {
    public function __construct(private UserRoleManager $userRoleManager) {}

    public function index(): Response {
        $users = User::query()
            ->with([
                'roles:id,name',
                'roles.rules:id,role_id,name',
                'inactiveByUser:id,name',
            ])
            ->latest('created_at')
            ->get();

        $usersPayload = $users->map(function (User $user): array {
            $roleNames = $user->roles
                ->pluck('name')
                ->map(fn ($roleName) => strtolower((string) $roleName))
                ->values()
                ->all();

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
        })->values();

        $requestsPayload = RoleRequest::query()
            ->with([
                'user:id,name,email',
                'user.roles:id,name',
                'reviewer:id,name',
                'proofFile:id,name,extension',
            ])
            ->where('requested_role', 'instructor')
            ->latest('created_at')
            ->get()
            ->map(function (RoleRequest $request): array {
                $requesterRoleNames = $request->user
                    ? $request->user->roles
                        ->pluck('name')
                        ->map(fn ($roleName) => strtolower((string) $roleName))
                        ->all()
                    : [];

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
                    'approvedBy'   => $request->status === FormStatus::APPROVED->value ? $request->reviewer?->name : null,
                    'approvedAt'   => $request->status === FormStatus::APPROVED->value ? $request->reviewed_at?->toIso8601String() : null,
                    'rejectedBy'   => $request->status === FormStatus::REJECTED->value ? $request->reviewer?->name : null,
                    'rejectedAt'   => $request->status === FormStatus::REJECTED->value ? $request->reviewed_at?->toIso8601String() : null,
                    'rejectReason' => $request->rejection_reason,
                ];
            })
            ->values();

        $adminsPayload = $users
            ->filter(fn (User $user) => $user->roles->pluck('name')->map(fn ($roleName) => strtolower((string) $roleName))->contains('admin'))
            ->map(function (User $user): array {
                $permissions = $user->roles
                    ->flatMap(fn (Role $role) => $role->rules->pluck('name'))
                    ->map(fn ($permissionName) => (string) $permissionName)
                    ->unique()
                    ->values()
                    ->all();

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
            })
            ->values();

        return Inertia::render('Admin/UserDirectory/index', [
            'users'    => $usersPayload,
            'requests' => $requestsPayload,
            'admins'   => $adminsPayload,
            'orgs'     => [],
            'orgsMeta' => [
                'ready'   => false,
                'message' => 'Organizations backend integration is not implemented yet.',
            ],
        ]);
    }

    public function approveRequest(RoleRequest $roleRequest): RedirectResponse {
        $this->ensurePendingInstructorRequest($roleRequest);

        DB::transaction(function () use ($roleRequest): void {
            $this->userRoleManager->attachInstructorRole($roleRequest->user);

            $roleRequest->update([
                'status'           => FormStatus::APPROVED->value,
                'reviewed_by'      => auth()->id(),
                'reviewed_at'      => now(),
                'rejection_reason' => null,
            ]);
        });

        return back()->with('success', 'Permintaan role instructor disetujui.');
    }

    public function rejectRequest(RejectInstructorRoleRequestRequest $request, RoleRequest $roleRequest): RedirectResponse {
        $this->ensurePendingInstructorRequest($roleRequest);
        $validated = $request->validated();

        $roleRequest->update([
            'status'           => FormStatus::REJECTED->value,
            'reviewed_by'      => auth()->id(),
            'reviewed_at'      => now(),
            'rejection_reason' => $validated['reason'],
        ]);

        return back()->with('success', 'Permintaan role instructor ditolak.');
    }

    public function updateUserStatus(UpdateUserStatusRequest $request, User $user): RedirectResponse {
        $validated  = $request->validated();
        $isInactive = $validated['status'] === FormStatus::INACTIVE->value;

        $user->update([
            'status'          => $isInactive ? FormStatus::INACTIVE : FormStatus::ACTIVE,
            'inactive_reason' => $isInactive ? $validated['reason'] : null,
            'inactive_by'     => $isInactive ? auth()->id() : null,
            'inactive_at'     => $isInactive ? now() : null,
        ]);

        return back()->with('success', 'Status user berhasil diperbarui.');
    }

    private function ensurePendingInstructorRequest(RoleRequest $roleRequest): void {
        if (
            $roleRequest->requested_role !== 'instructor'
            || $roleRequest->status !== FormStatus::PENDING->value
        ) {
            throw ValidationException::withMessages([
                'request' => 'Request ini tidak dapat diproses.',
            ]);
        }
    }

    /**
     * @param  array<int, string>  $roles
     */
    private function resolveDisplayRole(array $roles): string {
        foreach (['admin', 'organization', 'instructor', 'student'] as $roleName) {
            if (\in_array($roleName, $roles, true)) {
                return $roleName;
            }
        }

        return 'student';
    }

    private function statusValue(mixed $status): string {
        if ($status instanceof FormStatus) {
            return $status->value;
        }

        return strtolower(trim((string) $status));
    }

    private function initials(string $name): string {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts));

        if (\count($parts) === 0) {
            return 'NA';
        }

        $first  = mb_substr($parts[0], 0, 1);
        $second = \count($parts) > 1 ? mb_substr($parts[1], 0, 1) : '';

        return mb_strtoupper($first . $second);
    }
}
