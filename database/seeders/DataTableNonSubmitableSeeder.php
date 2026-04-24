<?php

namespace Database\Seeders;

use Database\Factories\Core\DashboardFactory;
use Database\Factories\Core\TagFactory;
use Database\Factories\Core\WidgetFactory;
use Database\Factories\Finances\PaymentMethodFactory;
use Database\Factories\Finances\PaymentTermFactory;
use Database\Factories\Finances\PaymentTermTemplateFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\AttributeFactory;
use Database\Factories\Inventory\CategoryFactory;
use Database\Factories\Inventory\ItemAlternativeFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\SupplierFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Database\Seeder;

class DataTableNonSubmitableSeeder extends Seeder {
    private const int SEED_COUNT = 5;

    /**
     * Run the database seeds.
     */
    public function run(): void {
        TagFactory::new()->count(self::SEED_COUNT)->create();
        AttributeFactory::new()->count(self::SEED_COUNT)->create();
        CategoryFactory::new()->count(self::SEED_COUNT)->create();
        TaxFactory::new()->count(self::SEED_COUNT)->create();

        CustomerFactory::new()->count(self::SEED_COUNT)->create();
        SupplierFactory::new()->count(self::SEED_COUNT)->create();

        PaymentMethodFactory::new()->count(self::SEED_COUNT)->create();
        PaymentTermFactory::new()->count(self::SEED_COUNT)->create();
        PaymentTermTemplateFactory::new()->count(self::SEED_COUNT)->create();
        ItemFactory::new()->count(self::SEED_COUNT)->create();
        ItemVariantFactory::new()->count(self::SEED_COUNT)->create();
        ItemAlternativeFactory::new()->count(self::SEED_COUNT)->create();
        WarehouseFactory::new()->count(self::SEED_COUNT)->create();

        WidgetFactory::new()->count(self::SEED_COUNT)->create();
        DashboardFactory::new()->count(self::SEED_COUNT)->create();
    }
}
