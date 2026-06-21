<?php

namespace App\Notifications;

use App\Channels\MyMailChannel;
use App\Mail\MyMailMessage;
use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class OrganizationInvitationNotification extends BaseNotification implements ShouldQueue {
    use Queueable;

    public function __construct(public OrganizationInvitation $invitation) {}

    /**
     * @return array<int, class-string>
     */
    public function via(object $notifiable): array {
        return [MyMailChannel::class];
    }

    public function toMail(object $notifiable): MyMailMessage {
        $url = route('organization.complete', ['token' => $this->invitation->token]);

        return (new MyMailMessage())
            ->subject('Undangan Registrasi Organisasi - INKINDO')
            ->greeting("Halo {$this->invitation->contact_person},")
            ->note("Anda telah diundang untuk mendaftarkan organisasi **{$this->invitation->organization_name}** di platform INKINDO. Silakan lengkapi profil organisasi Anda melalui tautan di bawah ini.")
            ->button('Lengkapi Profil Organisasi', $url)
            ->buttonNote('Tautan ini berlaku selama 7 hari sejak undangan dikirim.')
            ->regards('Tim INKINDO');
    }
}
