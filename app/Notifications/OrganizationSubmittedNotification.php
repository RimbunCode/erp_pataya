<?php

namespace App\Notifications;

use App\Channels\MyMailChannel;
use App\Mail\MyMailMessage;
use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class OrganizationSubmittedNotification extends BaseNotification implements ShouldQueue {
    use Queueable;

    public function __construct(public OrganizationInvitation $invitation) {}

    /**
     * @return array<int, class-string>
     */
    public function via(object $notifiable): array {
        return [MyMailChannel::class];
    }

    public function toMail(object $notifiable): MyMailMessage {
        $reviewUrl = route('admin.user');

        return (new MyMailMessage())
            ->subject("[INKINDO] {$this->invitation->organization_name} Telah Mengisi Formulir Pendaftaran")
            ->greeting("Halo {$notifiable->name},")
            ->note("Organisasi **{$this->invitation->organization_name}** yang Anda undang telah mengisi formulir pendaftaran dan menunggu persetujuan Anda.")
            ->note("**Email:** {$this->invitation->email}")
            ->note("**Contact Person:** {$this->invitation->contact_person}")
            ->button('Review Submission', $reviewUrl)
            ->regards('Sistem INKINDO');
    }
}
