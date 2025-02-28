<?php

namespace Database\Seeders;

use App\Models\User\Permission;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder {
  private $defaultPermissions = [
    'select',
    'read',
    'write',
    'create',
    'delete',
    'submit',
    'cancel',
    'amend',
    'print',
    'import',
    'export',
    'share',
  ];

  private function getPermissions($except = []) {
    return array_values(array_diff($this->defaultPermissions, $except));
  }
  /**
   * Run the database seeds.
   */
  public function run(): void {


    $modulePermissions = [
      'User' => [
        [
          'name' => 'Manage Users',
          'model' => \App\Models\User\User::class,
          'permissions' => $this->getPermissions([
            'submit',
            'cancel',
            'amend',
            'import',
            'export',
            'share',
            'print',
          ]),
        ],
        [
          'name' => 'Roles',
          'model' => \App\Models\User\Role::class,
          'permissions' => $this->getPermissions([
            'import',
            'export',
            'share',
            'print',
            'submit',
            'cancel',
            'amend',
          ]),
        ]
      ],
      'Setting' => [
        [
          'name' => 'Company',
          'model' => \App\Models\Core\Preference::class,
          'permissions' => $this->getPermissions([
            'select',
            'create',
            'delete',
            'submit',
            'cancel',
            'amend',
            'print',
            'import',
            'export',
            'share',
          ]),
        ],
        [
          'name' => 'Branches',
          'model' => \App\Models\Core\Branch::class,
          'permissions' => $this->getPermissions([
            'import',
            'export',
            'share',
            'print',
            'submit',
            'cancel',
            'amend',
          ]),
        ]
      ],
      'Inventory' => [
        [
          'name' => 'Warehouses',
          'model' => \App\Models\Inventory\Warehouse::class,
          'permissions' => $this->getPermissions([
            'share',
            'submit',
            'cancel',
            'amend',
          ]),
        ]
      ],
      'Supplier' => [
        [
          'name' => 'Suppliers',
          'model' => \App\Models\Purchase\Supplier::class,
          'permissions' => $this->getPermissions([
            'share',
            'submit',
            'cancel',
            'amend',
          ]),
        ]
      ]
    ];

    foreach ($modulePermissions as $module => $permissions) {
      foreach ($permissions as $permission) {
        Permission::create([
          'module' => $module,
          'name' => $permission['name'],
          'model' => $permission['model'],
          'permissions' => $permission['permissions'],
        ]);
      }
    }
  }
}
