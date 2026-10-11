<?php

namespace Tests\Unit\Core\DataTable\Group;

use App\Services\Core\DataTable\Group\GroupLevels;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Kontrak `Groups` (spec datatable2-group-tree, Requirement 1, 18.2;
 * Property 6 & 9): normalizer STRUKTURAL, idempoten, kompatibel bentuk lama.
 */
class GroupLevelsTest extends TestCase {
    private static function level(string $column, mixed $granularity = null, mixed $range = null): array {
        return ['column' => $column, 'granularity' => $granularity, 'range' => $range];
    }

    /**
     * @return array<string, array{0: mixed, 1: array<int, array<string, mixed>>}>
     */
    public static function normalizeCases(): array {
        return [
            'null'                   => [null, []],
            'string kosong'          => ['', []],
            'array kosong'           => [[], []],
            'tipe skalar non-string' => [123, []],
            'string satu kolom'      => ['status', [self::level('status')]],
            'string di-trim'         => ['  status ', [self::level('status')]],
            'CSV'                    => ['category,status', [self::level('category'), self::level('status')]],
            'CSV dgn spasi & kosong' => [' category , ,status,', [self::level('category'), self::level('status')]],
            'objek lama 1 level'     => [
                ['column' => 'order_date', 'granularity' => 'month', 'range' => null],
                [self::level('order_date', 'month')],
            ],
            'objek lama kolom null'                   => [['column' => null, 'granularity' => null, 'range' => null], []],
            'objek asosiatif tanpa column bukan list' => [['granularity' => 'month'], []],
            'list string'                             => [['category', 'status'], [self::level('category'), self::level('status')]],
            'list objek'                              => [
                [['column' => 'order_date', 'granularity' => 'year'], ['column' => 'amount', 'range' => 100]],
                [self::level('order_date', 'year'), self::level('amount', null, 100)],
            ],
            'campuran string & objek' => [
                ['category', ['column' => 'order_date', 'granularity' => 'day']],
                [self::level('category'), self::level('order_date', 'day')],
            ],
            'dedupe: yang pertama menang' => [
                [['column' => 'a', 'granularity' => 'day'], 'b', ['column' => 'a', 'granularity' => 'year']],
                [self::level('a', 'day'), self::level('b')],
            ],
            'elemen tak valid dilewati' => [
                ['a', 5, null, ['column' => ''], ['nama' => 'x'], 'b'],
                [self::level('a'), self::level('b')],
            ],
            'range string numerik -> angka' => [
                [['column' => 'amount', 'range' => '100']],
                [self::level('amount', null, 100)],
            ],
            'range string pecahan -> float' => [
                [['column' => 'amount', 'range' => '0.5']],
                [self::level('amount', null, 0.5)],
            ],
            'granularity kosong -> null' => [
                [['column' => 'order_date', 'granularity' => '']],
                [self::level('order_date')],
            ],
        ];
    }

    #[Test]
    #[DataProvider('normalizeCases')]
    public function normalize_converts_every_accepted_shape_to_groups(mixed $input, array $expected): void {
        $this->assertSame($expected, GroupLevels::normalize($input));
    }

    #[Test]
    #[DataProvider('normalizeCases')]
    public function normalize_is_idempotent(mixed $input): void {
        $once = GroupLevels::normalize($input);

        $this->assertSame($once, GroupLevels::normalize($once));
    }

    #[Test]
    public function normalize_does_not_correct_invalid_values_so_form_requests_can_reject_them(): void {
        $levels = GroupLevels::normalize([
            ['column' => 'order_date', 'granularity' => 'decade'],
            ['column' => 'amount', 'range' => -5],
            ['column' => 'qty', 'range' => 'abc'],
        ]);

        $this->assertSame('decade', $levels[0]['granularity']);
        $this->assertSame(-5, $levels[1]['range']);
        $this->assertSame('abc', $levels[2]['range']);
    }

    #[Test]
    public function normalize_does_not_truncate_beyond_max_levels(): void {
        $levels = GroupLevels::normalize(['a', 'b', 'c', 'd', 'e', 'f']);

        $this->assertCount(6, $levels);
        $this->assertSame(4, GroupLevels::MAX_LEVELS);
    }

