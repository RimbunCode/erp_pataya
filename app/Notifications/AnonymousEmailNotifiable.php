<?php

namespace App\Notifications;

use Illuminate\Notifications\Notifiable;

/**
 * Notifiable minimal untuk mengirim ke alamat email arbitrer (bukan User
 * terdaftar) — trigger email manual bisa mengirim ke alamat mana pun yang
 * diisi user di field To, bukan hanya ke akun yang login (beda dari Test
 * Send spec 1 yang selalu mengirim ke `auth()->user()`).
 */
class AnonymousEmailNotifiable {
    use Notifiable;

    public function __construct(
        public string $email,
        public array $cc = [],
        public array $bcc = [],
    ) {}

    public function routeNotificationForMail(): string {
        return $this->email;
    }

    /**
     * Bukan Eloquent model, tapi `NotificationFake` (dipakai `Notification::fake()`
     * di test) mengharuskan notifiable punya `getKey()` untuk mengindeks
     * notifikasi yang tercatat. Alamat email itu sendiri sudah unik cukup
     * untuk keperluan ini.
     */
    public function getKey(): string {
        return $this->email;
    }
}
