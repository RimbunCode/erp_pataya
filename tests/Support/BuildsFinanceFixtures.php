<?php

namespace Tests\Support;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
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

        $models = array_values(array_unique([User::class, FormatingSeries::class, Account::class, GeneralLedger::class, Journal::class, ...$models]));

        // Semua tabel, bukan hanya model di `$models`: factory (mis. Supplier, Country) menyentuh `is_example`
        // tanpa `initPermissions()`, yang tidak bisa dipanggil untuk Account dan Supplier sekaligus karena
        // keduanya membuat indeks `lft_index` (nama indeks SQLite bersifat global).
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
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

    /**
     * Gudang, satuan, item, varian, dan satuan item default. Model `Unit`, `Warehouse`, `Item`, `ItemVariant`,
     * dan `StockLedgerEntry` harus sudah di `setUpFinanceFixtures()`.
     *
     * @return array{warehouse: Warehouse, variant: ItemVariant, itemUnit: ItemUnit}
     */
    protected function makeInventoryFixture(string $code = 'ITEM-1'): array {
        $warehouse = Warehouse::create(['branch_id' => $this->branch->id, 'name' => "Gudang {$code}", 'code' => "WH-{$code}"]);
        $unit      = Unit::create(['code' => "U-{$code}", 'name' => 'Piece']);
        $item      = Item::create(['code' => $code, 'name' => "Item {$code}", 'default_unit_id' => $unit->id, 'type' => 'inventory']);
        $variant   = ItemVariant::create([
            'item_id'         => $item->id,
            'code'            => "{$code}-VAR",
            'item_code'       => $code,
            'item_name'       => "Item {$code}",
            'type'            => 'inventory',
            'default_unit_id' => $unit->id,
        ]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'is_default' => true]);

        return ['warehouse' => $warehouse, 'variant' => $variant, 'itemUnit' => $itemUnit];
    }

    /**
     * Faktur penjualan berstatus SUBMITTED dengan satu baris (2 × 1.000, pajak 10%), siap di-approve lewat
     * `SalesInvoiceService::onApproved`. Model `SalesInvoice` harus sudah di `setUpFinanceFixtures()`.
     *
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $itemAttributes
     */
    protected function makeSalesInvoice(Account $receivable, Account $income, array $attributes = [], array $itemAttributes = []): SalesInvoice {
        $invoice = SalesInvoice::factory()->create([
            'date'              => now()->subDays(5),
            'debit_account_id'  => $receivable->id,
            'income_account_id' => $income->id,
            'branch_id'         => $this->branch->id,
            'status'            => [FormStatus::SUBMITTED],
            ...$attributes,
        ]);

        SalesInvoiceItem::factory()->create([
            'sales_invoice_id' => $invoice->id,
            'quantity'         => 2,
            'price'            => 1000,
            'tax_rate'         => 10,
            ...$itemAttributes,
        ]);

        return $invoice->fresh();
    }

    /**
     * Faktur penjualan UNPAID dengan jadwal bayar penuh, siap dibayar lewat `PaymentEntry`. Default satu jadwal;
     * `$schedulePortions` (persen, jumlah 100) membuat beberapa jadwal dengan `due_date` berbeda (cicilan).
     * Model `SalesInvoice`, `PaymentSchedule`, dan `PaymentEntry` harus sudah di `setUpFinanceFixtures()`.
     *
     * @param  list<float|int>  $schedulePortions
     */
    protected function makeUnpaidSalesInvoice(float $amount, array $schedulePortions = [100]): SalesInvoice {
        $invoice = SalesInvoice::create([
            'date'        => now()->subDays(2),
            'amount'      => $amount,
            'paid_amount' => 0,
            'status'      => [FormStatus::UNPAID],
            'branch_id'   => $this->branch->id,
            'code'        => 'SI-' . Str::upper(Str::random(8)),
        ]);

        $this->makePaymentSchedules($invoice, $amount, $schedulePortions);

        return $invoice;
    }

    /**
     * Faktur pembelian UNPAID dengan jadwal bayar penuh, siap dibayar lewat `PaymentEntry` bertipe `pay`.
     * Model `PurchaseInvoice`, `PaymentSchedule`, dan `PaymentEntry` harus sudah di `setUpFinanceFixtures()`.
     *
     * @param  list<float|int>  $schedulePortions
     */
    protected function makeUnpaidPurchaseInvoice(float $amount, array $schedulePortions = [100]): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'        => now()->subDays(2),
            'amount'      => $amount,
            'paid_amount' => 0,
            'status'      => [FormStatus::UNPAID],
            'branch_id'   => $this->branch->id,
            'code'        => 'PI-' . Str::upper(Str::random(8)),
        ]);

        $this->makePaymentSchedules($invoice, $amount, $schedulePortions);

        return $invoice;
    }

    /**
     * @param  list<float|int>  $portions
     */
    private function makePaymentSchedules(Model $invoice, float $amount, array $portions): void {
        foreach (array_values($portions) as $index => $portion) {
            PaymentSchedule::create([
                'payment_scheduleable_type' => $invoice::class,
                'payment_scheduleable_id'   => $invoice->id,
                'invoice_portion'           => $portion,
                'payment_amount'            => $amount * $portion / 100,
                'paid_amount'               => 0,
                'for_internal'              => false,
                'due_date'                  => now()->addDays(7 + $index),
            ]);
        }
    }

    /**
     * Payment Entry DRAFT atas faktur; `onApproved` dipanggil test. Akun mengikuti filter form: `receive` atas
     * Sales Invoice memakai `$paidFrom` = piutang dan `$paidTo` = kas/bank; `pay` atas Purchase Invoice memakai
     * `$paidFrom` = kas/bank dan `$paidTo` = utang. Jenis pembayaran dan pihak diturunkan dari jenis faktur.
     *
     * @param  array<string, mixed>  $extra
     */
    protected function makePaymentEntry(SalesInvoice|PurchaseInvoice $invoice, float $amount, Account $paidFrom, Account $paidTo, array $extra = []): PaymentEntry {
        $isPurchase = $invoice instanceof PurchaseInvoice;
        $partyId    = (string) Str::ulid();
        $party      = ['id' => $partyId, 'name' => ($isPurchase ? 'Pemasok ' : 'Pelanggan ') . Str::random(4), 'created_at' => now(), 'updated_at' => now()];
        if ($isPurchase) {
            // Accessor `Supplier::address` membaca `country->name`; log audit saat PE dibuat memuatnya.
            $party['country_id'] = Country::factory()->create()->code;
        }
        DB::table($isPurchase ? 'suppliers' : 'customers')->insert($party);

        return PaymentEntry::create([
            'date'                 => now()->subDay()->startOfDay(),
            'payment_type'         => $isPurchase ? 'pay' : 'receive',
            'partyable_type'       => $isPurchase ? Supplier::class : Customer::class,
            'partyable_id'         => $partyId,
            'paymentable_type'     => $invoice::class,
            'paymentable_id'       => $invoice->id,
            'paid_amount'          => $amount,
            'base_paid_amount'     => $amount,
            'exchange_rate'        => 1,
            'account_paid_to_id'   => $paidTo->id,
            'account_paid_from_id' => $paidFrom->id,
            'status'               => [FormStatus::DRAFT],
            'branch_id'            => $this->branch->id,
            'code'                 => 'PE-' . Str::upper(Str::random(8)),
            ...$extra,
        ]);
    }

    /**
     * Baris GL dokumen (termasuk yang di-soft-delete), terurut stabil untuk perbandingan.
     *
     * @return Collection<int, GeneralLedger>
     */
    protected function ledgerOf(Model $document): Collection {
        return GeneralLedger::withTrashed()
            ->where('referenceable_type', $document::class)
            ->where('referenceable_id', $document->getKey())
            ->orderBy('debit', 'desc')->orderBy('account_id')
            ->get();
    }

    /**
     * Mengunci jurnal yang diposting sebuah dokumen: jumlah baris, pasangan akun, nilai debit/kredit,
     * tanggal transaksi, dan referenceable. Dipakai characterization test (Fase 0) dan parity test (Fase 2).
     *
     * @param  list<array{account: Account, against: Account, debit: float, credit: float}>  $expected
     */
    protected function assertLedger(Model $document, array $expected, ?string $expectedDate = null, float $delta = 0.01): void {
        $actual = $this->ledgerOf($document);

        $this->assertCount(count($expected), $actual, 'Jumlah baris GL ' . class_basename($document) . ' berbeda.');

        foreach ($expected as $line) {
            $match = $actual->first(fn (GeneralLedger $row) => $row->account_id === $line['account']->id && $row->against_account_id === $line['against']->id);

            $this->assertNotNull($match, "Tidak ada baris GL {$line['account']->account_name} lawan {$line['against']->account_name}.");
            $this->assertEqualsWithDelta($line['debit'], $match->debit, $delta, "Debit {$line['account']->account_name}");
            $this->assertEqualsWithDelta($line['credit'], $match->credit, $delta, "Kredit {$line['account']->account_name}");
            $this->assertSame($document::class, $match->referenceable_type);
            $this->assertSame($document->getKey(), $match->referenceable_id);

            if ($expectedDate !== null) {
                $this->assertSame($expectedDate, $match->transaction_date->toDateString(), 'transaction_date GL');
            }
        }
    }

    protected function assertPostingStatus(Model $document, string $status): void {
        $row = GlPostingStatus::where('referenceable_type', $document::class)->where('referenceable_id', $document->getKey())->first();

        $this->assertNotNull($row, 'GlPostingStatus tidak dibuat.');
        $this->assertSame($status, $row->status->value);
        $this->assertSame($status === 'posted', $row->posted_at !== null);
    }
}
