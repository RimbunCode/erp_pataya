<?php

namespace App\Providers;

use App\Models\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Notifications\Channels\DatabaseChannel as IlluminateDatabaseChannel;
use Illuminate\Notifications\Notification as IlluminateNotification;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Eloquent\Model as EloquentModel;

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
    // $this->app->extend(EloquentModel::class, \App\Models\Model::class);
    $this->app->instance(IlluminateNotification::class, new \App\Notifications\BaseNotification());

    \collect(\glob(base_path('/database/macros/*.php')))->each(function ($file) {
      require $file;
    });
  }
}
