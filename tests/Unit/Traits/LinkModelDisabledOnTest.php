<?php

namespace Tests\Unit\Traits;

use App\Enums\FormStatus;
use App\Models\Model as AppModel;
use App\Traits\LinkModel;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DisabledOnNonSubmitableTestDocument extends AppModel {
    use HasUlids, LinkModel;

    protected $table   = 'disabled_on_non_submitable_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class DisabledOnNonSubmitableOverrideTrueTestDocument extends DisabledOnNonSubmitableTestDocument {
    public function disabledOn(): bool {
        return true;
    }
}

class DisabledOnSubmitableTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'disabled_on_submitable_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class DisabledOnSubmitableOverrideFalseTestDocument extends DisabledOnSubmitableTestDocument {
    public function disabledOn(): bool {
        return false;
    }
}

class DisabledOnSubmitableOverrideTrueTestDocument extends DisabledOnSubmitableTestDocument {
    private static int $callCount = 0;

    public function disabledOn(): bool {
        self::$callCount++;

        return true;
    }

    public static function callCount(): int {
        return self::$callCount;
    }

    public static function resetCallCount(): void {
        self::$callCount = 0;
    }
}

/**
 * Property 5 — disabledOn locked mutlak pada canceled/rejected (override
 * TIDAK dipanggil). Property 7 — non-submitable baseline stabil (false
 * tanpa override).
 */
class LinkModelDisabledOnTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('disabled_on_non_submitable_test_documents')) {
            Schema::create('disabled_on_non_submitable_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
                $t->softDeletes();
            });
        }
        if (! Schema::hasTable('disabled_on_submitable_test_documents')) {
            Schema::create('disabled_on_submitable_test_documents', function ($t) {
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

    private function makeSubmitableDocument(string $class, FormStatus $status): object {
        $id = (string) Str::ulid();
        $class::query()->getConnection()->table('disabled_on_submitable_test_documents')->insert([
            'id'         => $id,
            'status'     => json_encode([$status->value]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $model = $class::find($id);
        $model->markAsShowContext();

        return $model;
    }

    // --- Non-submitable ---

    public function test_non_submitable_default_false_without_override(): void {
        $model = new DisabledOnNonSubmitableTestDocument;
        $model->markAsShowContext();

        $this->assertFalse($model->disabledOn);
    }

    public function test_non_submitable_override_replaces_baseline(): void {
        $model = new DisabledOnNonSubmitableOverrideTrueTestDocument;
        $model->markAsShowContext();

        $this->assertTrue($model->disabledOn);
    }

    // --- Submitable: draft ---

    public function test_submitable_draft_baseline_false(): void {
        $model = $this->makeSubmitableDocument(DisabledOnSubmitableTestDocument::class, FormStatus::DRAFT);

        $this->assertFalse($model->disabledOn);
    }

    // --- Submitable: canceled/rejected — locked mutlak, override TIDAK dipanggil ---

    public static function lockedStatusesProvider(): array {
        return [
            'canceled' => [FormStatus::CANCELED],
            'rejected' => [FormStatus::REJECTED],
        ];
    }

    #[DataProvider('lockedStatusesProvider')]
    public function test_locked_status_always_true_even_with_override_false(FormStatus $status): void {
        $model = $this->makeSubmitableDocument(DisabledOnSubmitableOverrideFalseTestDocument::class, $status);

        $this->assertTrue($model->disabledOn);
    }

    #[DataProvider('lockedStatusesProvider')]
    public function test_locked_status_override_not_called(FormStatus $status): void {
        DisabledOnSubmitableOverrideTrueTestDocument::resetCallCount();
        $model = $this->makeSubmitableDocument(DisabledOnSubmitableOverrideTrueTestDocument::class, $status);

        $disabledOn = $model->disabledOn;

        $this->assertTrue($disabledOn);
        $this->assertSame(0, DisabledOnSubmitableOverrideTrueTestDocument::callCount());
    }

    // --- Submitable: status lain (submitted/approved/dst) — baseline true, override replace murni ---

    public function test_other_status_baseline_true_without_override(): void {
        $model = $this->makeSubmitableDocument(DisabledOnSubmitableTestDocument::class, FormStatus::APPROVED);

        $this->assertTrue($model->disabledOn);
    }

    public function test_other_status_override_false_replaces_baseline_true(): void {
        $model = $this->makeSubmitableDocument(DisabledOnSubmitableOverrideFalseTestDocument::class, FormStatus::APPROVED);

        $this->assertFalse($model->disabledOn, 'Override false pada status non-locked harus REPLACE baseline true (form terbuka)');
    }
}
