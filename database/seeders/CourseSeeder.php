<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\User\User;
use Illuminate\Database\Seeder;

class CourseSeeder extends Seeder {
    public function run(): void {
        $instructor = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'instructor'))
            ->first();

        if (! $instructor) {
            return;
        }

        $categories = Category::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        foreach ($categories as $categoryIndex => $category) {
            $courseCount = $categoryIndex % 2 === 0 ? 1 : 2;

            for ($courseNumber = 1; $courseNumber <= $courseCount; $courseNumber++) {
                $course = Course::query()->create([
                    'title'            => "{$category->name} Essentials {$courseNumber}",
                    'description'      => "Program pembelajaran {$category->name} untuk memperkuat kompetensi praktik dan implementasi di lapangan.",
                    'price'            => 500000 + (($categoryIndex + $courseNumber) * 150000),
                    'level'            => $this->resolveLevel($categoryIndex + $courseNumber),
                    'language'         => 'id',
                    'certificate_type' => 'professional',
                    'total_hours'      => 8 + ($courseNumber * 2),
                    'total_sessions'   => 4 + $courseNumber,
                    'is_published'     => true,
                    'created_by'       => $instructor->id,
                ]);

                $course->categories()->sync([$category->id]);

                $section = CourseSection::query()->create([
                    'course_id' => $course->id,
                    'title'     => "Overview {$category->name}",
                    'order'     => 1,
                ]);

                CourseContent::query()->create([
                    'section_id'  => $section->id,
                    'title'       => 'Materi Dasar',
                    'type'        => 'material',
                    'description' => "Materi pengantar untuk topik {$category->name}.",
                    'is_optional' => false,
                    'is_required' => true,
                    'order'       => 1,
                ]);
            }
        }
    }

    private function resolveLevel(int $index): string {
        return match ($index % 3) {
            0       => 'beginner',
            1       => 'intermediate',
            default => 'advanced',
        };
    }
}
