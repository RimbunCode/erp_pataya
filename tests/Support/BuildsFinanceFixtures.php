<?php

namespace Tests\Support;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockEntry;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Fixture bersama test Finance (audit Fase 0, characterization, dan kelak parity test Fase 2).
 *
 * Dipanggil dari `setUp()` setelah `parent::setUp()`: `$this->setUpFinanceFixtures([Model::class, ...])`.
 * Menyiapkan kolom runtime tabel `DataTable` (`initPermissions()` dan `is_example`, mengikuti pola
 * `GeneralLedgerControllerTest`), user yang login, cabang, dan queue sinkron.
 */
trait BuildsFinanceFixtures {
    protected User $user;
    protected Branch $branch;

    /**
     * @param  list<class-string<Model>>  $models  model tambahan yang `initPermissions()`-nya perlu dijalankan
     */
    protected function setUpFinanceFixtures(array $models = []): void {
        $this->withoutMiddleware([QueryDetectorMiddleware::class]);
        config(['queue.default' => 'sync']);

        $models = array_values(array_unique([User::class, FormatingSeries::class, Account::class, GeneralLedger::class, ...$models]));

        foreach (['preferences', ...array_map(fn (string $model) => (new $model)->getTable(), $models)] as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($blueprint) => $blueprint->boolean('is_example')->default(false));
            }
        }

        foreach ($models as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);
        Auth::login($this->user);
    }

    protected function makeAccount(string $number, string $name, string $rootType = 'asset', ?string $balanceType = 'debit', ?string $accountType = null, float $balanceAmount = 0): Account {
        return Account::create([
            'account_name'   => $name,
            'account_number' => $number,
            'root_type'      => $rootType,
            'report_type'    => in_array($rootType, ['asset', 'liability', 'equity'], true) ? 'balance_sheet' : 'profit_and_loss',
            'balance_type'   => $balanceType,
            'account_type'   => $accountType,
            'balance_amount' => $balanceAmount,
        ]);
    }

    /**
     * Satu baris GL. `$referenceable` berupa model dokumen, atau pasangan [kelas, id] untuk dokumen yang
     * sengaja tidak ada / tidak dikenal.
     *
     * @param  Model|array{0: string, 1: string}  $referenceable
     */
    protected function makeLedger(Model|array $referenceable, Account $account, Account $against, float $debit, float $credit, mixed $date = null): GeneralLedger {
        [$type, $id] = $referenceable instanceof Model ? [$referenceable::class, $referenceable->getKey()] : $referenceable;

        return GeneralLedger::create([
            'referenceable_type' => $type,
            'referenceable_id'   => $id,
            'account_id'         => $account->id,
            'against_account_id' => $against->id,
            'branch_id'          => $this->branch->id,
            'debit'              => $debit,
            'credit'             => $credit,
            'transaction_date'   => $date ?? now(),
        ]);
    }

    /**
     * Pasangan debit/kredit seimbang untuk satu dokumen.
     *
     * @param  Model|array{0: string, 1: string}  $referenceable
     * @return array{0: GeneralLedger, 1: GeneralLedger}
     */
    protected function makeBalancedPosting(Model|array $referenceable, Account $debitAccount, Account $creditAccount, float $amount, mixed $date = null): array {
        $date ??= now();

        return [
            $this->makeLedger($referenceable, $debitAccount, $creditAccount, $amount, 0, $date),
            $this->makeLedger($referenceable, $creditAccount, $debitAccount, 0, $amount, $date),
        ];
    }

    /**
     * Pasangan [kelas, id] untuk dokumen yang tidak ada di database.
     *
     * @return array{0: string, 1: string}
     */
    protected function missingDocument(string $class): array {
        return [$class, (string) Str::ulid()];
    }

    /**
     * @param  list<FormStatus>  $status
     */
    protected function makeStockEntry(array $status = [FormStatus::APPROVED], string $type = 'item_issue'): StockEntry {
        return StockEntry::create([
            'code'      => 'SE-' . Str::upper(Str::random(8)),
            'date'      => now(),
            'type'      => $type,
            'status'    => $status,
            'branch_id' => $this->branch->id,
        ]);
    }
}
