<?php

namespace App\Http\Controllers;

use App\Http\Requests\Core\CommentRequest;
use App\Http\Requests\Core\TagRequest;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Exception;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

abstract class Controller {
  protected string $model;
  protected $permissions;


  /**
   * Summary of setBreadcrumbs
   * @param \Illuminate\Database\Eloquent\Model[] $models
   * @return void
   */
  protected function setBreadcrumbs(Model ...$models) {
    if (empty($models)) {
      $tableName = $this->model::getTableName();
      $breadcrumbs = [['name' => Str::title($tableName)]];
    } else {
      $breadcrumbs = [];
      /**
       *  @var \Illuminate\Database\Eloquent\Model $model
       */
      foreach ($models as $key => $model) {
        $tableName = $model->getTable();
        if ($key == 0) {
          $breadcrumbs[] = ['name' => Str::title($tableName), 'link' => route("{$tableName}.index")];
          $breadcrumbs[] = ($key == (count($breadcrumbs) - 1)) ?
            ['name' => $model->name] :
            ['name' => $model->name, 'link' => route("{$tableName}.edit")];
          continue;
        }

        preg_match('/([^\\\\]+)$/',  \get_class($model), $className);
        $breadcrumbs[] = ($key == (count($breadcrumbs) - 1)) ?
          ['name' => "{$className[1]}: {$model->name}"] :
          ['name' => "{$className[1]}: {$model->name}", 'link' => route("{$tableName}.edit")];
      }
    }

    Inertia::share([
      'breadcrumbs' => $breadcrumbs,
    ]);
  }

  public function __construct(Request $request, string $model = null) {
    if (!$model)
      return;
    $this->model = $model;
    $this->permissions = RolePermission::select('role_permissions.permissions')
      ->join('roles', 'roles.id', '=', 'role_permissions.role_id')
      ->join('user_role', 'user_role.role_id', '=', 'roles.id')
      ->where('user_role.user_id', $request->user()->id)
      ->where('model', $this->model)
      ->first()?->permissions;
    Inertia::share('permissions', $this->permissions);
  }
  protected function guard($operation) {
    $isAllow = in_array($operation, $this->permissions);

    if (!$isAllow) {
      abort(403);
    }
  }

  protected function isInertiaRequest(Request $request) {
    if (!$request->ajax())
      return true;
    return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
  }
  public function addComment(CommentRequest $request, $param) {
    $request->validated();

    preg_match_all('/data-id="([^"]+)"/',  $request->comment, $matches);

    $usersMentioned  = collect($matches[1])->unique();
    if ($usersMentioned->count() > 0) {
      $users = User::whereIn('id', $usersMentioned)->get();
    }

    Log::create([
      'user_id' => $request->user()->id,
      'loggable_id' => $param,
      'loggable_type' => $this->model,
      'type' => 'comment',
      'activity' => $request->comment,
    ]);

    return back();
  }
  public function removeComment(Request $request, $param, Log $id) {
    if ($id->user_id != $request->user()->id || !$id || $id->type != 'comment') {
      return back()->with('alert', [
        'message' => 'Failed remove comment'
      ]);
    }
    $id->delete();

    return back()->with('alert', [
      'message' => 'Failed remove comment'
    ]);
  }
  public function addTag(TagRequest $request, $param) {
    $request->validated();

    if ($request->new) {
      $tag = Tag::create([
        'name' => $request->name
      ]);
      $tag->logs()->create([
        'user_id' => $request->user()->id,
        'activity' => [
          'en' => ':user created this',
          'id' => ':user telah membuat ini'
        ]
      ]);
    }
    $tag = $request->isNew ? Tag::create([
      'name' => $request->name
    ]) : Tag::find($request->id);

    Taggable::create([
      'taggable_id' => $param,
      'taggable_type' => $this->model,
      'tag_id' => $tag->id
    ]);

    return back();
  }
  public function removeTag(Request $request, $param, Tag $id) {
    Taggable::where('taggable_id', $param)
      ->where('taggable_type', $this->model)
      ->where('tag_id', $id->id)->delete();

    return back();
  }

  public function addFile(Request $request, $param) {
    DB::beginTransaction();
    preg_match('/[^\\\\]+$/', $this->model, $folderName);

    File::uploadFile($request, $folderName[0], function ($file) use ($param) {
      Fileable::create([
        'fileable_id' => $param,
        'fileable_type' => $this->model,
        'file_id' => $file->id
      ]);
    });
    DB::commit();
    return back();
  }
  public function removeFile(Request $request, $param, File $id) {
    try {
      Fileable::where('fileable_id', $param)
        ->where('fileable_type', $this->model)
        ->where('file_id', $id->id)->delete();
    } catch (Exception $e) {
      dd($e);
    }
    return back();
  }
}
