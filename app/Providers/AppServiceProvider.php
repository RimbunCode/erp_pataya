<?php

namespace App\Providers;

use Illuminate\Notifications\Channels\DatabaseChannel as IlluminateDatabaseChannel;
use Illuminate\Notifications\Notification as IlluminateNotification;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider {
  /**
   * Register any application services.
   */
  public function register(): void {
    //
  }

  /**
   * Bootstrap any application services.
   */
  public function boot(): void {
    Vite::prefetch(concurrency: 3);

    $this->app->instance(IlluminateDatabaseChannel::class, new \App\Channels\DatabaseChannel());
    $this->app->instance(IlluminateNotification::class, new \App\Notifications\BaseNotification());
  }
}
