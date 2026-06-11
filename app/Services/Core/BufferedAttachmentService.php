<?php

namespace App\Services\Core;

use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class BufferedAttachmentService {
    public static function attach(Model $model, Request $request): void {
        static::attachTags($model, $request);
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
                'taggable_id'   => $model->id,
                'taggable_type' => get_class($model),
                'tag_id'        => $tagModel->id,
            ]);
        }
    }
}
