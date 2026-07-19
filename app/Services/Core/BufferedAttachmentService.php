<?php

namespace App\Services\Core;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use App\Models\Core\Todo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class BufferedAttachmentService {
    public static function attach(Model $model, Request $request): void {
        static::attachTags($model, $request);
        static::attachFiles($model, $request);
        static::attachAssignees($model, $request);
    }

    protected static function attachTags(Model $model, Request $request): void {
        $tags = $request->input('buffered_tags', []);
        if (! is_array($tags)) {
            return;
        }
        foreach ($tags as $tag) {
            if (! is_array($tag)) {
                continue;
            }
            $isNew    = filter_var($tag['isNew'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $tagModel = $isNew || empty($tag['id'])
                ? Tag::firstOrCreate(['name' => $tag['name']])
                : Tag::find($tag['id']);
            if (! $tagModel) {
                continue;
            }
            Taggable::firstOrCreate([
                'taggable_id'   => $model->getKey(),
                'taggable_type' => get_class($model),
                'tag_id'        => $tagModel->id,
            ]);
        }
    }

    protected static function attachFiles(Model $model, Request $request): void {
        if (! $request->hasFile('files') && ! $request->has('filesId')) {
            return;
        }
        preg_match('/[^\\\\]+$/', get_class($model), $folderName);
        File::uploadFile($request, $folderName[0], function ($file) use ($model) {
            // File draft (di-upload saat create) di-finalkan saat attach.
            if ($file->is_draft) {
                $file->update(['is_draft' => false]);
            }
            Fileable::firstOrCreate([
                'fileable_id'   => $model->getKey(),
                'fileable_type' => get_class($model),
                'file_id'       => $file->id,
            ]);
        });
    }

    protected static function attachAssignees(Model $model, Request $request): void {
        $assignees = $request->input('buffered_assignees', []);
        if (! is_array($assignees) || empty($assignees)) {
            return;
        }
        foreach ($assignees as $assignee) {
            if (! is_array($assignee) || empty($assignee['id']) || empty($assignee['type'])) {
                continue;
            }
            $todo = Todo::firstOrCreate([
                'reference_id'    => $model->getKey(),
                'reference_type'  => get_class($model),
                'allocated_to_id' => $assignee['id'],
            ], [
                'code'              => TodoService::generateCode($assignee),
                'allocated_to_type' => $assignee['type'],
                'assigned_by_id'    => $request->user()?->id,
                'status'            => 'open',
                'priority'          => 'medium',
            ]);
            if ($todo->wasRecentlyCreated) {
                app(TodoService::class)->notifyAssignee($todo);
            }
        }
    }
}
