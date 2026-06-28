<?php

namespace App\Notifications;

use App\Channels\MyMailChannel;
use App\Mail\MyMailMessage;
use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class OrganizationApprovedNotification extends BaseNotification implements ShouldQueue {
    use Queueable;

    public function __construct(public OrganizationInvitation $invitation) {}

    /**
     * @return array<int, class-string>
     */
    public function via(object $notifiable): array {
        return [MyMailChannel::class];
    }

    public function toMail(object $notifiable): MyMailMessage {
        $loginUrl = route('login');

        return (new MyMailMessage())
            ->subject('Organisasi Anda Telah Disetujui - INKINDO')
            ->greeting("Halo {$this->invitation->contact_person},")
            ->note("Selamat! Pendaftaran organisasi **{$this->invitation->organization_name}** telah disetujui oleh admin INKINDO. Anda sekarang dapat mengakses dashboard organisasi dan mulai mengelola pelatihan korporat.")
            ->note("Email login Anda: **{$this->invitation->email}**")
            ->note("Gunakan password yang Anda buat saat mengisi formulir pendaftaran.")
            ->button('Login ke Dashboard', $loginUrl)
            ->regards('Tim INKINDO');
    }
}
