<?php

namespace App\Models;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\Relation;
use ReflectionClass;

class Model extends EloquentModel {
  use LinkModel;

  public function loadAllRelations(...$classRelations) {
    $class       = new ReflectionClass($this);
    $methods     = $class->getMethods();
    $newInstance = $class->newInstance();

    $relations = [];
    foreach ($methods as $method) {
      if (
        $method->class === $class->getName() &&
        $method->isPublic() &&
        ! $method->isStatic() &&
        $method->getNumberOfParameters() === 0
      ) {
        if ($method->name === 'logs') continue;
        try {
          $return = $newInstance->{$method->name}();

          // cek apakah return-nya instance Relation
          if ($return instanceof Relation) {
            if (\count($classRelations) > 0) {
              if (\in_array(\get_class($return), $classRelations)) {
                $relations[] = $method->name;
              }
            } else {
              $relations[] = $method->name;
            }
          }
        } catch (\Throwable $th) {
          // Abaikan method yang bukan relasi
        }
      }
    }

    return $this->load($relations);
  }
}
