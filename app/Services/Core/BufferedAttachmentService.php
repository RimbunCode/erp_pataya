<?php

namespace App\Services\Core;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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
            // Item dengan 'type' (assignee-kind) terisi tapi allocated_to_id
            // kosong TETAP diproses — TodoService::normalize() akan
            // fallback ke diri sendiri (Requirement 7.3: konsisten di
            // ketiga jalur). Hanya entry sampah (bukan array, atau tak
            // punya 'type' sama sekali) yang di-skip di sini.
            if (! is_array($assignee) || empty($assignee['type'])) {
                continue;
            }
            $allocatedToId = $assignee['allocated_to_id'] ?? $assignee['id'] ?? null;

            $validator = Validator::make($assignee, [
                'description' => ['nullable', 'string'],
                'priority'    => ['nullable', 'string', 'in:low,medium,high'],
                'date'        => ['nullable', 'date'],
                'due_date'    => ['nullable', 'date', 'after_or_equal:date'],
            ]);
            $validator->validate();

            $payload = [
                'reference_id'   => $model->getKey(),
                'reference_type' => get_class($model),
                'allocated_to'   => [
                    'id'   => $allocatedToId,
                    'type' => $assignee['type'],
                ],
                'priority'    => $assignee['priority'] ?? 'medium',
                'description' => $assignee['description'] ?? null,
                'date'        => $assignee['date'] ?? null,
                'due_date'    => $assignee['due_date'] ?? null,
            ];

            // 'todo_type'/'reminder_lead_days' (bukan 'type') — lihat catatan
            // tabrakan nama di TicketResponseRequest::rules(). Key HANYA
            // disertakan kalau ada nilainya — kolom `type` NOT NULL tanpa
            // nullable(), jadi menyertakan null eksplisit akan melanggar
            // constraint alih-alih jatuh ke default DB 'task'.
            if (filled($assignee['todo_type'] ?? null)) {
                $payload['type'] = $assignee['todo_type'];
            }
            if (filled($assignee['reminder_lead_days'] ?? null)) {
                $payload['reminder_lead_days'] = $assignee['reminder_lead_days'];
            }

            app(TodoService::class)->createForReference($payload);
        }
    }
}
