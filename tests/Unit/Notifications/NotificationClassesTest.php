<?php

namespace Tests\Unit\Notifications;

use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model;
use App\Models\User\User;
use App\Notifications\ApprovalCanceledNotification;
use App\Notifications\ApprovalDecidedNotification;
use App\Notifications\ApprovalPendingNotification;
use App\Notifications\DocumentSubmittedNotification;
use App\Notifications\UserInvitedNotification;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Events\BroadcastNotificationCreated;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NotificationClassesTestDocument extends Model {
    protected $table   = 'notification_classes_test_documents';
    protected $guarded = ['id'];
}

class NotificationClassesTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('notification_classes_test_documents')) {
            Schema::create('notification_classes_test_documents', function ($table): void {
                $table->id();
                $table->string('code')->nullable();
                $table->string('name')->nullable();
                $table->char('created_by_id', 26)->nullable();
                $table->timestamps();
            });
        }
    }

    protected function makeDocument(User $creator): NotificationClassesTestDocument {
        return NotificationClassesTestDocument::create([
            'code'          => 'DOC-001',
            'name'          => 'Test Document',
            'created_by_id' => $creator->id,
        ]);
    }

    public function test_approval_decided_notification_via_and_array(): void {
        $creator  = User::factory()->create();
        $document = $this->makeDocument($creator);

        $approval = new ApprovalInstance;
        $approval->setRelation('document', $document);

        $notification = new ApprovalDecidedNotification($approval, 'approved', 'catatan approver');

        $this->assertSame(['database', 'broadcast', 'mail'], $notification->via($creator));

        $data = $notification->toArray($creator);
        $this->assertStringContainsString('DOC-001', $data['message']);
        $this->assertSame(NotificationClassesTestDocument::class, $data['documentType']);
        $this->assertSame($document->getKey(), $data['documentId']);
        $this->assertSame('catatan approver', $data['notes']);

        $mail = $notification->toMail($creator);
        $this->assertInstanceOf(MailMessage::class, $mail);

        $broadcast = $notification->toBroadcast($creator);
        $this->assertInstanceOf(BroadcastMessage::class, $broadcast);
    }

    public function test_approval_pending_notification_via_and_array(): void {
        $creator  = User::factory()->create();
        $document = $this->makeDocument($creator);

        $approval = new ApprovalInstance;
        $approval->setRelation('document', $document);

        $step = new ApprovalInstanceStep;
        $step->setRelation('approvalInstance', $approval);

        $notification = new ApprovalPendingNotification($step);

        $this->assertSame(['database', 'broadcast', 'mail'], $notification->via($creator));

        $data = $notification->toArray($creator);
        $this->assertSame(NotificationClassesTestDocument::class, $data['documentType']);
        $this->assertSame($document->getKey(), $data['documentId']);
    }

    public function test_approval_canceled_notification_via_and_array(): void {
        $creator  = User::factory()->create();
        $document = $this->makeDocument($creator);

        $approval = new ApprovalInstance;
        $approval->setRelation('document', $document);

        $notification = new ApprovalCanceledNotification($approval, [1, 2]);

        $this->assertSame(['database', 'broadcast', 'mail'], $notification->via($creator));

        $data = $notification->toArray($creator);
        $this->assertSame(NotificationClassesTestDocument::class, $data['documentType']);
    }

    public function test_document_submitted_notification_includes_creator_name(): void {
        $creator  = User::factory()->create(['name' => 'Budi Santoso']);
        $document = $this->makeDocument($creator);
        $document->setRelation('createdBy', $creator);

        $notification = new DocumentSubmittedNotification($document, 'Warehouse');

        $data = $notification->toArray($creator);
        $this->assertStringContainsString('Budi Santoso', $data['message']);
        $this->assertStringContainsString('DOC-001', $data['message']);
    }

    public function test_user_invited_notification_is_mail_only(): void {
        $user = User::factory()->create();

        $notification = new UserInvitedNotification;

        $this->assertSame(['mail'], $notification->via($user));

        $mail = $notification->toMail($user);
        $this->assertInstanceOf(MailMessage::class, $mail);
    }

    public function test_broadcast_channel_defaults_to_private_channel_for_notifiable(): void {
        // Notification base class broadcastOn() default (unoverridden) derives
        // a PrivateChannel from the notifiable's class+key via the internal
        // BroadcastNotificationCreated event — verified here at the event
        // level since Notification itself doesn't expose the resolved channel.
        $creator  = User::factory()->create();
        $document = $this->makeDocument($creator);

        $approval = new ApprovalInstance;
        $approval->setRelation('document', $document);

        $notification = new ApprovalDecidedNotification($approval, 'approved');

        $event = new BroadcastNotificationCreated(
            $creator,
            $notification,
            $notification->toArray($creator),
        );

        $channels = $event->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        // Nama channel auto-derive dari FQCN notifiable (App\Models\User\User),
        // bukan 'App.Models.User' — dicek konsisten dengan routes/channels.php.
        $this->assertSame('private-App.Models.User.User.' . $creator->id, $channels[0]->name);
    }
}
