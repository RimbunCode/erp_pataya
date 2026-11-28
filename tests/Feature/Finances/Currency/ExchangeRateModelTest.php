<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\ImmutableRateException;
use App\Models\Finances\ExchangeRate;
use App\Models\User\Permission;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 2.1 dan 2.4 (P-8): skema `exchange_rates` (F-12), izin, dan immutability kurs yang dirujuk.
 */
class ExchangeRateModelTest extends TestCase {
    use CreatesExchangeRates, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->seedCurrencies();
    }

    /**
     * @return array{columns: array<string, array<string, mixed>>, indexes: array<string, array<string, mixed>>}
     */
    private function snapshot(string $table): array {
        $columns = [];
        foreach (Schema::getColumns($table) as $column) {
            $columns[$column['name']] = ['type' => $column['type'], 'nullable' => $column['nullable'], 'default' => $column['default']];
        }
        ksort($columns);

        $indexes = [];
        foreach (Schema::getIndexes($table) as $index) {
            $indexes[$index['name']] = ['columns' => $index['columns'], 'unique' => $index['unique'], 'primary' => $index['primary']];
        }
        ksort($indexes);

        return ['columns' => $columns, 'indexes' => $indexes];
    }

    public function test_init_permissions_is_a_noop_on_exchange_rates(): void {
        $before = $this->snapshot('exchange_rates');

        ExchangeRate::initPermissions();

        $this->assertSame($before, $this->snapshot('exchange_rates'), 'initPermissions() mengubah skema exchange_rates.');
        $this->assertArrayNotHasKey('code', $before['columns']);
        $this->assertArrayNotHasKey('deleted_at', $before['columns']);
        $this->assertSame(['is_example'], $before['indexes']['exchange_rates_is_example_index']['columns']);
    }

    public function test_permissions_are_registered_as_required(): void {
        ExchangeRate::initPermissions();

        $permission = Permission::withoutGlobalScopes()->where('model', ExchangeRate::class)->firstOrFail();

        $this->assertEqualsCanonicalizing(['select', 'read', 'write', 'delete', 'import'], $permission->permissions);
    }

    public function test_unique_key_is_pair_type_and_date(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        // Tipe atau tanggal berbeda boleh.
        $this->makeRate('USD', 'IDR', '15600', '2026-11-27', RateType::Closing);
        $this->makeRate('USD', 'IDR', '15700', '2026-11-26');

        $this->expectException(QueryException::class);
        $this->makeRate('USD', 'IDR', '15800', '2026-11-27');
    }

    public function test_currency_codes_must_exist(): void {
        $this->expectException(QueryException::class);

        $this->makeRate('XXX', 'IDR', '1', '2026-11-27');
    }

    public function test_rate_is_exposed_as_fixed_scale_string(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $this->assertSame('15500.00000000', $rate->rate);
        $this->assertSame('2026-11-27', $rate->rate_date->toDateString());
        $this->assertSame(RateType::Transaction, $rate->rate_type);
    }

    public function test_rate_date_is_stored_as_a_plain_date_even_when_given_carbon_or_datetime(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        foreach ([
            ['EUR', Carbon::parse('2026-11-27 23:59:59')],
            ['JPY', new \DateTimeImmutable('2026-11-27 08:00:00')],
        ] as [$from, $date]) {
            (new ExchangeRate)->forceFill([
                'from_currency_code' => $from, 'to_currency_code' => 'IDR', 'rate_type' => RateType::Transaction,
                'rate'               => '100', 'rate_date' => $date, 'source' => 'manual',
            ])->save();
        }

        $stored = DB::table('exchange_rates')->pluck('rate_date')->unique()->values()->all();
        $this->assertSame(['2026-11-27'], $stored);

        // Kunci unik bertepatan: Carbon pada kunci yang sama ditolak, bukan membuat baris kedua.
        $this->expectException(QueryException::class);
        (new ExchangeRate)->forceFill([
            'from_currency_code' => 'USD', 'to_currency_code' => 'IDR', 'rate_type' => RateType::Transaction,
            'rate'               => '1', 'rate_date' => Carbon::parse('2026-11-27 10:00:00'), 'source' => 'manual',
        ])->save();
    }

    public function test_mass_assignment_is_blocked(): void {
        $this->expectException(MassAssignmentException::class);

        (new ExchangeRate)->fill(['from_currency_code' => 'USD', 'rate' => '1', 'source' => 'manual']);
    }

    public function test_referenced_rate_cannot_be_updated(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27', referenced: true);
        $this->assertTrue($rate->isReferenced());

        $this->expectException(ImmutableRateException::class);

        $rate->forceFill(['rate' => '15600'])->save();
    }

    public function test_referenced_rate_cannot_be_deleted(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27', referenced: true);

        $this->assertFalse($rate->canDelete());

        try {
            $rate->delete();
            $this->fail('Kurs yang dirujuk tidak boleh dihapus.');
        } catch (ValidationException|ImmutableRateException) {
            // Guard generik LinkModel (`canDelete`) bereaksi lebih dulu; guard model sebagai lapisan kedua.
            $this->assertDatabaseHas('exchange_rates', ['id' => $rate->id]);
        }
    }

    public function test_unreferenced_rate_can_be_corrected_and_deleted(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $rate->forceFill(['rate' => '15550'])->save();
        $this->assertSame('15550.00000000', $rate->refresh()->rate);

        $this->assertTrue($rate->canDelete());
        $rate->delete();
        $this->assertDatabaseMissing('exchange_rates', ['id' => $rate->id]);
    }

    public function test_correction_through_a_different_type_or_date_leaves_the_referenced_rate_untouched(): void {
        $referenced = $this->makeRate('USD', 'IDR', '15500', '2026-11-27', referenced: true);

        $correction = $this->makeRate('USD', 'IDR', '15520', '2026-11-27', RateType::Spot);

        $this->assertSame('15500.00000000', $referenced->refresh()->rate);
        $this->assertSame('15520.00000000', $correction->rate);
    }
}
