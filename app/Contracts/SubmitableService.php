<?php

namespace App\Contracts;

use App\Models\Model;

interface SubmitableService extends CrudService {
    public function submit(Model $model): mixed;

    public function cancel(Model $model): mixed;

    public function amend(Model $model): mixed;

    public function onApproved(Model $model): mixed;

    public function onRejected(Model $model): mixed;
}
