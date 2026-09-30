<?php

namespace Tests\Feature\Traits;

use App\Casts\FormStatusCast;
use App\Models\Model as AppModel;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** Model Submitable asli (trait Submitable = sumber $is_submitable + cast status). */
class SgSubmitableRecord extends AppModel {
    use DataTable, Submitable;

    protected $table   = 'sg_records';
    protected $guarded = ['id'];
}

/** Model yg sengaja menonaktifkan group status lewat $configColumns. */
class SgOptOutRecord extends SgSubmitableRecord {
    protected array $configColumns = [
        'status' => ['groupable' => false],
    ];
}

/** Bukan Submitable: `status` tunggal ber-cast FormStatusCast (spt Ticket/User). */
class SgSingleStatusRecord extends AppModel {
    use DataTable;

    protected $table   = 'sg_records';
    protected $guarded = ['id'];
    protected $casts   = ['status' => FormStatusCast::class];
}

/** Bukan Submitable: `status` string biasa tanpa cast (spt Lead/Todo). */
class SgPlainStatusRecord extends AppModel {
    use DataTable;

    protected $table   = 'sg_records';
    protected $guarded = ['id'];
}

class StatusGroupableTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('sg_records')) {
            Schema::create('sg_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->text('status')->nullable();
                $t->timestamps();
            });
        }
    }

    /** @param class-string<AppModel> $model */
    private function statusColumn(string $model): array {
        return collect($model::getColumns(1))->firstWhere('name', 'status');
    }

    public function test_submitable_status_is_groupable_by_default(): void {
        $status = $this->statusColumn(SgSubmitableRecord::class);

        $this->assertTrue($status['groupable'] ?? false);
        $this->assertSame('formStatuses', $status['type']);
    }

    public function test_non_submitable_single_form_status_is_groupable_by_default(): void {
        $status = $this->statusColumn(SgSingleStatusRecord::class);

        $this->assertTrue($status['groupable'] ?? false);
        $this->assertSame('formStatus', $status['type']);
    }

    public function test_non_submitable_plain_string_status_is_groupable_by_default(): void {
        $status = $this->statusColumn(SgPlainStatusRecord::class);

        $this->assertTrue($status['groupable'] ?? false);
        $this->assertSame('string', $status['type']);
    }

    public function test_model_can_opt_out_of_status_grouping(): void {
        $status = $this->statusColumn(SgOptOutRecord::class);

        $this->assertFalse($status['groupable'] ?? false);
    }
}
