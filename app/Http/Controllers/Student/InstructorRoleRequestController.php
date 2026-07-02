<?php

namespace App\Http\Controllers\Student;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StoreInstructorRoleRequestRequest;
use App\Models\Core\File;
use App\Models\RoleRequest;
use App\Models\User\User;
use App\Notifications\InstructorRoleRequestSubmittedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class InstructorRoleRequestController extends Controller {
    public function store(StoreInstructorRoleRequestRequest $request) {
        $user = $request->user()->loadMissing('roles');

        if ($user->roles->pluck('name')->map(fn ($roleName) => strtolower((string) $roleName))->contains('instructor')) {
            throw ValidationException::withMessages([
                'notes' => 'Akun ini sudah memiliki role instructor.',
            ]);
        }

        $hasPendingRequest = RoleRequest::query()
            ->where('user_id', $user->id)
            ->where('requested_role', 'instructor')
            ->where('status', FormStatus::PENDING->value)
            ->exists();

        if ($hasPendingRequest) {
            throw ValidationException::withMessages([
                'notes' => 'Masih ada request instructor yang menunggu verifikasi.',
            ]);
        }

        $validated   = $request->validated();
        $proofFileId = null;
        $roleRequest = null;

        DB::transaction(function () use ($request, $user, $validated, &$proofFileId, &$roleRequest): void {
            File::uploadFile($request, 'InstructorRoleProof', function (File $file) use (&$proofFileId): void {
                $proofFileId = $file->id;
            });

            if ($proofFileId === null) {
                throw ValidationException::withMessages([
                    'files' => 'Bukti instructor gagal diunggah.',
                ]);
            }

            $roleRequest = RoleRequest::query()->create([
                'user_id'        => $user->id,
                'requested_role' => 'instructor',
                'reason'         => $validated['notes'],
                'proof_file_id'  => $proofFileId,
                'status'         => FormStatus::PENDING->value,
            ]);
        });

        $adminRecipients = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->whereHas('adminPermissions', fn ($q) => $q->whereIn('name', ['user_admin', 'super_admin']))
            ->get();

        if ($roleRequest && $adminRecipients->isNotEmpty()) {
            $roleRequest->setRelation('user', $user);
            Notification::send($adminRecipients, new InstructorRoleRequestSubmittedNotification($roleRequest));
        }

        return back()->with('success', 'Permintaan role instructor berhasil dikirim.');
    }
}
