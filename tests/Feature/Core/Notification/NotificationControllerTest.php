<?php

namespace Tests\Feature\Core\Notification;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationControllerTest extends TestCase {
    use RefreshDatabase;

    private function createNotificationFor(User $user, ?string $readAt = null): DatabaseNotification {
        return DatabaseNotification::create([
            'id'              => (string) Str::uuid(),
            'type'            => 'App\\Notifications\\ApprovalDecidedNotification',
            'notifiable_type' => User::class,
            'notifiable_id'   => $user->id,
            'data'            => ['title' => 'Test', 'message' => 'Test message'],
            'read_at'         => $readAt,
        ]);
    }

    private function actingWithoutExtraMiddleware(User $user) {
        return $this->actingAs($user)
            ->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class]);
    }

    public function test_index_returns_only_authenticated_users_notifications(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();

        $this->createNotificationFor($user);
        $this->createNotificationFor($otherUser);

        $response = $this->actingWithoutExtraMiddleware($user)->getJson(route('notifications.index'));

        $response->assertOk();
        $this->assertCount(1, $response->json('notifications'));
        $this->assertSame(1, $response->json('unread_count'));
    }

    public function test_mark_as_read_updates_read_at_without_affecting_other_users(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();

        $notification      = $this->createNotificationFor($user);
        $otherNotification = $this->createNotificationFor($otherUser);

        $response = $this->actingWithoutExtraMiddleware($user)
            ->postJson(route('notifications.read', $notification->id));

        $response->assertOk();
        $this->assertNotNull($notification->fresh()->read_at);
        $this->assertNull($otherNotification->fresh()->read_at);
    }

    public function test_mark_as_read_cannot_target_another_users_notification(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();

        $otherNotification = $this->createNotificationFor($otherUser);

        $response = $this->actingWithoutExtraMiddleware($user)
            ->postJson(route('notifications.read', $otherNotification->id));

        $response->assertNotFound();
        $this->assertNull($otherNotification->fresh()->read_at);
    }

    public function test_mark_all_as_read_marks_every_unread_notification_for_that_user(): void {
        $user = User::factory()->create();

        $first  = $this->createNotificationFor($user);
        $second = $this->createNotificationFor($user);

        $response = $this->actingWithoutExtraMiddleware($user)->postJson(route('notifications.readAll'));

        $response->assertOk();
        $this->assertNotNull($first->fresh()->read_at);
        $this->assertNotNull($second->fresh()->read_at);
    }
}
