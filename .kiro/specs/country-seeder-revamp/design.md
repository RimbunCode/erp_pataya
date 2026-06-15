# Design Document: Country Seeder Revamp

## Overview

Migrasi `CountrySeeder` dari API `restcountries.com/v3.1` (usang) ke `api.restcountries.com/countries/v5`.
Sekaligus memperluas schema `countries` dan `currencies` dengan field tambahan, serta menambahkan
halaman CRUD Countries dan Currencies di module Core dengan navigasi pada group Settings.

## Architecture

```
API restcountries.com/countries/v5
        │
        ▼
CountrySeeder (loop pagination, max 100/req)
        │
        ├─► countries table (code, name, lang_code, url_flag, timezones JSON)
        │         │
        │         └─► UTC offset → IANA lookup (DateTimeZone::listIdentifiers)
        │
        └─► currencies table (code, name, symbol, number_format)
                  │
                  └─► derive dari decimal_separator + thousands_separator

Settings Routes (/settings/countries, /settings/currencies)
        │
        ├─► CountryController → Settings/Countries/{Index,Show,Form}.jsx
        └─► CurrencyController → Settings/Currencies/{Index,Show,Form}.jsx

AppSidebar
        └─► group Settings
                ├─► Countries  (/settings/countries)
                └─► Currencies (/settings/currencies)
```

## API Integration

### Endpoint
```
GET https://api.restcountries.com/countries/v5
Authorization: Bearer {RC_API_KEY}
```

### Query Parameters
- `limit=100` — maksimal per request
- `offset={n}` — untuk pagination
- `response_fields=names.official,codes.alpha_2,languages,flag.url_svg,timezones,currencies,number_formats`

### Response Structure
```json
{
  "data": {
    "objects": [
      {
        "names": { "official": "Republic of Indonesia" },
        "codes": { "alpha_2": "ID" },
        "languages": [{ "bcp47": "id", "name": "Indonesian" }],
        "flag": { "url_svg": "https://..." },
        "timezones": ["UTC+07:00", "UTC+08:00", "UTC+09:00"],
        "currencies": [
          { "code": "IDR", "name": "Indonesian rupiah", "symbol": "Rp" }
        ],
        "number_formats": {
          "decimal_separator": ",",
          "thousands_separator": "."
        }
      }
    ],
    "meta": { "total": 249, "count": 100, "limit": 100, "offset": 0, "more": true }
  }
}
```

### Pagination Loop
```php
$offset = 0;
$allCountries = collect();
do {
    $response = Http::withToken(config('services.restcountries.key'))
        ->get('https://api.restcountries.com/countries/v5', [
            'limit' => 100,
            'offset' => $offset,
            'response_fields' => '...',
        ]);
    $body = $response->json('data');
    $allCountries = $allCountries->merge($body['objects']);
    $offset += 100;
} while ($body['meta']['more'] ?? false);
```

## Database Schema Changes

### countries table (tambah kolom)
```php
$table->string('lang_code')->nullable();       // BCP47, e.g. "id", "en"
$table->string('url_flag')->nullable();        // SVG flag URL
$table->json('timezones')->nullable();         // ["Asia/Jakarta", "Asia/Makassar", ...]
```

### currencies table (tambah kolom)
```php
$table->string('symbol')->nullable();          // e.g. "$", "Rp", "€"
$table->string('number_format')->nullable();   // e.g. "#.###,##" atau "#,###.##"
```

## Timezone Conversion

Konversi UTC offset string (e.g. `"UTC+07:00"`) ke IANA timezone names menggunakan PHP built-in:

```php
private function buildTimezoneMap(): array
{
    $map = [];
    foreach (\DateTimeZone::listIdentifiers() as $identifier) {
        $tz = new \DateTimeZone($identifier);
        $offset = $tz->getOffset(new \DateTime('now', $tz));
        $hours = (int) ($offset / 3600);
        $minutes = abs(($offset % 3600) / 60);
        $sign = $hours >= 0 ? '+' : '-';
        $key = sprintf('UTC%s%02d:%02d', $sign, abs($hours), $minutes);
        $map[$key][] = $identifier;
    }
    return $map;
}
```

