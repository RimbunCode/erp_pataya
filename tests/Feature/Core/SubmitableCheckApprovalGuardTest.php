<?php

namespace Tests\Feature\Core;

use App\Contracts\SubmitableService;
use App\Models\Model as AppModel;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model test TANPA $service — checkApproval harus lempar LogicException.
 */
class NoServicePropertyModel extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'no_service_test_docs';
    protected $guarded = ['id'];
}

/**
 * Model test dengan $service menunjuk class BUKAN SubmitableService.
 */
class BadServicePropertyModel extends AppModel {
    use HasUlids, Submitable;

    protected $table                 = 'bad_service_test_docs';
    protected $guarded               = ['id'];
    protected static string $service = \stdClass::class;
}

class SubmitableCheckApprovalGuardTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('no_service_test_docs')) {
            Schema::create('no_service_test_docs', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('status')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('bad_service_test_docs')) {
            Schema::create('bad_service_test_docs', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('status')->nullable();
                $t->timestamps();
            });
        }
    }

    /** @test */
    public function check_approval_throws_logic_exception_when_model_has_no_service_property(): void {
        $model = NoServicePropertyModel::create([]);

        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('harus mendeklarasikan property $service');

        $model->checkApproval();
    }

    /** @test */
    public function check_approval_does_not_create_approval_instance_when_service_missing(): void {
        $model = NoServicePropertyModel::create([]);

        try {
            $model->checkApproval();
        } catch (\LogicException) {
            // Make sure no ApprovalInstance was created
            $this->assertDatabaseCount('approval_instances', 0);
        }
    }

    /** @test */
    public function check_approval_throws_logic_exception_when_service_not_submitable_service(): void {
        $model = BadServicePropertyModel::create([]);

        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('harus implement');

        $model->checkApproval();
    }

    /** @test */
    public function check_approval_does_not_create_approval_instance_when_service_invalid(): void {
        $model = BadServicePropertyModel::create([]);

        try {
            $model->checkApproval();
        } catch (\LogicException) {
            $this->assertDatabaseCount('approval_instances', 0);
        }
    }
}
