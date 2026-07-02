<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectInstructorRoleRequestRequest;
use App\Http\Requests\Admin\UpdateAdminPermissionsRequest;
use App\Http\Requests\Admin\UpdateUserStatusRequest;
use App\Models\OrganizationInvitation;
use App\Models\RoleRequest;
use App\Models\User\User;
use App\Notifications\InstructorRoleRequestApprovedNotification;
use App\Notifications\InstructorRoleRequestRejectedNotification;
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

        $orgInvitations = OrganizationInvitation::query()
            ->with(['invitedBy:id,name', 'reviewedBy:id,name', 'user:id,name'])
            ->latest('created_at')
            ->get();

        $orgsPayload = $orgInvitations->map(fn (OrganizationInvitation $inv) => [
            'id'               => (string) $inv->id,
            'organizationName' => $inv->organization_name,
            'email'            => $inv->email,
            'contactPerson'    => $inv->contact_person,
            'address'          => $inv->address,
            'phone'            => $inv->phone,
            'website'          => $inv->website,
            'industry'         => $inv->industry,
            'employeeCount'    => $inv->employee_count,
            'status'           => $inv->status->value,
            'invitedBy'        => $inv->invitedBy?->name ?? '-',
            'invitedAt'        => $inv->created_at->toIso8601String(),
            'submittedAt'      => $inv->submitted_at?->toIso8601String(),
            'reviewedBy'       => $inv->reviewedBy?->name,
            'reviewedAt'       => $inv->reviewed_at?->toIso8601String(),
            'rejectionReason'  => $inv->rejection_reason,
            'userId'           => $inv->user_id ? (string) $inv->user_id : null,
            'isExpired'        => $inv->isExpired(),
        ])->values();

        return Inertia::render('Admin/UserDirectory/index', [
            'users'                     => $usersPayload,
            'requests'                  => $requestsPayload,
            'admins'                    => $adminsPayload,
            'canManageAdminPermissions' => $authUser ? $this->adminPermissionService->canManageAdminPermissions($authUser) : false,
            'orgs'                      => $orgsPayload,
            'orgsMeta'                  => [
                'ready' => true,
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

        $roleRequest->user?->notify(new InstructorRoleRequestApprovedNotification($roleRequest));

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

        $roleRequest->user?->notify(new InstructorRoleRequestRejectedNotification($roleRequest));

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
