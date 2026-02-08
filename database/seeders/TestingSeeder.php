<?php

namespace Database\Seeders;

use App\Models\Inventory\ItemAlternative;
use Illuminate\Database\Seeder;

class TestingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $items = ItemAlternative::with('item.category')->first();
        dd($items->get()->where('item.category.name', 'Makanan'));
    }
}
