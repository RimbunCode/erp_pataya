<?php

use App\Enums\Domain;
use App\Http\Controllers\Finances\FinanceSettingController;
use App\Http\Controllers\Inventory\InventorySettingController;
use App\Http\Controllers\Purchase\PurchaseSettingController;
use App\Http\Controllers\Sales\SalesSettingController;
use App\Models\Core\CoreSetting;
use App\Models\Finances\FinanceSetting;
use App\Models\Inventory\InventorySetting;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;

return [
    'legacy_map' => [
        'company_name'                   => [CoreSetting::class, 'company_name'],
        'short_name'                     => [CoreSetting::class, 'short_name'],
        'email'                          => [CoreSetting::class, 'email'],
        'phone'                          => [CoreSetting::class, 'phone'],
        'street'                         => [CoreSetting::class, 'street'],
        'city'                           => [CoreSetting::class, 'city'],
        'state'                          => [CoreSetting::class, 'state'],
        'zip_code'                       => [CoreSetting::class, 'zip_code'],
        'country_id'                     => [CoreSetting::class, 'country_id'],
        'bank_name'                      => [CoreSetting::class, 'bank_name'],
        'bank_account_name'              => [CoreSetting::class, 'bank_account_name'],
        'bank_account_number'            => [CoreSetting::class, 'bank_account_number'],
        'default_currency_id'            => [CoreSetting::class, 'default_currency_id'],
        'default_number_format'          => [CoreSetting::class, 'default_number_format'],
        'timezone'                       => [CoreSetting::class, 'timezone'],
        'num_per_page'                   => [CoreSetting::class, 'num_per_page'],
        'per_page_options'               => [CoreSetting::class, 'per_page_options'],
        'company_image'                  => [CoreSetting::class, 'company_image_id'],
        'mail_protocol'                  => [CoreSetting::class, 'mail_protocol'],
        'mail_encryption'                => [CoreSetting::class, 'mail_encryption'],
        'mail_host'                      => [CoreSetting::class, 'mail_host'],
        'mail_port'                      => [CoreSetting::class, 'mail_port'],
        'mail_username'                  => [CoreSetting::class, 'mail_username'],
        'mail_password'                  => [CoreSetting::class, 'mail_password'],
        'mail_from_address'              => [CoreSetting::class, 'mail_from_address'],
        'mail_from_name'                 => [CoreSetting::class, 'mail_from_name'],
        'active_tax_id'                  => [SalesSetting::class, 'default_tax_id'],
        'tax_invoice_serial_range_start' => [FinanceSetting::class, 'tax_invoice_serial_range_start'],
        'tax_invoice_serial_range_end'   => [FinanceSetting::class, 'tax_invoice_serial_range_end'],
        'tax_invoice_serial_last_used'   => [FinanceSetting::class, 'tax_invoice_serial_last_used'],
    ],
    'pages' => [
        'finance' => [
            'model'      => FinanceSetting::class,
            'controller' => FinanceSettingController::class,
            'page'       => 'Settings/Modules/FinanceSettings',
            'icon'       => 'HandCoins',
            'title'      => 'finances.setting.title',
            // Display label is a literal: sidebar renders MenuItem.label raw
            // (no t() lookup), like every other DeskSeeder label.
            'label' => 'Finance Settings',
            'desks' => [Domain::Core, Domain::Finances],
            'order' => 26,
        ],
        'sales' => [
            'model'      => SalesSetting::class,
            'controller' => SalesSettingController::class,
            'page'       => 'Settings/Modules/SalesSettings',
            'icon'       => 'ShoppingCart',
            'title'      => 'sales.setting.title',
            'label'      => 'Sales Settings',
            'desks'      => [Domain::Core, Domain::Sales, Domain::Finances],
            'order'      => 27,
        ],
        'purchase' => [
            'model'      => PurchaseSetting::class,
            'controller' => PurchaseSettingController::class,
            'page'       => 'Settings/Modules/PurchaseSettings',
            'icon'       => 'ShoppingBag',
            'title'      => 'purchase.setting.title',
            'label'      => 'Purchase Settings',
            'desks'      => [Domain::Core, Domain::Purchase, Domain::Finances],
            'order'      => 28,
        ],
        'inventory' => [
            'model'      => InventorySetting::class,
            'controller' => InventorySettingController::class,
            'page'       => 'Settings/Modules/InventorySettings',
            'icon'       => 'Warehouse',
            'title'      => 'inventory.setting.title',
            'label'      => 'Inventory Settings',
            'desks'      => [Domain::Core, Domain::Inventory, Domain::Purchase, Domain::Sales],
            'order'      => 29,
        ],
    ],
];
