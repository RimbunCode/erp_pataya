<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\CourseContent;
use App\Models\CourseSection;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CourseContentController extends Controller {
    // POST /instructor/classes/{courseId}/sections/{sectionId}/contents
    public function store(Request $request, CourseSection $section) {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type'  => 'required|in:pre_assessment,material,assignment',
            'url'   => 'nullable|url|max:2048',
        ]);

        $order = $section->contents()->max('order') + 1;

        $section->contents()->create([
            'title' => $validated['title'],
            'type'  => $validated['type'],
            'url'   => $validated['url'] ?? null,
            'order' => $order,
        ]);

        return back()->with('success', 'Content added.');
    }

    // PATCH /instructor/classes/{courseId}/sections/{sectionId}/contents/{id}
    public function update(Request $request, CourseContent $content) {
        $validated = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'deadline'    => 'sometimes|nullable|date',
            'is_optional' => 'sometimes|boolean',
            'url'         => 'sometimes|nullable|url|max:2048',
        ]);

        if (array_key_exists('deadline', $validated)) {
            $validated['deadline'] = $validated['deadline']
                ? Carbon::parse($validated['deadline'])->seconds(0)
                : null;
        }

        $content->update($validated);

        return back()->with('success', 'Content updated.');
    }

    // DELETE /instructor/classes/{courseId}/sections/{sectionId}/contents/{id}
    public function destroy(CourseContent $content) {
        $content->delete();

        return back()->with('success', 'Content deleted.');
    }

    // POST /instructor/classes/{courseId}/sections/{sectionId}/contents/{id}/upload
    public function upload(Request $request, CourseContent $content) {
        DB::beginTransaction();
        File::uploadFile($request, 'Content File', function ($file) use ($content) {
            Fileable::create([
                'fileable_id'   => $content->id,
                'fileable_type' => CourseContent::class,
                'file_id'       => $file->id,
            ]);
        });
        DB::commit();

        return back()->with('success', 'Content file updated.');
    }

    public function destroyFile(string $content, File $file) {
        Fileable::where('fileable_id', $content)
            ->where('fileable_type', CourseContent::class)
            ->where('file_id', $file->id)
            ->forceDelete();

        return back()->with('success', 'File removed.');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorizedSection(string $courseId, string $sectionId): CourseSection {
        return CourseSection::whereHas(
            'course',
            fn ($q) => $q->where('created_by', Auth::id())->where('id', $courseId),
        )->findOrFail($sectionId);
    }

    private function authorizedContent(string $courseId, string $sectionId, string $id): CourseContent {
        return CourseContent::whereHas(
            'section',
            fn ($q) => $q->where('id', $sectionId)
                ->whereHas(
                    'course',
                    fn ($q2) => $q2->where('created_by', Auth::id())->where('id', $courseId),
                ),
        )->findOrFail($id);
    }
}
