<?php

namespace App\Providers;

use App\Channels\DatabaseChannel;
use App\Notifications\BaseNotification;
use Illuminate\Database\Eloquent\Model as EloquentModel;
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

        $this->app->instance(IlluminateDatabaseChannel::class, new DatabaseChannel);
        // $this->app->extend(EloquentModel::class, \App\Models\Model::class);
        $this->app->instance(IlluminateNotification::class, new BaseNotification);

        \collect(\glob(base_path('/database/macros/*.php')))->each(function ($file) {
            require $file;
        });
    }
}
