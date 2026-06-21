<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectInstructorRoleRequestRequest;
use App\Http\Requests\Admin\UpdateAdminPermissionsRequest;
use App\Http\Requests\Admin\UpdateUserStatusRequest;
use App\Models\RoleRequest;
use App\Models\User\User;
use App\Services\Admin\AdminPermissionService;
use App\Services\Admin\UserTransformer;
use App\Services\Auth\UserRoleManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserDirectoryController extends Controller {
    public function __construct(
        private UserRoleManager $userRoleManager,
        private AdminPermissionService $adminPermissionService,
        private UserTransformer $userTransformer,
    ) {}

    public function index(): Response {
        $users = User::query()
            ->with([
                'roles:id,name',
                'roles.rules:id,role_id,name',
                'inactiveByUser:id,name',
            ])
            ->latest('created_at')
            ->get();

        $usersPayload = $users->map(
            fn (User $user) => $this->userTransformer->transformUser($user),
        )->values();

        $roleRequests = RoleRequest::query()
            ->with([
                'user:id,name,email',
                'user.roles:id,name',
                'reviewer:id,name',
                'proofFile:id,name,extension',
            ])
            ->where('requested_role', 'instructor')
            ->latest('created_at')
            ->get();

        $requestsByContext = $roleRequests->groupBy(
            fn (RoleRequest $request) => $this->userTransformer->roleRequestHistoryKey($request),
        );

        $requestsPayload = $roleRequests->map(
            fn (RoleRequest $request) => $this->userTransformer->transformRoleRequest($request, $requestsByContext),
        )->values();

        $adminsPayload = $users
            ->filter(fn (User $user) => $user->roles->pluck('name')->map(fn ($roleName) => strtolower((string) $roleName))->contains('admin'))
            ->map(fn (User $user) => $this->userTransformer->transformAdmin($user, $this->adminPermissionService))
            ->values();

        $authUser = request()->user();

        return Inertia::render('Admin/UserDirectory/index', [
            'users'                     => $usersPayload,
            'requests'                  => $requestsPayload,
            'admins'                    => $adminsPayload,
            'canManageAdminPermissions' => $authUser ? $this->adminPermissionService->canManageAdminPermissions($authUser) : false,
            'orgs'                      => [],
            'orgsMeta'                  => [
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

    public function updateAdminPermissions(UpdateAdminPermissionsRequest $request, User $user): RedirectResponse {
        $actor = $request->user();
        if (! $actor) {
            abort(401);
        }

        $validated = $request->validated();
        $this->adminPermissionService->syncAdminPermissions(
            $actor,
            $user,
            $validated['permissions'] ?? [],
        );

        return back()->with('success', 'Permission admin berhasil diperbarui.');
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
}
