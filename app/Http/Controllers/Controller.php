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
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

abstract class Controller {
  protected string $model;
  protected $permissions;
  protected string $lang;


  /**
   * Summary of setBreadcrumbs
   * @param (\Illuminate\Database\Eloquent\Model|string)[] $models
   * @return void
   */
  protected function setBreadcrumbs(Model|string ...$models) {
    $instanceModel = new $this->model();
    if (empty($models)) {
      $breadcrumbs = [['name' => ($instanceModel->translateKey ?? "") . '.title']];
    } else {
      $breadcrumbs = [];
      /**
       *  @var \Illuminate\Database\Eloquent\Model $model
       */
      foreach ($models as $key => $model) {
        if (\gettype($model) == 'string') {
          $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? "") . '.title', 'link' => route("{$model->route}.index")];
          $breadcrumbs[] = ['name' => $model];
          break;
        }
        if ($key == 0) {
          $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? "") . '.title', 'link' => route("{$model->route}.index")];
          $name = Arr::get($model->toArray(), $model->keyBreadcrumb ?? "", $model->name);
          $breadcrumbs[] = ($key == (count($models) - 1)) ?
            ['name' => $name] :
            ['name' => $name, 'link' => route("{$model->route}.show", $model->id)];
          continue;
        }
        preg_match('/([^\\\\]+)$/',  \get_class($model), matches: $className);
        $alias = $model->aliasBreadcrumb ?? $className[1];
        $value = Arr::get($model->toArray(), $model->keyBreadcrumb ?? "", $model->name);
        $breadcrumbs[] = ($key == (count($models) - 1)) ?
          ['name' => "{$alias}: {$value}"] :
          ['name' => "{$alias}: {$value}", 'link' => route("{$model->route}.show", $model->id)];
      }
    }
    Inertia::share([
      'breadcrumbs' => $breadcrumbs,
    ]);
  }

  public function __construct(Request $request, string $model = null) {
    if (!$model)
      return;
    $this->lang = $request->cookie('lang') ?? 'en';
    $this->model = $model;
    if (!$model)
      return;
    $this->permissions = RolePermission::getPermissions($model);
    $currentRoute = Route::getCurrentRoute();
    switch ($currentRoute->getActionMethod()) {
      case 'index':
      case "create":
      case "store":
      case 'show':
      case "update":
      case "submit":
      case "destroy":
    }
    // dd($this->permissions->toArray());
    // Inertia::share('permissions', $this->permissions);
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
  protected function renderShow($formPathname, $name, $title, $data, $props = [], $settings = []) {
    return Inertia::render('ShowGeneral', array_merge([
      'name' => $name,
      'title' => $title,
      'formPathname' => $formPathname ?? (new $this->model())->formComponent ?? "",
      $name => $data,
    ], [...$props, 'settings' => $settings]));
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
