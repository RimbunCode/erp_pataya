<?php

namespace App\Traits;

use App\Models\Model;

trait HasDefaultDelete {
    public function delete(Model $model): void {
        $model->delete();
    }
}
