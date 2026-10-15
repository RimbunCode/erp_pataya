<?php

namespace Tests\Unit\Notifications;

use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Notifications\CommentMentionNotification;
use Tests\TestCase;

class CommentMentionNotificationEscapeTest extends TestCase {
    public function test_mail_line_escapes_markdown_link_and_html_from_user_input(): void {
        $document  = new SalesOrder(['code' => 'SO-1 [klik](https://evil.test)']);
        $commenter = new User(['name' => '<img src=x> *Budi* _x_']);

        $mail = (new CommentMentionNotification($document, $commenter))->toMail(new User);
        $line = implode("\n", $mail->introLines);

        $this->assertStringNotContainsString('[klik](', $line);
        $this->assertStringNotContainsString('<img', $line);
        $this->assertStringNotContainsString('*Budi*', $line);
        $this->assertStringContainsString('\\[klik\\]', $line);
    }

    public function test_broadcast_and_database_payload_keep_plain_values(): void {
        $document  = new SalesOrder(['code' => 'SO-2']);
        $commenter = new User(['name' => 'Budi']);

        $data = (new CommentMentionNotification($document, $commenter))->toArray(new User);

        $this->assertStringContainsString('SO-2', $data['message']);
        $this->assertStringContainsString('Budi', $data['message']);
    }
}
