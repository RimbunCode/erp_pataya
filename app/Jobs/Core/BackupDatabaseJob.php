<?php

namespace App\Jobs\Core;

use App\Models\User\User;
use App\Traits\BackupDatabase;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class BackupDatabaseJob implements ShouldQueue {
  use Queueable, BackupDatabase;

  public $timeout = 300;
  /**
   * Create a new job instance.
   */
  public function __construct(public User $user) {
    //
  }

  /**
   * Execute the job.
   */
  public function handle(): void {
    try {
      $backupFile = $this->performBackup($this->user);
    } catch (\Throwable $th) {
      //throw $th;
    }
  }
}
