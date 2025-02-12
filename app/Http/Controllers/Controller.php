<?php

namespace App\Http\Controllers;

use App\Http\Requests\Core\CommentRequest;
use App\Http\Requests\Core\TagRequest;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use Exception;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller {
  protected string $model;
  public function addComment(CommentRequest $request, $param) {
    $request->validated();

    preg_match_all('/data-id="([^"]+)"/',  $request->comment, $matches);

    $dataIds = $matches[1];

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
        'activity' => '<p>:user created this</p>'
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
    if ($request->has('files')) {
      $validatedData = $request->validate([
        'files' => ['required', 'array'],
        'files.*' => ['required', 'file', 'max:10240'],
        'isPublic' => ['required', 'array'],
        'isPublic.*' => ['required'],
        'name' => ['required', 'array'],
        'name.*' => ['required', 'string']
      ]);
      preg_match('/[^\\\\]+$/', $this->model, $folderName);
      $folder = File::firstOrCreate([
        'name' => $folderName[0],
        'mime_type' => 'folder',
      ]);
      foreach ($validatedData['files'] as $key => $file) {
        $file = File::create([
          'name' => strlen(trim($validatedData['name'][$key])) > 0 ? $validatedData['name'][$key] : $file->getClientOriginalName(),
          'path' => $file->store('files'),
          'is_public' => $validatedData['isPublic'][$key] == 'true',
          'extension' => $file->getClientOriginalExtension(),
          'mime_type' => $file->getMimeType(),
          'user_id' => $request->user()->id,
          'folder_id' => $folder->id,
        ]);
        Fileable::create([
          'fileable_id' => $param,
          'fileable_type' => $this->model,
          'file_id' => $file->id
        ]);
      }
    } else if ($request->has('filesIds')) {
      $validatedData = $request->validate([
        'filesIds' => ['required', 'array'],
        'filesIds.*' => ['required', 'string', 'exists:files,id'],
      ]);
      foreach ($validatedData['filesIds'] as $key => $fileId) {
        Fileable::create([
          'fileable_id' => $param,
          'fileable_type' => $this->model,
          'file_id' => $fileId
        ]);
      }
    }
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
