<?php

namespace Tests\Feature\Core\Notification;

use App\Jobs\Core\Notification\SendNotificationMailJob;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use RuntimeException;
use Tests\TestCase;

class SendNotificationMailJobTestNotification extends Notification {
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)->subject('test-subject')->line('test-body');
    }
}

class SendNotificationMailJobTestFailingNotification extends Notification {
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        throw new RuntimeException('render gagal sengaja untuk test');
    }
}

class SendNotificationMailJobTest extends TestCase {
    use RefreshDatabase;

    public function test_handle_sends_mail_notification(): void {
        NotificationFacade::fake();

        $user = User::factory()->create();
        $job  = new SendNotificationMailJob($user, new SendNotificationMailJobTestNotification);
        $job->handle();

        NotificationFacade::assertSentTo($user, SendNotificationMailJobTestNotification::class);
    }

    public function test_failed_logs_error_and_does_not_touch_notifications_table(): void {
        Log::spy();

        $user = User::factory()->create();
        $job  = new SendNotificationMailJob($user, new SendNotificationMailJobTestFailingNotification);

        try {
            $job->handle();
        } catch (RuntimeException) {
            // dilempar ulang oleh sendNow() saat toMail() gagal — sengaja
            // ditangkap di sini untuk memicu failed() secara manual seperti
            // yang dilakukan queue worker sungguhan
            $job->failed(new RuntimeException('render gagal sengaja untuk test'));
        }

        Log::shouldHaveReceived('error')
            ->once()
            ->withArgs(fn ($message, $context) => $message === 'SendNotificationMailJob gagal — email notifikasi tidak terkirim'
                && $context['notification'] === SendNotificationMailJobTestFailingNotification::class);

        $this->assertDatabaseMissing('notifications', [
            'notifiable_id'   => $user->id,
            'notifiable_type' => User::class,
        ]);
    }
}
