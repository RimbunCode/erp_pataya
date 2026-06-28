<?php

namespace App\Services\Admin;

use App\FormStatus;
use App\Models\OrganizationInvitation;
use App\Models\User\User;
use App\Notifications\OrganizationApprovedNotification;
use App\Notifications\OrganizationInvitationNotification;
use App\Notifications\OrganizationRejectedNotification;
use App\Notifications\OrganizationSubmittedNotification;
use App\Services\Auth\UserRoleManager;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrganizationInvitationService {
    public function __construct(
        private UserRoleManager $userRoleManager,
    ) {}

    public function sendInvitation(array $data, User $invitedBy): OrganizationInvitation {
        return DB::transaction(function () use ($data, $invitedBy): OrganizationInvitation {
            $invitation = OrganizationInvitation::create([
                'token'             => Str::random(64),
                'organization_name' => $data['organization_name'],
                'email'             => $data['email'],
                'contact_person'    => $data['contact_person'],
                'status'            => FormStatus::INVITED,
                'invited_by'        => $invitedBy->id,
                'expired_at'        => now()->addDays(7),
            ]);

            $this->dispatchNotification(
                $invitation,
                new OrganizationInvitationNotification($invitation),
            );

            return $invitation;
        });
    }

    public function completeProfile(OrganizationInvitation $invitation, array $data): OrganizationInvitation {
        if ($invitation->isExpired()) {
            throw ValidationException::withMessages([
                'token' => 'Undangan ini sudah kedaluwarsa. Silakan hubungi admin.',
            ]);
        }

        if ($invitation->status !== FormStatus::INVITED) {
            throw ValidationException::withMessages([
                'token' => 'Undangan ini sudah diproses.',
            ]);
        }

        return DB::transaction(function () use ($invitation, $data): OrganizationInvitation {
            $invitation->update([
                'organization_name' => $data['organization_name'],
                'email'             => $data['email'],
                'contact_person'    => $data['contact_person'],
                'address'           => $data['address'] ?? null,
                'phone'             => $data['phone'] ?? null,
                'website'           => $data['website'] ?? null,
                'industry'          => $data['industry'] ?? null,
                'employee_count'    => $data['employee_count'] ?? null,
                'logo_file_id'      => $data['logo_file_id'] ?? null,
                'password'          => $data['password'],
                'status'            => FormStatus::SUBMITTED,
                'submitted_at'      => now(),
            ]);

            $invitation->loadMissing('invitedBy');
            if ($invitation->invitedBy) {
                $invitation->invitedBy->notify(
                    new OrganizationSubmittedNotification($invitation),
                );
            }

            return $invitation->refresh();
        });
    }

    public function approve(OrganizationInvitation $invitation, User $reviewer): void {
        if ($invitation->status !== FormStatus::SUBMITTED) {
            throw ValidationException::withMessages([
                'invitation' => 'Undangan ini belum dikirimkan oleh organisasi.',
            ]);
        }

        DB::transaction(function () use ($invitation, $reviewer): void {
            $user = User::where('email', $invitation->email)->first();

            // getRawOriginal returns the already-hashed value stored in DB.
            // Both OrganizationInvitation and User have 'password' => 'hashed' cast,
            // so we bypass User's cast by using forceFill + saveQuietly.
            $hashedPassword = $invitation->getRawOriginal('password');

            if ($user) {
                if ($user->status === FormStatus::INVITED) {
                    $user->forceFill([
                        'name'     => $invitation->contact_person,
                        'password' => $hashedPassword,
                        'phone'    => $invitation->phone,
                        'status'   => FormStatus::ACTIVE,
                    ])->saveQuietly();
                }
            } else {
                $user = new User();
                $user->forceFill([
                    'name'     => $invitation->contact_person,
                    'email'    => $invitation->email,
                    'password' => $hashedPassword,
                    'phone'    => $invitation->phone,
                    'status'   => FormStatus::ACTIVE,
                ]);
                $user->save();
            }

            $this->userRoleManager->attachOrganizationRole($user);

            if ($invitation->logo_file_id) {
                $user->update(['image' => $invitation->logo_file_id]);
            }

            $invitation->update([
                'status'      => FormStatus::APPROVED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'user_id'     => $user->id,
            ]);

            // Clear the stored password from invitations table after account is created
            DB::table('organization_invitations')
                ->where('id', $invitation->id)
                ->update(['password' => null]);

            $this->dispatchNotification(
                $invitation,
                new OrganizationApprovedNotification($invitation),
            );
        });
    }

    public function reject(OrganizationInvitation $invitation, User $reviewer, string $reason): void {
        if ($invitation->status !== FormStatus::SUBMITTED) {
            throw ValidationException::withMessages([
                'invitation' => 'Undangan ini belum dikirimkan oleh organisasi.',
            ]);
        }

        $invitation->update([
            'status'           => FormStatus::REJECTED,
            'reviewed_by'      => $reviewer->id,
            'reviewed_at'      => now(),
            'rejection_reason' => $reason,
        ]);

        $this->dispatchNotification(
            $invitation,
            new OrganizationRejectedNotification($invitation),
        );
    }

    public function resendInvitation(OrganizationInvitation $invitation): void {
        if ($invitation->status !== FormStatus::INVITED) {
            throw ValidationException::withMessages([
                'invitation' => 'Hanya undangan yang belum diproses yang bisa dikirim ulang.',
            ]);
        }

        if ($invitation->isExpired()) {
            $invitation->update(['expired_at' => now()->addDays(7)]);
        }

        $this->dispatchNotification(
            $invitation,
            new OrganizationInvitationNotification($invitation),
        );
    }

    private function dispatchNotification(OrganizationInvitation $invitation, object $notification): void {
        $notifiable = new AnonymousNotifiable;
        $notifiable->route('mail', $invitation->email);
        $notifiable->notify($notification);
    }
}
