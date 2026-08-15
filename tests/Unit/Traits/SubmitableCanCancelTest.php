<?php

namespace Tests\Unit\Traits;

use App\Enums\FormStatus;
use App\Models\Model as AppModel;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubmitableCanCancelTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'submitable_can_cancel_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class SubmitableCanCancelOverrideTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'submitable_can_cancel_test_documents';
    protected $guarded = ['id'];

    public function canCancel(): bool {
        return false;
    }

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class SubmitableCanCancelOverrideTrueTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'submitable_can_cancel_test_documents';
    protected $guarded = ['id'];

    public function canCancel(): bool {
        return true;
    }

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class SubmitableCanCancelTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('submitable_can_cancel_test_documents')) {
            Schema::create('submitable_can_cancel_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('code')->nullable();
                $t->string('status')->default('draft');
                $t->boolean('is_example')->default(false);
                $t->timestamp('submitted_at')->nullable();
                $t->timestamp('canceled_at')->nullable();
                $t->char('amended_from_id', 26)->nullable();
                $t->integer('revision_number')->default(0);
                $t->timestamps();
                $t->softDeletes();
            });
        }
    }

    private function makeDocument(string $class, FormStatus $status): object {
        $id = (string) Str::ulid();
        $class::query()->getConnection()->table('submitable_can_cancel_test_documents')->insert([
            'id'         => $id,
            'status'     => json_encode([$status->value]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $class::find($id);
    }

    /**
     * Property 1 — canCancel monoton terhadap status: baseline true untuk
     * semua status BUKAN DRAFT/CANCELED ketika model tidak override canCancel().
     */
    public function test_baseline_true_when_status_not_draft_or_canceled(): void {
        foreach ([FormStatus::NEED_APPROVAL, FormStatus::APPROVED, FormStatus::REJECTED] as $status) {
            $doc = $this->makeDocument(SubmitableCanCancelTestDocument::class, $status);
            $this->assertTrue($doc->canCancel, "Status {$status->value} seharusnya canCancel=true");
        }
    }

    public function test_baseline_false_when_status_draft(): void {
        $doc = $this->makeDocument(SubmitableCanCancelTestDocument::class, FormStatus::DRAFT);
        $this->assertFalse($doc->canCancel);
    }

    public function test_baseline_false_when_status_canceled(): void {
        $doc = $this->makeDocument(SubmitableCanCancelTestDocument::class, FormStatus::CANCELED);
        $this->assertFalse($doc->canCancel);
    }

    /**
     * Property 2 — override hanya mempersempit: baseline true + override
     * false = false (override tidak bisa melonggarkan baseline yang sudah
     * false, dan bisa mempersempit baseline yang true).
     */
    public function test_override_false_narrows_true_baseline_to_false(): void {
        $doc = $this->makeDocument(SubmitableCanCancelOverrideTestDocument::class, FormStatus::NEED_APPROVAL);
        $this->assertFalse($doc->canCancel);
    }

    public function test_override_true_cannot_widen_false_baseline(): void {
        $doc = $this->makeDocument(SubmitableCanCancelOverrideTrueTestDocument::class, FormStatus::DRAFT);
        $this->assertFalse($doc->canCancel, 'Override true tidak boleh melonggarkan baseline DRAFT yang false');
    }

    public function test_override_true_keeps_true_baseline_true(): void {
        $doc = $this->makeDocument(SubmitableCanCancelOverrideTrueTestDocument::class, FormStatus::NEED_APPROVAL);
        $this->assertTrue($doc->canCancel);
    }
}
