<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Channels\MailChannel;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendEmailNotificationJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    private object $notifiable;

    private Notification $notification;

    public function __construct(object $notifiable, Notification $notification) {
        $this->notifiable   = $notifiable;
        $this->notification = $notification;
    }

    /**
     * Execute the job.
     */
    public function handle(): void {
        app()->make(MailChannel::class)->send($this->notifiable, $this->notification);
    }
}
