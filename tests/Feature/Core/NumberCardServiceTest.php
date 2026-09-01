<?php

namespace Tests\Feature\Core;

use App\Models\Core\NumberCard;
use App\Models\Model as AppModel;
use App\Services\Core\NumberCardService;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Fixture test-only (mirror pola `QuickListSubmitableTestDoc` /
 * `NoServicePropertyModel`) — punya kolom numerik `amount` utk uji
 * sum/average/min/max, `created_at` bawaan Eloquent utk cutoff percentage.
 */
class NumberCardTestRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'number_card_test_records';
    protected $guarded = ['id'];
}

class NumberCardServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('number_card_test_records')) {
            Schema::create('number_card_test_records', function ($t) {
                $t->ulid('id')->primary();
                $t->decimal('amount', 15, 2)->default(0);
                $t->timestamps();
            });
        }
    }

    private function service(): NumberCardService {
        return app(NumberCardService::class);
    }

    public function test_get_value_count(): void {
        NumberCardTestRecord::create(['amount' => 10]);
        NumberCardTestRecord::create(['amount' => 20]);
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTestRecord::class, 'function' => 'count']);

        $this->assertSame(2.0, $this->service()->getValue($card));
    }

    public function test_get_value_sum(): void {
        NumberCardTestRecord::create(['amount' => 10]);
        NumberCardTestRecord::create(['amount' => 20]);
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTestRecord::class, 'function' => 'sum', 'aggregate_function_based_on' => 'amount']);

        $this->assertSame(30.0, $this->service()->getValue($card));
    }

    /**
     * Requirement 1.3: rata-rata dihitung LANGSUNG dari seluruh baris (AVG SQL),
     * BUKAN rata-rata-dari-rata-rata bucket — beda dari bug lama Widget.
     */
    public function test_get_value_average_is_true_average_not_average_of_averages(): void {
        NumberCardTestRecord::create(['amount' => 10]);
        NumberCardTestRecord::create(['amount' => 20]);
        NumberCardTestRecord::create(['amount' => 30]);
        $card = NumberCard::create(['label' => 'X', 'model_class' => NumberCardTestRecord::class, 'function' => 'average', 'aggregate_function_based_on' => 'amount']);

        $this->assertSame(20.0, $this->service()->getValue($card));
    }

    public function test_get_value_minimum_and_maximum(): void {
        NumberCardTestRecord::create(['amount' => 10]);
        NumberCardTestRecord::create(['amount' => 30]);
        $minCard = NumberCard::create(['label' => 'Min', 'model_class' => NumberCardTestRecord::class, 'function' => 'minimum', 'aggregate_function_based_on' => 'amount']);
        $maxCard = NumberCard::create(['label' => 'Max', 'model_class' => NumberCardTestRecord::class, 'function' => 'maximum', 'aggregate_function_based_on' => 'amount']);

        $this->assertSame(10.0, $this->service()->getValue($minCard));
        $this->assertSame(30.0, $this->service()->getValue($maxCard));
    }

    /** Requirement 2.3: pembanding 0 -> null, bukan division by zero. */
    public function test_percentage_difference_null_when_previous_is_zero(): void {
        NumberCardTestRecord::create(['amount' => 10]);
        $card = NumberCard::create([
            'label'                 => 'X', 'model_class' => NumberCardTestRecord::class, 'function' => 'count',
            'show_percentage_stats' => true, 'stats_time_interval' => 'daily',
        ]);

        $result = $this->service()->getValue($card);
        $this->assertNull($this->service()->getPercentageDifference($card, [], $result));
    }

    /** Requirement 2.1/2.2: cutoff created_at, bukan diff antar-bucket time-series. */
    public function test_percentage_difference_uses_as_of_date_cutoff(): void {
        $old             = NumberCardTestRecord::create(['amount' => 10]);
        $old->created_at = now()->subDays(5);
        $old->save();
        NumberCardTestRecord::create(['amount' => 10]); // hari ini

        $card = NumberCard::create([
            'label'                 => 'X', 'model_class' => NumberCardTestRecord::class, 'function' => 'count',
            'show_percentage_stats' => true, 'stats_time_interval' => 'daily',
        ]);

        $result = $this->service()->getValue($card); // 2 total
        // asOfDate = now()-1 hari -> hanya baris lama (5 hari lalu) yang lolos cutoff -> previous=1
        $delta = $this->service()->getPercentageDifference($card, [], $result);
        $this->assertSame(100.0, $delta); // (2/1 - 1) * 100
    }
}
