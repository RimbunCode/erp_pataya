<?php

namespace App\Traits;

use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\Scopes\DataTableScope;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * @method static void dataTable(\Illuminate\Http\Request $request)
 * @method void dataTable(\Illuminate\Http\Request $request)
 */
trait DataTable {
  public static function bootDataTable() {
    static::addGlobalScope(new DataTableScope);
  }

  public function showDetail() {
    Inertia::share([
      'logs' => Inertia::defer(function () {
        return Log::with('user')
          ->where('loggable_type', static::class)
          ->where('loggable_id', operator: $this->id)
          ->orderByDesc('created_at')
          ->get();
      }, 'logs'),
      'tags' => Inertia::defer(function () {
        return $this->tags()
          ->get(['id', 'name']);
      }, 'tags'),
      'attachments' => Inertia::defer(function () {
        return $this->files()
          ->get(['id', 'name']);
      }, 'attachments')
    ]);
  }

  public function logs() {
    return $this->morphMany(Log::class, 'loggable');
  }
  public function tags() {
    return $this->morphToMany(Tag::class, 'taggable')
      ->whereNull('taggables.deleted_at');
  }
  public function files() {
    return $this->morphToMany(File::class, 'fileable')
      ->whereNull('fileables.deleted_at');
  }
}
