<?php

namespace Tests\Unit\Core\Notification;

use App\Jobs\Core\Notification\SendNotificationMailJob;
use App\Models\User\User;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class NotifyUserTestFullChannelNotification extends Notification {
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        return ['title' => 'full-channel'];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)->subject('full-channel')->line('test');
    }
}

class NotifyUserTestMailOnlyNotification extends Notification {
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)->subject('mail-only')->line('test');
    }
}

class NotifyUserTestSyncOnlyNotification extends Notification {
    public function via(object $notifiable): array {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array {
        return ['title' => 'sync-only'];
    }
}

class NotifyUserTest extends TestCase {
    use RefreshDatabase;

    public function test_full_channel_notification_stores_database_record_and_dispatches_mail_job(): void {
        Queue::fake();

        $user = User::factory()->create();

        app(NotifyUser::class)->send($user, new NotifyUserTestFullChannelNotification);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id'   => $user->id,
            'notifiable_type' => User::class,
            'type'            => NotifyUserTestFullChannelNotification::class,
        ]);

        Queue::assertPushed(SendNotificationMailJob::class, fn ($job) => $job->notifiable->is($user)
            && $job->notification instanceof NotifyUserTestFullChannelNotification);
    }

    public function test_mail_only_notification_does_not_store_database_record_but_dispatches_mail_job(): void {
        Queue::fake();

        $user = User::factory()->create();

        app(NotifyUser::class)->send($user, new NotifyUserTestMailOnlyNotification);

        $this->assertDatabaseMissing('notifications', [
            'notifiable_id'   => $user->id,
            'notifiable_type' => User::class,
        ]);

        Queue::assertPushed(SendNotificationMailJob::class);
    }

    public function test_sync_only_notification_stores_database_record_without_dispatching_mail_job(): void {
        Queue::fake();

        $user = User::factory()->create();

        app(NotifyUser::class)->send($user, new NotifyUserTestSyncOnlyNotification);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id'   => $user->id,
            'notifiable_type' => User::class,
            'type'            => NotifyUserTestSyncOnlyNotification::class,
        ]);

        Queue::assertNotPushed(SendNotificationMailJob::class);
    }
}
