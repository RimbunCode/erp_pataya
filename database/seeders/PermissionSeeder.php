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
      'Users' => [
        [
          'name' => 'Manage Users',
          'model' => \App\Models\User\User::class,
          'permissions' => $this->getPermissions([
            'submit',
            'cancel',
            'amend',
          ]),
        ],
        [
          'name' => 'Roles',
          'model' => \App\Models\User\Role::class,
          'permissions' => $this->getPermissions([
            'import',
            'export',
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
