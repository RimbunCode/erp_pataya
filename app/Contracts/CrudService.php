<?php

namespace App\Contracts;

use App\Models\Model;

interface CrudService {
    public function create(array $data): Model;

    public function update(Model $model, array $data): Model;

    public function delete(Model $model): void;
}
