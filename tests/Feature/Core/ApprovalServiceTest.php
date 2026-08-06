<?php

namespace Tests\Feature\Core;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Model as AppModel;
use App\Services\Core\Approval\ApprovalService;
use App\Traits\HasDefaultDelete;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApprovalServiceTestDocument extends AppModel {
    use HasUlids;

    protected $table                 = 'approval_service_test_documents';
    protected $guarded               = ['id'];
    protected static string $service = ApprovalServiceTestService::class;
}

class ApprovalServiceTestService implements SubmitableService {
    use HasDefaultDelete;

    public static string $lastCalled = '';
    public static mixed $returnValue = null;

    public static function reset(): void {
        self::$lastCalled  = '';
        self::$returnValue = null;
    }

    public function create(array $data): AppModel {
        return new ApprovalServiceTestDocument($data);
    }

    public function update(AppModel $model, array $data): AppModel {
        $model->fill($data);

        return $model;
    }

    public function submit(AppModel $model): mixed {
        return null;
    }

    public function cancel(AppModel $model): mixed {
        return null;
    }

    public function amend(AppModel $model): mixed {
        return null;
    }

    public function onApproved(AppModel $model): mixed {
        self::$lastCalled = 'onApproved';

        return self::$returnValue;
    }

    public function onRejected(AppModel $model): mixed {
        self::$lastCalled = 'onRejected';

        return self::$returnValue;
    }
}

class ApprovalServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        ApprovalServiceTestService::reset();

        $tablesNeedingIsExample = ['approval_schemes', 'approval_instances'];
        foreach ($tablesNeedingIsExample as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('approval_service_test_documents')) {
            Schema::create('approval_service_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->string('status')->default('draft');
                $t->timestamps();
            });
        }
    }

    /** @test */
    public function check_calls_on_approved_when_no_approval_scheme_exists(): void {
        $document = ApprovalServiceTestDocument::create(['status' => FormStatus::DRAFT]);

        $service = new ApprovalService;
        $result  = $service->check($document, ApprovalServiceTestService::class);

        $this->assertSame('onApproved', ApprovalServiceTestService::$lastCalled);
        $this->assertNull($result);
    }

    /** @test */
    public function check_forwards_return_value_from_on_approved(): void {
        $document = ApprovalServiceTestDocument::create(['status' => FormStatus::DRAFT]);

        ApprovalServiceTestService::$returnValue = 'redirect:/some/path';

        $service = new ApprovalService;
        $result  = $service->check($document, ApprovalServiceTestService::class);

        $this->assertSame('redirect:/some/path', $result);
    }
}
