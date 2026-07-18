<?php

namespace Tests\Feature\Core\Notification;

use App\Enums\FormStatus;
use App\Models\User\User;
use App\Notifications\UserInvitedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class UserInvitedNotificationTest extends TestCase {
    use RefreshDatabase;

    public function test_new_user_created_with_invited_status_sends_mail_only(): void {
        Notification::fake();

        $user = User::factory()->create(['status' => FormStatus::INVITED]);

        Notification::assertSentTo($user, UserInvitedNotification::class, function ($notification) use ($user) {
            $channels = $notification->via($user);

            return in_array('mail', $channels, true)
                && ! in_array('database', $channels, true)
                && ! in_array('broadcast', $channels, true);
        });
    }

    public function test_existing_user_updated_to_invited_sends_notification_once(): void {
        Notification::fake();

        $user = User::factory()->create(['status' => FormStatus::PRE_REGISTERED]);

        Notification::assertNothingSent();

        $user->update(['status' => FormStatus::INVITED]);

        Notification::assertSentToTimes($user, UserInvitedNotification::class, 1);
    }

    public function test_user_already_invited_updated_again_does_not_resend(): void {
        Notification::fake();

        $user = User::factory()->create(['status' => FormStatus::INVITED]);

        Notification::assertSentToTimes($user, UserInvitedNotification::class, 1);

        // Field lain berubah, status tetap INVITED — tidak boleh kirim ulang.
        $user->update(['name' => 'Nama Baru']);

        Notification::assertSentToTimes($user, UserInvitedNotification::class, 1);
    }
}
