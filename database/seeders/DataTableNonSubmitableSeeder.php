<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\Core\Dashboard;
use App\Models\Core\Widget;
use App\Models\DashboardWidget;
use App\Models\Sales\Customer;
use App\Models\User\User;
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
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

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
        $this->ensureCustomerMainBranches();
        SupplierFactory::new()->count(self::SEED_COUNT)->create();

        PaymentMethodFactory::new()->count(self::SEED_COUNT)->create();
        PaymentTermFactory::new()->count(self::SEED_COUNT)->create();
        PaymentTermTemplateFactory::new()->count(self::SEED_COUNT)->create();
        ItemFactory::new()->count(self::SEED_COUNT)->create();
        ItemVariantFactory::new()->count(self::SEED_COUNT)->create();
        ItemAlternativeFactory::new()->count(self::SEED_COUNT)->create();
        WarehouseFactory::new()->count(self::SEED_COUNT)->create();

        /** @var Collection<int, Widget> $widgets */
        $widgets = WidgetFactory::new()->count(self::SEED_COUNT)->create();
        /** @var Collection<int, Dashboard> $dashboards */
        $dashboards = DashboardFactory::new()->count(self::SEED_COUNT)->create();

        $this->ensureDashboardWidgetRelations($dashboards, $widgets);
        $this->attachDashboardsToAdmin($dashboards);
    }

    private function ensureCustomerMainBranches(): void {
        Customer::query()->each(function (Customer $customer): void {
            Branch::query()->updateOrCreate([
                'branchable_type' => Customer::class,
                'branchable_id'   => $customer->id,
                'is_main_branch'  => true,
            ], [
                'code'                => str_replace(' ', '-', $customer->name),
                'name'                => $customer->name,
                'is_disabled'         => false,
                'billing_address'     => 'same_shipping',
                'shipping_street'     => $customer->street,
                'shipping_city'       => $customer->city,
                'shipping_state'      => $customer->province,
                'shipping_zip_code'   => $customer->zip_code,
                'shipping_country_id' => $customer->country_id,
            ]);
        });
    }

    /**
     * @param  Collection<int, Dashboard>  $dashboards
     * @param  Collection<int, Widget>  $widgets
     */
    private function ensureDashboardWidgetRelations(Collection $dashboards, Collection $widgets): void {
        if ($dashboards->isEmpty() || $widgets->isEmpty()) {
            return;
        }

        foreach ($dashboards as $dashboard) {
            if ($dashboard->widgets()->exists()) {
                continue;
            }

            $widget = $widgets->random();
            DashboardWidget::query()->create([
                'width'        => 'full',
                'dashboard_id' => $dashboard->id,
                'widget_id'    => $widget->id,
                'type'         => 'widget',
                'order'        => 0,
                'is_visible'   => true,
            ]);
        }

        foreach ($widgets as $widget) {
            $alreadyLinked = DashboardWidget::query()
                ->where('widget_id', $widget->id)
                ->exists();

            if ($alreadyLinked) {
                continue;
            }

            $dashboard = $dashboards->random();
            $nextOrder = ((int) DashboardWidget::query()
                ->where('dashboard_id', $dashboard->id)
                ->max('order')) + 1;

            DashboardWidget::query()->create([
                'width'        => 'half',
                'dashboard_id' => $dashboard->id,
                'widget_id'    => $widget->id,
                'type'         => 'widget',
                'order'        => $nextOrder,
                'is_visible'   => true,
            ]);
        }
    }

    /**
     * @param  Collection<int, Dashboard>  $dashboards
     */
    private function attachDashboardsToAdmin(Collection $dashboards): void {
        $admin = User::query()
            ->where('username', 'admin')
            ->first();

        if (! $admin || $dashboards->isEmpty()) {
            return;
        }

        foreach ($dashboards->values() as $order => $dashboard) {
            $existingPivot = DB::table('user_dashboards')
                ->where('user_id', $admin->id)
                ->where('dashboard_id', $dashboard->id)
                ->first();

            if ($existingPivot) {
                DB::table('user_dashboards')
                    ->where('id', $existingPivot->id)
                    ->update([
                        'order'      => $order,
                        'deleted_at' => null,
                        'updated_at' => now(),
                    ]);

                continue;
            }

            DB::table('user_dashboards')->insert([
                'id'           => (string) new Ulid,
                'user_id'      => $admin->id,
                'dashboard_id' => $dashboard->id,
                'order'        => $order,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }
}
