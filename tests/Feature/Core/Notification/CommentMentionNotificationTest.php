<?php

namespace Tests\Feature\Core\Notification;

use App\Models\Asset\AssetService;
use App\Models\Core\Log;
use App\Models\Helpdesk\Ticket;
use App\Models\User\User;
use App\Notifications\CommentMentionNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;
use Tests\Support\GrantsDocumentAccess;
use Tests\TestCase;

class CommentMentionNotificationTest extends TestCase {
    use GrantsDocumentAccess;
    use RefreshDatabase;

    private User $actor;

    protected function setUp(): void {
        parent::setUp();

        $this->prepareDocumentPermission();
        $this->actor = User::factory()->create();
    }

    private function asActor(): static {
        return $this
            ->withSession($this->actorSession())
            ->withCookie('lang', 'en')
            ->actingAs($this->actor);
    }

    private function readerWithAccess(bool $onlyCreator = false): User {
        $user = User::factory()->create();
        $this->grantDocumentAccess($user, $onlyCreator);

        return $user;
    }

    private function mentionCount(): int {
        return DatabaseNotification::where('type', CommentMentionNotification::class)->count();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function postComment(AssetService $order, array $payload): void {
        $this->asActor()
            ->post(route('assetServices.addComment', $order), $payload)
            ->assertRedirect();
    }

    public function test_mentioned_user_with_read_access_is_notified(): void {
        Notification::fake();
        $order     = $this->makeDocument();
        $mentioned = $this->readerWithAccess();

        $this->postComment($order, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($mentioned->id),
        ]);

        Notification::assertSentTo(
            $mentioned,
            CommentMentionNotification::class,
            fn (CommentMentionNotification $n) => $n->toArray($mentioned)['documentType'] === AssetService::class
                && $n->toArray($mentioned)['documentId'] === $order->id,
        );
    }

    public function test_notification_is_persisted_pointing_at_the_parent_document(): void {
        $order     = $this->makeDocument();
        $mentioned = $this->readerWithAccess();

        $this->postComment($order, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($mentioned->id),
        ]);

