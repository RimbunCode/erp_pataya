<?php

namespace App\Services\Migration\Migrators\Sales\Customers;

use App\Models\Sales\Customer;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'debtors_master';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Customer::class;

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('debtor_no')
            ->chunk(500, function ($records) {
                foreach ($records as $record) {
                    $mappedData = $this->transform((array) $record, [
                        'name'        => 'name',
                        'email'       => fn ($row) => $row['email'] !== '' ? $row['email'] : null,
                        'phone'       => fn ($row) => $row['phone'] !== '' ? $row['phone'] : null,
                        'vat'         => fn ($row) => $row['vat_no'] !== '' ? $row['vat_no'] : null,
                        'is_disabled' => fn ($row) => (bool) $row['inactive'],
                    ]);

                    $newUlid                  = (string) Str::ulid();
                    $mappedData['id']         = $newUlid;
                    $mappedData['created_at'] = $record->created_at ?? now();
                    $mappedData['updated_at'] = $record->updated_at ?? now();

                    DB::table('customers')->updateOrInsert(['id' => $newUlid], $mappedData);

                    $this->mapId($this->sourceTable, $record->debtor_no, $newUlid);

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);

                    $this->migrateBranches($record->debtor_no, $newUlid);
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }

    /**
     * Migrasi cabang/alamat pelanggan (`cust_branch`) menjadi `branches` polymorphic
     * milik Customer (lihat App\Models\Sales\Customer::branches()).
     */
    protected function migrateBranches(int $debtorNo, string $customerUlid): void {
        $branches = DB::connection($this->sourceConnection)
            ->table('cust_branch')
            ->where('debtor_no', $debtorNo)
            ->orderBy('branch_code')
            ->get();

        foreach ($branches as $index => $branch) {
            $newBranchUlid = (string) Str::ulid();

            DB::table('branches')->updateOrInsert(['id' => $newBranchUlid], [
                'id'                  => $newBranchUlid,
                'name'                => $branch->br_name !== '' ? $branch->br_name : "Branch {$branch->branch_code}",
                'branchable_type'     => Customer::class,
                'branchable_id'       => $customerUlid,
                'is_main_branch'      => $index === 0,
                'shipping_street'     => $branch->shipping_street ?: null,
                'shipping_city'       => $branch->shipping_city ?: null,
                'shipping_state'      => $branch->shipping_state ?: null,
                'shipping_zip_code'   => $branch->shipping_zip_code ?: null,
                'shipping_country_id' => $branch->shipping_country_id ?: null,
                'billing_address'     => 'separate',
                'billing_street'      => $branch->billing_street ?: null,
                'billing_city'        => $branch->billing_city ?: null,
                'billing_state'       => $branch->billing_state ?: null,
                'billing_zip_code'    => $branch->billing_zip_code ?: null,
                'billing_country_id'  => $branch->billing_country_id ?: null,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);

            $this->mapId('cust_branch', $branch->branch_code, $newBranchUlid);
        }
    }
}
