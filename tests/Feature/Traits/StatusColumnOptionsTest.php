<?php

namespace Tests\Feature\Traits;

use App\Casts\FormStatusCast;
use App\Enums\FormStatus;
use App\Models\Helpdesk\Ticket;
use App\Models\Model as AppModel;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** Submitable: `status` ber-cast FormStatusesCast, tanpa `options` di $configColumns. */
class SoSubmitableRecord extends AppModel {
    use DataTable, Submitable;

    protected $table   = 'so_records';
    protected $guarded = ['id'];
}

/** Submitable yg MEMBATASI opsi status lewat $configColumns (campuran enum + string). */
class SoRestrictedRecord extends SoSubmitableRecord {
    protected array $configColumns = [
        'status' => ['options' => [FormStatus::DRAFT, 'approved', FormStatus::DRAFT, '']],
    ];
}

/** Bukan Submitable: `status` tunggal ber-cast FormStatusCast, valueTrans sendiri. */
class SoSingleStatusRecord extends AppModel {
    use DataTable;

    protected $table               = 'so_records';
    protected $guarded             = ['id'];
    protected $casts               = ['status' => FormStatusCast::class];
    protected array $configColumns = [
        'status' => ['valueTrans' => 'custom.status.options'],
    ];
}

/** Bukan Submitable: `status` string biasa (tanpa cast) -- bukan formStatus. */
class SoPlainStatusRecord extends AppModel {
    use DataTable;

    protected $table   = 'so_records';
    protected $guarded = ['id'];
}

class StatusColumnOptionsTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('so_records')) {
            Schema::create('so_records', function ($t) {
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

    /** @return list<string> */
    private function allStatusValues(): array {
        return array_map(fn (FormStatus $status) => $status->value, FormStatus::cases());
    }

    public function test_formstatuses_without_config_options_lists_every_form_status_enum_case(): void {
        $status = $this->statusColumn(SoSubmitableRecord::class);

        $this->assertSame('formStatuses', $status['type']);
        $this->assertSame($this->allStatusValues(), $status['options']);
        $this->assertSame('status', $status['valueTrans']);
    }

    public function test_config_options_restrict_the_list_and_accept_enum_or_string_deduped(): void {
        $status = $this->statusColumn(SoRestrictedRecord::class);

        $this->assertSame('formStatuses', $status['type']);
        $this->assertSame(['draft', 'approved'], $status['options']);
    }

    public function test_single_form_status_gets_enum_options_and_keeps_configured_value_trans(): void {
        $status = $this->statusColumn(SoSingleStatusRecord::class);

        $this->assertSame('formStatus', $status['type']);
        $this->assertSame($this->allStatusValues(), $status['options']);
        $this->assertSame('custom.status.options', $status['valueTrans']);
    }

    public function test_plain_string_status_is_not_touched(): void {
        $status = $this->statusColumn(SoPlainStatusRecord::class);

        $this->assertSame('string', $status['type']);
        $this->assertSame([], $status['options']);
    }

    public function test_ticket_restricts_status_options_to_its_own_statuses(): void {
        $status = $this->statusColumn(Ticket::class);

        $this->assertSame('formStatus', $status['type']);
        $this->assertSame(
            ['new', 'in_progress', 'on_hold', 'resolved', 'done'],
            $status['options'],
        );
        $this->assertSame('helpdesk.ticket.status.options', $status['valueTrans']);
    }
}
