<?php

namespace App\Notifications;

use App\Channels\MyMailChannel;
use App\Mail\MyMailMessage;
use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class OrganizationRejectedNotification extends BaseNotification implements ShouldQueue {
    use Queueable;

    public function __construct(public OrganizationInvitation $invitation) {}

    /**
     * @return array<int, class-string>
     */
    public function via(object $notifiable): array {
        return [MyMailChannel::class];
    }

    public function toMail(object $notifiable): MyMailMessage {
        $contactUrl = route('guest.contact');

        return (new MyMailMessage())
            ->subject('Registrasi Organisasi Ditolak - INKINDO')
            ->greeting("Halo {$this->invitation->contact_person},")
            ->note("Mohon maaf, pendaftaran organisasi **{$this->invitation->organization_name}** belum dapat kami setujui saat ini.")
            ->note("**Alasan penolakan:** {$this->invitation->rejection_reason}")
            ->button('Hubungi Admin', $contactUrl)
            ->regards('Tim INKINDO');
    }
}
