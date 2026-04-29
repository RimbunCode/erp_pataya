<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder {
    public function run(): void {
        $categories = [
            'Civil Engineering',
            'Structural Engineering',
            'Architecture',
            'Project Management',
            'Legal & Compliance',
            'BIM & Digital Twin',
            'Safety Engineering',
            'Green Building',
        ];

        foreach ($categories as $name) {
            Category::create([
                'id'   => Str::ulid(),
                'name' => $name,
                'slug' => Str::slug($name),
            ]);
        }
    }
}