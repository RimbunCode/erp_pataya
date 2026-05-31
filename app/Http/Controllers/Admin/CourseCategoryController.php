<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCourseCategoryRequest;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CourseCategoryController extends Controller {
    public function index(): Response {
        $categories = Category::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'created_at'])
            ->map(fn (Category $category): array => [
                'id'        => (string) $category->id,
                'name'      => (string) $category->name,
                'slug'      => (string) $category->slug,
                'createdAt' => $category->created_at?->toIso8601String(),
            ])
            ->values();

        return Inertia::render('Admin/CourseCategories/index', [
            'categories' => $categories,
        ]);
    }

    public function store(StoreCourseCategoryRequest $request): RedirectResponse {
        $validated = $request->validated();
        $name      = trim((string) $validated['name']);
        $slug      = Str::slug($name);

        Category::query()->create([
            'name' => $name,
            'slug' => $slug,
        ]);

        return back()->with('success', 'Kategori course berhasil ditambahkan.');
    }
}
