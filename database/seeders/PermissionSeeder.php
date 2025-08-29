<?php

namespace Database\Seeders;

use App\Models\User\Permission;
use App\Traits\DataTable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

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


    // $modulePermissions = [
    //   'User' => [
    //     [
    //       'name' => 'Manage Users',
    //       'model' => \App\Models\User\User::class,
    //       'permissions' => $this->getPermissions([
    //         'submit',
    //         'cancel',
    //         'amend',
    //         'import',
    //         'export',
    //         'share',
    //         'print',
    //       ]),
    //     ],
    //     [
    //       'name' => 'Roles',
    //       'model' => \App\Models\User\Role::class,
    //       'permissions' => $this->getPermissions([
    //         'import',
    //         'export',
    //         'share',
    //         'print',
    //         'submit',
    //         'cancel',
    //         'amend',
    //       ]),
    //     ]
    //   ],
    //   'Setting' => [
    //     [
    //       'name' => 'Company',
    //       'model' => \App\Models\Core\Preference::class,
    //       'permissions' => $this->getPermissions([
    //         'select',
    //         'create',
    //         'delete',
    //         'submit',
    //         'cancel',
    //         'amend',
    //         'print',
    //         'import',
    //         'export',
    //         'share',
    //       ]),
    //     ],
    //     [
    //       'name' => 'Branches',
    //       'model' => \App\Models\Core\Branch::class,
    //       'permissions' => $this->getPermissions([
    //         'import',
    //         'export',
    //         'share',
    //         'print',
    //         'submit',
    //         'cancel',
    //         'amend',
    //       ]),
    //     ]
    //   ],
    //   'Inventory' => [
    //     [
    //       'name' => 'Warehouses',
    //       'model' => \App\Models\Inventory\Warehouse::class,
    //       'permissions' => $this->getPermissions([
    //         'share',
    //         'submit',
    //         'cancel',
    //         'amend',
    //       ]),
    //     ]
    //   ],
    //   'Supplier' => [
    //     [
    //       'name' => 'Suppliers',
    //       'model' => \App\Models\Purchase\Supplier::class,
    //       'permissions' => $this->getPermissions([
    //         'share',
    //         'submit',
    //         'cancel',
    //         'amend',
    //       ]),
    //     ]
    //   ]
    // ];


    // get the root namespace defined for the app
    $namespace = 'App\Models';
    // load classes composer knows about
    $autoload = include base_path('/vendor/composer/autoload_classmap.php');

    foreach ($autoload as $className => $path) {
      // skip if we are not in the root namespace, ie App\, to ignore other vendor packages, of which there are a lot (dd($autoload) to see)
      if (!\str_contains($className, $namespace)) {
        continue;
      }

      // check if class is extending Model
      try {
        if (
          in_array(DataTable::class, class_uses_recursive($className), true)
        ) {
          $className::initPermissions();
        }
      } catch (\Throwable $e) {
        print_r("\e[39m" . $className . " \e[91m(ERROR) \e[39m" . \PHP_EOL);
        print_r($e);
      }
    }
  }
}