    #[Test]
    public function from_wire_returns_null_when_group_param_is_absent(): void {
        $request = Request::create('/x', 'GET', ['fid' => '1']);

        $this->assertNull(GroupLevels::fromWire($request));
    }

    #[Test]
    public function from_wire_returns_empty_list_for_explicit_empty_group(): void {
        $request = Request::create('/x', 'GET', ['group' => '']);

        $this->assertSame([], GroupLevels::fromWire($request));
    }

    #[Test]
    public function from_wire_reads_csv_with_per_column_granularity_and_range(): void {
        $request = Request::create('/x', 'GET', [
            'group'            => 'category,order_date,amount',
            'groupGranularity' => ['order_date' => 'quarter'],
            'groupRange'       => ['amount' => '100'],
        ]);

        $this->assertSame([
            self::level('category'),
            self::level('order_date', 'quarter'),
            self::level('amount', null, 100),
        ], GroupLevels::fromWire($request));
    }

    #[Test]
    public function from_wire_maps_legacy_scalar_granularity_and_range_to_first_level_only(): void {
        $granularity = Request::create('/x', 'GET', [
            'group'            => 'order_date,category',
            'groupGranularity' => 'year',
        ]);
        $range = Request::create('/x', 'GET', [
            'group'      => 'amount,category',
            'groupRange' => '1000',
        ]);

        $this->assertSame(
            [self::level('order_date', 'year'), self::level('category')],
            GroupLevels::fromWire($granularity),
        );
        $this->assertSame(
            [self::level('amount', null, 1000), self::level('category')],
            GroupLevels::fromWire($range),
        );
    }

    #[Test]
    public function to_wire_and_from_wire_round_trip(): void {
        $groups = [
            self::level('category'),
            self::level('order_date', 'month'),
            self::level('amount', null, 100),
        ];

        $wire    = GroupLevels::toWire($groups);
        $request = Request::create('/x', 'GET', $wire);

        $this->assertSame('category,order_date,amount', $wire['group']);
        $this->assertSame(['order_date' => 'month'], $wire['groupGranularity']);
        $this->assertSame(['amount' => 100], $wire['groupRange']);
        $this->assertSame($groups, GroupLevels::fromWire($request));
    }

    /**
     * Fixture BERSAMA BE<->FE (Property 6): file yang sama dibaca Vitest
     * (groupLevels.test.js) -- input yang sama HARUS menghasilkan `Groups` yang
     * sama di PHP & JS. Kasus khusus yang dijaga: string heksadesimal ("0x1A")
     * BUKAN numerik di PHP (is_numeric) maupun di JS (regex, bukan Number()).
     *
     * @return array<string, mixed>
     */
    private static function sharedFixture(): array {
        return json_decode(
            (string) file_get_contents(dirname(__DIR__, 4) . '/fixtures/group-levels-cases.json'),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
    }

    /** @return array<string, array{0: mixed, 1: array<int, array<string, mixed>>}> */
    public static function sharedNormalizeCases(): array {
        $cases = [];
        foreach (self::sharedFixture()['normalize'] as $case) {
            $cases[$case['name']] = [$case['input'], $case['expected']];
        }

        return $cases;
    }

    /** @return array<string, array{0: array<string, mixed>, 1: array<int, array<string, mixed>>|null}> */
    public static function sharedWireCases(): array {
        $cases = [];
        foreach (self::sharedFixture()['wire'] as $case) {
            $cases[$case['name']] = [$case['query'], $case['expected']];
        }

        return $cases;
    }

    #[Test]
    #[DataProvider('sharedNormalizeCases')]
    public function normalize_matches_the_shared_fixture_used_by_the_frontend(mixed $input, array $expected): void {
        $this->assertSame($expected, GroupLevels::normalize($input));
    }

    #[Test]
    #[DataProvider('sharedWireCases')]
    public function from_wire_matches_the_shared_fixture_used_by_the_frontend(array $query, ?array $expected): void {
        $this->assertSame($expected, GroupLevels::fromWire(Request::create('/x', 'GET', $query)));
    }

    #[Test]
    public function to_wire_of_empty_groups_is_explicit_empty_group_param(): void {
        $this->assertSame(['group' => ''], GroupLevels::toWire([]));
    }
}
