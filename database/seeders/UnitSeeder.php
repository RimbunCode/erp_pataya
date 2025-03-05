<?php

namespace Database\Seeders;

use App\Models\Core\Unit;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UnitSeeder extends Seeder {
  /**
   * Run the database seeds.
   */
  public function run(): void {
    $units = [
      'Area' => [
        'SQUARE_METER' => [
          'code' => 'm2',
          'conversion_factor' => 1
        ],
        'SQUARE_KILOMETER' => [
          'code' => 'km2',
          'conversion_factor' => 1 * 1000000,
        ],

        'SQUARE_CENTIMETER' => [
          'code' => 'cm2',
          'conversion_factor' => 1 / 10000
        ],
        'SQUARE_MILLIMETER' => [
          'code' => 'mm2',
          'conversion_factor' => 1 / 1000000
        ],

        'SQUARE_INCH' => [
          'code' => 'in2',
          'conversion_factor' => 1 * 0.00064516
        ],
        'SQUARE_FOOT' => [
          'code' => 'ft2',
          'conversion_factor' => 1 * 0.09290304
        ],
        'SQUARE_YARD' => [
          'code' => 'yd2',
          'conversion_factor' => 1 * 0.83612736
        ],
        'SQUARE_MILE' => [
          'code' => 'mi2',
          'conversion_factor' => 1 * 2589988.110336
        ],

        'ACRE' => [
          'code' => 'ac',
          'conversion_factor' => 1 * 4046.8564224
        ],
        'HECTARE' => [
          'code' => 'ha',
          'conversion_factor' => 1 * 10000
        ],
      ],
      'Length' => [
        'METER' => [
          'code' => 'm',
          'conversion_factor' => 1
        ],
        'CENTIMETER' => [
          'code' => 'cm',
          'conversion_factor' => 1 / 100
        ],
        'MILLIMETER' => [
          'code' => 'mm',
          'conversion_factor' => 1 / 1000
        ],
        'KILOMETER' => [
          'code' => 'km',
          'conversion_factor' => 1000
        ],
        'INCH' => [
          'code' => 'in',
          'conversion_factor' => 0.0254
        ],
        'FOOT' => [
          'code' => 'ft',
          'conversion_factor' => 0.3048
        ],

        'YARD' => [
          'code' => 'yd',
          'conversion_factor' => 0.9144
        ],
        'MILE' => [
          'code' => 'mi',
          'conversion_factor' => 1609.344
        ],
      ],
      'Volume' => [
        'MILLILITER' => [
          'code' => 'ml',
          'conversion_factor' => 1 / 1000
        ],
        'LITER' => [
          'code' => 'l',
          'conversion_factor' => 1
        ],
        'CUBIC_METER' => [
          'code' => 'm3',
          'conversion_factor' => 1000
        ],
        'CUBIC_INCH' => [
          'code' => 'in3',
          'conversion_factor' => 1 / 61.0237441
        ],
        'CUBIC_FOOT' => [
          'code' => 'ft3',
          'conversion_factor' => 28.316846592
        ],


      ],
      'Weight' => [
        'MILLIGRAM' => [
          'code' => 'mg',
          'conversion_factor' => 1 / 1000
        ],
        'GRAM' => [
          'code' => 'g',
          'conversion_factor' => 1
        ],
        'KILOGRAM' => [
          'code' => 'kg',
          'conversion_factor' => 1000
        ],
        'TON' => [
          'code' => 't',
          'conversion_factor' => 1000000
        ],
        'OUNCE' => [
          'code' => 'oz',
          'conversion_factor' => 28.349523125
        ],
        'POUND' => [
          'code' => 'lb',
          'conversion_factor' => 453.59237
        ],
      ],
      'Quantity' => [
        'PIECE' => [
          'code' => 'pcs',
          'conversion_factor' => 1
        ],
        'LUSIN' => [
          'code' => 'lusin',
          'conversion_factor' => 12
        ],
        'GROSS' => [
          'code' => 'grs',
          'conversion_factor' => 144
        ],
        'KODI' => [
          'code' => 'kodi',
          'conversion_factor' => 20
        ],
        'RIM' => [
          'code' => 'rim',
          'conversion_factor' => 500
        ]
      ]
    ];

    foreach ($units as $group => $unit) {
      foreach ($unit as $name => $dataUnit) {
        Unit::create([
          'name' =>  \ucwords(\strtolower(\str_replace('_', ' ', $name))),
          'code' => $dataUnit['code'],
          'group' => $group,
          'conversion_factor' => $dataUnit['conversion_factor'],
          'is_default' => true,
        ]);
      }
    }
  }
}
