<?php

namespace App\Services\Migration\Migrators\Purchase\Suppliers;

use App\Models\Purchase\Supplier;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupplierMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'suppliers';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Supplier::class;

    /**
     * Perbaikan nilai country non-standar di legacy menjadi kode ISO yang valid.
     *
     * @var array<string, string>
     */
    protected array $countryAliases = [
        'INDONESIA' => 'ID',
    ];

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $validCountryCodes = DB::table('countries')->pluck('code')->all();

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('supplier_id')
            ->chunk(500, function ($records) use ($validCountryCodes) {
                foreach ($records as $record) {
                    $mappedData = $this->transform((array) $record, [
                        'name'       => 'supp_name',
                        'email'      => fn ($row) => $row['email'] !== '' ? $row['email'] : null,
                        'street'     => fn ($row) => $row['address'] !== '' ? $row['address'] : null,
                        'city'       => fn ($row) => $row['city'] !== '' ? $row['city'] : null,
                        'province'   => fn ($row) => $row['state'] !== '' ? $row['state'] : null,
                        'zip_code'   => fn ($row) => $row['zipcode'] !== '' ? $row['zipcode'] : null,
                        'country_id' => function ($row) use ($validCountryCodes) {
                            $code = $this->countryAliases[$row['country']] ?? $row['country'];

                            return in_array($code, $validCountryCodes, true) ? $code : null;
                        },
                        'is_disabled' => fn ($row) => (bool) $row['inactive'],
                        'banks'       => fn ($row) => array_values(array_filter([
                            $row['bank_account01'],
                            $row['bank_account02'],
                        ])),
                    ]);

                    $newUlid                  = (string) Str::ulid();
                    $mappedData['id']         = $newUlid;
                    $mappedData['created_at'] = $record->created_at ?? now();
                    $mappedData['updated_at'] = $record->updated_at ?? now();
                    $mappedData['banks']      = json_encode($mappedData['banks']);

                    DB::table('suppliers')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->supplier_id, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }
}
