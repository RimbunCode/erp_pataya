<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseNote;
use App\Models\CourseSection;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CourseSeeder extends Seeder {
    public function run(): void {
        $instructor  = User::whereHas('roles', fn ($q) => $q->where('name', 'instructor'))->first();
        $bimCategory = Category::where('slug', 'bim-digital-twin')->first();
        $pmCategory  = Category::where('slug', 'project-management')->first();

        // ── Course 1 ──────────────────────────────────────
        $course1 = Course::create([
            'id'               => Str::ulid(),
            'title'            => 'Advanced Project Planning & Control (PPC)',
            'description'      => 'Master the arts of scheduling, cost estimation, and risk management using modern BIM tools and industrial standards.',
            'price'            => 2500000,
            'level'            => 'advanced',
            'language'         => 'id',
            'certificate_type' => 'professional',
            'total_hours'      => 24,
            'total_sessions'   => 8,
            'is_published'     => true,
            'created_by'       => $instructor->id,
        ]);

        $course1->categories()->attach([$pmCategory->id]);

        // Section 1
        $section1 = CourseSection::create([
            'id'        => Str::ulid(),
            'course_id' => $course1->id,
            'title'     => 'Introduction to Project Planning',
            'order'     => 1,
        ]);

        // Section 2
        $section2 = CourseSection::create([
            'id'        => Str::ulid(),
            'course_id' => $course1->id,
            'title'     => 'Cost Estimation & Budget Control',
            'order'     => 2,
        ]);

        // Course Note
        CourseNote::create([
            'id'         => Str::ulid(),
            'section_id' => $section1->id,
            'course_id'  => $course1->id,
            'title'      => 'Schedule Update',
            'message'    => 'Live session on Chapter 2 has been moved to Friday, 15 Feb 2026 at 19:00 WIB.',
            'type'       => 'schedule',
            'is_urgent'  => true,
            'created_by' => $instructor->id,
        ]);

        // ── Course 2 ──────────────────────────────────────
        $course2 = Course::create([
            'id'               => Str::ulid(),
            'title'            => 'BIM Management for Structural Design',
            'description'      => 'Comprehensive training for BIM integration in structural engineering workflows, including Revit and Tekla mastery.',
            'price'            => 3200000,
            'level'            => 'intermediate',
            'language'         => 'id',
            'certificate_type' => 'professional',
            'total_hours'      => 32,
            'total_sessions'   => 12,
            'is_published'     => true,
            'created_by'       => $instructor->id,
        ]);

        $course2->categories()->attach([$bimCategory->id]);

        $section3 = CourseSection::create([
            'id'        => Str::ulid(),
            'course_id' => $course2->id,
            'title'     => 'BIM Fundamentals',
            'order'     => 1,
        ]);

        // Ganti semua CourseContent::insert([...]) dengan ini

        // Section 1
        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section1->id,
            'title'       => 'Pre Assessment',
            'type'        => 'pre_assessment',
            'description' => 'Complete this assessment to help us understand your current knowledge level.',
            'is_optional' => true,
            'is_required' => false,
            'deadline'    => null,
            'order'       => 1,
        ]);

        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section1->id,
            'title'       => 'Chapter Materials',
            'type'        => 'material',
            'description' => 'Study the following materials before attending the live session.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => null,
            'order'       => 2,
        ]);

        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section1->id,
            'title'       => 'Chapter Assignment',
            'type'        => 'assignment',
            'description' => 'Create a simple project schedule using CPM for a hypothetical construction project with at least 10 activities.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => now()->addDays(14),
            'order'       => 3,
        ]);

        // Section 2
        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section2->id,
            'title'       => 'Chapter Materials',
            'type'        => 'material',
            'description' => 'Study the following materials before attending the live session.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => null,
            'order'       => 1,
        ]);

        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section2->id,
            'title'       => 'Chapter Assignment',
            'type'        => 'assignment',
            'description' => 'Develop a complete budget plan for a given project scenario.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => now()->addDays(21),
            'order'       => 2,
        ]);

        // Section 3
        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section3->id,
            'title'       => 'Chapter Materials',
            'type'        => 'material',
            'description' => 'Introduction to BIM concepts and workflows.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => null,
            'order'       => 1,
        ]);

        CourseContent::create([
            'id'          => Str::ulid(),
            'section_id'  => $section3->id,
            'title'       => 'Chapter Assignment',
            'type'        => 'assignment',
            'description' => 'Create a basic BIM model using Revit for a simple structural element.',
            'is_optional' => false,
            'is_required' => true,
            'deadline'    => now()->addDays(14),
            'order'       => 2,
        ]);
    }
}