## number_format Derivation

```php
private function deriveNumberFormat(array $numberFormats): string
{
    $dec = $numberFormats['decimal_separator'] ?? '.';
    $thou = $numberFormats['thousands_separator'] ?? ',';
    // e.g. dec=",", thou="." → "#.###,##"
    return '#' . $thou . '###' . $dec . '##';
}
```

## Components and Interfaces

### Backend

**`app/Http/Controllers/Core/CountryController.php`**
- `index()` → `Inertia::render('Settings/Countries/Index')`
- `show(Country $country)` → `Inertia::render('Settings/Countries/Show', ['country' => ...])`
- `store(CountryRequest $request)` → create + redirect
- `update(CountryRequest $request, Country $country)` → update + redirect
- `destroy(Country $country)` → delete + redirect

**`app/Http/Controllers/Core/CurrencyController.php`**
- Pola sama dengan CountryController

**`app/Http/Requests/Core/CountryRequest.php`**
- Validasi: `code` required string max:2, `name` required string, `lang_code` nullable, `url_flag` nullable url, `timezones` nullable array

**`app/Http/Requests/Core/CurrencyRequest.php`**
- Validasi: `code` required string max:3, `name` required string, `symbol` nullable, `number_format` nullable

**`routes/web.php`** (tambah ke group `/settings`)
```php
Route::resourceDetail('country', CountryController::class);
Route::resourceDetail('currency', CurrencyController::class);
```

### Frontend

**`resources/js/Pages/Settings/Countries/Index.jsx`**
- `DataTable2` dengan `templateItem` menampilkan code (badge) + name + flag emoji
- Form dialog untuk create/edit

**`resources/js/Pages/Settings/Countries/Show.jsx`**
- `FormPage` dengan title = country name
- Tampilkan flag SVG, timezones

**`resources/js/Pages/Settings/Countries/Form.jsx`**
- Fields: code, name, lang_code, url_flag, timezones

**`resources/js/Pages/Settings/Currencies/Index.jsx`**
- `DataTable2` dengan templateItem: code (badge) + name + symbol

**`resources/js/Pages/Settings/Currencies/Show.jsx`**
- `FormPage` dengan title = currency name

**`resources/js/Pages/Settings/Currencies/Form.jsx`**
- Fields: code, name, symbol, number_format

**`resources/js/Components/Sidebar/AppSidebar.jsx`**
```js
// Tambah ke items array group Settings:
{
  title: "Countries",
  url: "/settings/countries",
  urlPattern: "/settings/countries/*",
  model: "App\\Models\\Core\\Country",
},
{
  title: "Currencies",
  url: "/settings/currencies",
  urlPattern: "/settings/currencies/*",
  model: "App\\Models\\Core\\Currency",
},
```

## Configuration

**`.env.example`**
```
RC_API_KEY=
```

**`config/services.php`** (tambah entry)
```php
'restcountries' => [
    'key' => env('RC_API_KEY'),
    'url' => 'https://api.restcountries.com/countries/v5',
],
```

## Model Updates

**`app/Models/Core/Country.php`**
```php
protected function casts(): array
{
    return ['timezones' => 'array'];
}

protected array $configColumns = [
    'code'      => ['show' => true, 'order' => 0],
    'name'      => ['show' => true, 'order' => 1],
    'lang_code' => ['show' => true, 'order' => 2],
    'url_flag'  => ['show' => false, 'order' => 3],
    'timezones' => ['show' => false, 'order' => 4],
];
```

**`app/Models/Core/Currency.php`**
```php
protected array $configColumns = [
    'code'          => ['show' => true, 'order' => 0],
    'name'          => ['show' => true, 'order' => 1],
    'symbol'        => ['show' => true, 'order' => 2],
    'number_format' => ['show' => false, 'order' => 3],
];
```