        $stored = DatabaseNotification::where('notifiable_id', $mentioned->id)
            ->where('type', CommentMentionNotification::class)
            ->firstOrFail();
        $this->assertSame(AssetService::class, $stored->data['documentType']);
        $this->assertSame($order->id, $stored->data['documentId']);
        $this->assertArrayHasKey('title', $stored->data);
        $this->assertArrayHasKey('message', $stored->data);
    }

    public function test_self_mention_is_not_notified(): void {
        Notification::fake();
        $order = $this->makeDocument();
        $this->grantDocumentAccess($this->actor);

        $this->postComment($order, [
            'comment'      => '<p>Catatan untuk @Someone</p>',
            'comment_json' => $this->mentionJson($this->actor->id),
        ]);

        Notification::assertSentTimes(CommentMentionNotification::class, 0);
    }

    public function test_user_without_read_permission_is_not_notified_even_when_id_is_forged(): void {
        Notification::fake();
        $order     = $this->makeDocument();
        $noAccess  = User::factory()->create();
        $writeOnly = User::factory()->create();
        $this->grantDocumentAccess($writeOnly, false, ['select' => true, 'read' => false, 'write' => true]);

        $this->postComment($order, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($noAccess->id, $writeOnly->id),
        ]);

        Notification::assertSentTimes(CommentMentionNotification::class, 0);
    }

    public function test_user_with_only_a_disabled_role_is_not_notified(): void {
        Notification::fake();
        $order    = $this->makeDocument();
        $disabled = User::factory()->create();
        $this->grantDocumentAccess($disabled, false, ['read' => true], roleDisabled: true);

        $this->postComment($order, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($disabled->id),
        ]);

        Notification::assertSentTimes(CommentMentionNotification::class, 0);
    }

    public function test_only_creator_user_is_notified_only_for_their_own_document(): void {
        Notification::fake();
        $ownerOnly = $this->readerWithAccess(onlyCreator: true);

        $othersOrder = $this->makeDocument();
        $this->postComment($othersOrder, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($ownerOnly->id),
        ]);
        Notification::assertSentTimes(CommentMentionNotification::class, 0);

        $ownOrder = $this->makeDocument($ownerOnly->id);
        $this->postComment($ownOrder, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($ownerOnly->id),
        ]);
        Notification::assertSentTo($ownerOnly, CommentMentionNotification::class);
    }

    public function test_non_only_creator_entry_wins_over_only_creator_entry(): void {
        Notification::fake();
        $order = $this->makeDocument();
        $user  = User::factory()->create();
        $this->grantDocumentAccess($user, onlyCreator: true);
        $this->grantDocumentAccess($user, onlyCreator: false);

        $this->postComment($order, [
            'comment'      => '<p>Halo @Someone</p>',
            'comment_json' => $this->mentionJson($user->id),
        ]);

        Notification::assertSentTo($user, CommentMentionNotification::class);
    }

    public function test_model_that_ignores_permission_notifies_any_mentioned_user(): void {
        Notification::fake();
        $ticket    = Ticket::factory()->create();
        $mentioned = User::factory()->create();

        $session                               = $this->actorSession();
        $session['permissions'][Ticket::class] = [0 => [[
            'model'        => Ticket::class,
            'level'        => 0,
            'only_creator' => false,
            'permissions'  => ['read' => true],
        ]]];

        $this->withSession($session)
            ->withCookie('lang', 'en')
            ->actingAs($this->actor)
            ->post(route('tickets.addComment', $ticket), [
                'comment'      => '<p>Halo @Someone</p>',
                'comment_json' => $this->mentionJson($mentioned->id),
            ])
            ->assertRedirect();

        Notification::assertSentTo($mentioned, CommentMentionNotification::class);
    }

    public function test_html_fallback_is_used_when_comment_json_is_missing(): void {
        Notification::fake();
        $order     = $this->makeDocument();
        $first     = $this->readerWithAccess();
        $second    = $this->readerWithAccess();
        $bystander = $this->readerWithAccess();

        $this->postComment($order, [
            'comment' => '<p><span data-type="mention" data-id="' . $first->id . '" class="mention">@A</span> '
                . '<span class="mention" data-id="' . $second->id . '" data-type="mention">@B</span> '
                . '<span data-id="' . $bystander->id . '">bukan mention</span></p>',
        ]);

        Notification::assertSentTo($first, CommentMentionNotification::class);
        Notification::assertSentTo($second, CommentMentionNotification::class);
        Notification::assertNotSentTo($bystander, CommentMentionNotification::class);
    }

    public function test_edit_notifies_only_newly_added_mentions(): void {
        Notification::fake();
        $order    = $this->makeDocument();
        $existing = $this->readerWithAccess();
        $added    = $this->readerWithAccess();

        $log = Log::create([
            'user_id'       => $this->actor->id,
            'loggable_id'   => $order->id,
            'loggable_type' => AssetService::class,
            'type'          => 'comment',
            'activity'      => '<p>Halo @Someone</p>',
            'comment_json'  => $this->mentionJson($existing->id),
        ]);

        $this->asActor()
            ->put(route('assetServices.editComment', [$order, $log]), [
                'comment'      => '<p>Halo @Someone @Someone</p>',
                'comment_json' => $this->mentionJson($existing->id, $added->id),
            ])
            ->assertRedirect();

        Notification::assertSentTo($added, CommentMentionNotification::class);
        Notification::assertNotSentTo($existing, CommentMentionNotification::class);
        $this->assertSame(
            $this->mentionJson($existing->id, $added->id),
            $log->fresh()->comment_json,
        );
    }

    public function test_edit_without_new_mentions_sends_nothing(): void {
        $order    = $this->makeDocument();
        $existing = $this->readerWithAccess();

        $log = Log::create([
            'user_id'       => $this->actor->id,
            'loggable_id'   => $order->id,
            'loggable_type' => AssetService::class,
            'type'          => 'comment',
            'activity'      => '<p>Halo @Someone</p>',
            'comment_json'  => $this->mentionJson($existing->id),
        ]);

        $this->asActor()
            ->put(route('assetServices.editComment', [$order, $log]), [
                'comment'      => '<p>Halo lagi @Someone</p>',
                'comment_json' => $this->mentionJson($existing->id),
            ])
            ->assertRedirect();

        $this->assertSame(0, $this->mentionCount());
    }

    public function test_edit_does_not_notify_forged_or_unauthorized_new_mention(): void {
        Notification::fake();
        $order    = $this->makeDocument();
        $noAccess = User::factory()->create();

        $log = Log::create([
            'user_id'       => $this->actor->id,
            'loggable_id'   => $order->id,
            'loggable_type' => AssetService::class,
            'type'          => 'comment',
            'activity'      => '<p>Halo</p>',
            'comment_json'  => null,
        ]);

        $this->asActor()
            ->put(route('assetServices.editComment', [$order, $log]), [
                'comment'      => '<p>Halo @Someone</p>',
                'comment_json' => $this->mentionJson($noAccess->id),
            ])
            ->assertRedirect();

        Notification::assertSentTimes(CommentMentionNotification::class, 0);
    }
}
