<?php

namespace App\Services\Migration\Migrators\Inventory\Units;

use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;

class UnitMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     */
    protected string $sourceTable = 'item_unit';

    /**
     * Alias abbr legacy -> code unit yang sudah ada di UnitSeeder.
     * UnitSeeder adalah kebenaran (source of truth); migrator ini tidak pernah
     * membuat unit baru, hanya memetakan old_id legacy ke ULID unit seeder.
     *
     * @var array<string, string>
     */
    protected array $legacyCodeAliases = [
        'pcs'  => 'pcs',
        'pail' => 'pail',
        'set'  => 'set',
        'unit' => 'unit',
        'kit'  => 'kit',
        'jam'  => 'hour',
        'ltr'  => 'l',
        'ls'   => 'ls',
        'm'    => 'm',
        'm3'   => 'm3',
        'bln'  => 'month',
        'drm'  => 'drum',
        'hari' => 'day',
        'inv'  => 'unit',
    ];

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $existingUnitIds = DB::table('units')->pluck('id', 'code')
            ->mapWithKeys(fn ($id, $code) => [strtolower((string) $code) => $id]);

        $processed = 0;
        $skipped   = 0;

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy('id')
            ->chunk(500, function ($records) use ($existingUnitIds, &$processed, &$skipped) {
                foreach ($records as $record) {
                    $legacyAbbr = strtolower((string) $record->abbr);
                    $seederCode = $this->legacyCodeAliases[$legacyAbbr] ?? $legacyAbbr;
                    $existingId = $existingUnitIds[$seederCode] ?? null;

                    if ($existingId === null) {
                        $this->log("Unit seeder untuk abbr legacy '{$record->abbr}' (code '{$seederCode}') tidak ditemukan. Baris dilewati.", 'warning');
                        $skipped++;

                        continue;
                    }

                    $this->mapId($this->sourceTable, $record->id, (string) $existingId);
                    $processed++;
                }

                $this->log('Berhasil memproses ' . count($records) . ' baris...');
            });

        $this->log("Migrasi {$this->sourceTable} selesai. Dipetakan: {$processed}, dilewati: {$skipped}.");
    }
}
