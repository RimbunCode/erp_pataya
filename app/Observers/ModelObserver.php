<?php

namespace App\Observers;

use App\Models\Model;
use Illuminate\Support\Facades\Log;

class ModelObserver
{
    /**
     * Handle the Model "created" event.
     */
    public function created(Model $model): void
    {
        //
    }

    /**
     * Handle the Model "updated" event.
     */
    public function updated(Model $model): void
    {
      Log::info('Model updated', [
        'model' => $model,
        'data_before' => $model->getOriginal(),
        'data_after' => $model->getAttributes(),
      ]);
        // dd($model);
    }

    /**
     * Handle the Model "deleted" event.
     */
    public function deleted(Model $model): void
    {
        //
    }

    /**
     * Handle the Model "restored" event.
     */
    public function restored(Model $model): void
    {
        //
    }

    /**
     * Handle the Model "force deleted" event.
     */
    public function forceDeleted(Model $model): void
    {
        //
    }
}
