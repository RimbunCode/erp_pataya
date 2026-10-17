<?php

namespace Tests\Unit\Core;

use App\Models\Model as AppModel;
use App\Services\Core\DataTableConfigCache;
use App\Services\Core\DataTableConfigValidator;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TvCustomer extends AppModel {
    protected $table   = 'tv_customers';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * Basis fixture validator template (rule 6-12). Subclass hanya menimpa `$configColumns`.
 */
class TvOrder extends AppModel {
    protected $table   = 'tv_orders';
    protected $guarded = ['id'];
    protected $hidden  = ['secret'];
    public $timestamps = false;

    /** Konfigurasi VALID; subclass fixture menyisipkan satu pelanggaran di atasnya. */
    public const BASE = [
        'code'         => ['template' => '<strong>:code</strong> <muted>:customer.name|trans</muted>', 'isLink' => true, 'valueTrans' => 'x.y'],
        'customer'     => ['template' => '<strong>:name</strong>'],
        'summary_view' => ['template' => '<nav-link to="customer"><strong>:code</strong></nav-link> :qty|number :price|currency'],
        'total_amount' => ['type' => 'currency', 'expression' => 'qty * price'],
        'per_done'     => ['type' => 'progress', 'expression' => 'qty * 100.0 / NULLIF(price, 0)'],
        'status'       => ['badgeColors' => ['open' => 'blue', 'done' => 'green', 'void' => 'secondary']],
    ];

    protected array $configColumns = self::BASE;

    public static function mobileTemplate(): string {
        return '<stack><strong>:code</strong><muted>:customer.name</muted></stack>';
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(TvCustomer::class, 'customer_id');
    }
}

class TvUnknownPath extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'summary_view' => ['template' => '<b>:nope</b>']];
}

class TvUnknownRelationPath extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'summary_view' => ['template' => '<b>:customer.nope</b>']];
}

class TvScalarAsRelation extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'summary_view' => ['template' => '<b>:code.name</b>']];
}

class TvHiddenColumn extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'summary_view' => ['template' => '<b>:secret</b>']];
}

class TvIgnoredColumn extends TvOrder {
    protected array $configColumns = [
        ...TvOrder::BASE,
        'name'         => ['ignore' => true],
        'summary_view' => ['template' => '<b>:name</b>'],
    ];
}

class TvRelationTemplateWrongModel extends TvOrder {
    // `code` ada di tv_orders tetapi TIDAK di tv_customers (template relasi dievaluasi terhadap model anak).
    protected array $configColumns = [...TvOrder::BASE, 'customer' => ['template' => '<b>:code</b>']];
}

class TvBadMobileTemplate extends TvOrder {
    public static function mobileTemplate(): string {
        return '<stack>:code :missing_field</stack>';
    }
}

class TvUnknownFormatter extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'summary_view' => ['template' => '<b>:qty|bogus :price|currency</b>']];
}

class TvNestedLink extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'code' => ['template' => '<nav-link><strong>:code</strong></nav-link>', 'isLink' => true]];
}

class TvLinkWithoutNav extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'code' => ['template' => '<strong>:code</strong>', 'isLink' => true]];
}

class TvExpressionOnString extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'label_view' => ['type' => 'string', 'expression' => 'qty + 1']];
}

class TvExpressionDefaultType extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'label_view' => ['expression' => 'qty + 1']];
}

class TvExpressionBadSql extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'total_amount' => ['type' => 'currency', 'expression' => 'qty * nope_col']];
}

class TvProgressWithoutSource extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'qty' => ['type' => 'progress']];
}

class TvProgressSingleDependency extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'per_done' => ['type' => 'progress', 'template' => '<b>:qty</b>']];
}

class TvProgressTwoDependencies extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'per_done' => ['type' => 'progress', 'template' => '<b>:qty :price</b>']];
}

class TvBadgeColorOutOfPalette extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'status' => ['badgeColors' => ['open' => 'magenta']]];
}

class TvBadgeColorsNotArray extends TvOrder {
    protected array $configColumns = [...TvOrder::BASE, 'status' => ['badgeColors' => 'blue']];
}

/**
 * Rule validator baru untuk template kolom, expression, progress, dan badgeColors
 * (spec datatable-semantic-templates, task 5): satu kasus valid + satu violation per rule,
 * serta bukti `model:cache` menjalankan validasi + warm meta.
 */
class DataTableConfigValidatorTemplateTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('tv_customers', function ($t) {
            $t->id();
            $t->string('name')->nullable();
        });
        Schema::create('tv_orders', function ($t) {
            $t->id();
            $t->string('code')->nullable();
            $t->string('name')->nullable();
            $t->string('status')->nullable();
            $t->integer('qty')->default(0);
            $t->decimal('price', 12, 2)->default(0);
            $t->string('secret')->nullable();
            $t->unsignedBigInteger('customer_id')->nullable();
        });
    }

    /**
     * Hanya rule baru (6-12) — rule lama (1-5) bukan cakupan test ini.
     *
     * @return list<array{rule:int, column?:string, message:string}>
     */
    private function templateViolations(string $modelClass): array {
        return array_values(array_filter(
            DataTableConfigValidator::validate($modelClass),
            fn (array $v) => $v['rule'] >= 6,
        ));
    }

    /** @return list<int> */
    private function rules(string $modelClass): array {
        return array_map(fn (array $v) => $v['rule'], $this->templateViolations($modelClass));
    }

    #[Test]
    public function valid_configuration_has_no_template_violations(): void {
        // Berlaku untuk seluruh rule sekaligus: template, relasi ber-template, mobileTemplate,
        // formatter, nav-link tanpa isLink, expression number/currency/progress, badgeColors.
        // (`code` ber-isLink TANPA nav-link di template, sehingga rule 8 tak terpicu.)
        $this->assertSame([], $this->templateViolations(TvOrder::class));
    }

    #[Test]
    public function rule_6_reports_unknown_template_paths(): void {
        $violations = $this->templateViolations(TvUnknownPath::class);

        $this->assertSame([6], $this->rules(TvUnknownPath::class));
        $this->assertSame('summary_view', $violations[0]['column']);
        $this->assertStringContainsString(':nope', $violations[0]['message']);
    }

    #[Test]
    public function rule_6_reports_unknown_column_inside_a_relation(): void {
        $this->assertSame([6], $this->rules(TvUnknownRelationPath::class));
    }

    #[Test]
    public function rule_6_reports_a_scalar_column_used_as_relation(): void {
        $violations = $this->templateViolations(TvScalarAsRelation::class);

        $this->assertSame([6], $this->rules(TvScalarAsRelation::class));
        $this->assertStringContainsString('bukan relasi', $violations[0]['message']);
    }

    #[Test]
    public function rule_6_reports_hidden_and_ignored_columns(): void {
        $hidden  = $this->templateViolations(TvHiddenColumn::class);
        $ignored = $this->templateViolations(TvIgnoredColumn::class);

        $this->assertSame([6], $this->rules(TvHiddenColumn::class));
        $this->assertStringContainsString('disembunyikan', $hidden[0]['message']);
        $this->assertSame([6], $this->rules(TvIgnoredColumn::class));
        $this->assertStringContainsString('di-ignore', $ignored[0]['message']);
    }

    #[Test]
    public function rule_6_evaluates_relation_column_templates_against_the_related_model(): void {
        $this->assertSame([6], $this->rules(TvRelationTemplateWrongModel::class));
    }

    #[Test]
    public function rule_6_also_validates_mobile_template_paths(): void {
        $violations = $this->templateViolations(TvBadMobileTemplate::class);

        $this->assertSame([6], $this->rules(TvBadMobileTemplate::class));
        $this->assertSame('(mobileTemplate)', $violations[0]['column']);
    }

    #[Test]
    public function rule_7_reports_unknown_formatters_only(): void {
        $violations = $this->templateViolations(TvUnknownFormatter::class);

        $this->assertSame([7], $this->rules(TvUnknownFormatter::class));
        $this->assertStringContainsString('|bogus', $violations[0]['message']);
    }

    #[Test]
    public function rule_8_reports_is_link_with_nav_link_in_template(): void {
        $this->assertSame([8], $this->rules(TvNestedLink::class));
        $this->assertSame([], $this->templateViolations(TvLinkWithoutNav::class), 'isLink tanpa <nav-link> valid');
    }

    #[Test]
    public function rule_9_reports_expression_on_unsupported_types(): void {
        $this->assertSame([9], $this->rules(TvExpressionOnString::class));
        $this->assertSame([9], $this->rules(TvExpressionDefaultType::class), 'type default string tak mendukung expression');
    }

    #[Test]
    public function rule_10_reports_expression_that_fails_to_run(): void {
        $violations = $this->templateViolations(TvExpressionBadSql::class);

        $this->assertSame([10], $this->rules(TvExpressionBadSql::class));
        $this->assertStringContainsString('gagal dijalankan', $violations[0]['message']);
    }

    #[Test]
    public function rule_11_requires_expression_or_a_single_dependency_for_progress(): void {
        $this->assertSame([11], $this->rules(TvProgressWithoutSource::class));
        $this->assertSame([11], $this->rules(TvProgressTwoDependencies::class));
        $this->assertSame([], $this->templateViolations(TvProgressSingleDependency::class));
    }

    #[Test]
    public function rule_12_reports_invalid_badge_colors(): void {
        $this->assertSame([12], $this->rules(TvBadgeColorOutOfPalette::class));
        $this->assertSame([12], $this->rules(TvBadgeColorsNotArray::class));
    }

    #[Test]
    public function model_cache_command_validates_and_warms_meta_for_a_valid_model(): void {
        $metaKey = DataTableConfigCache::cacheKey(TvOrder::class, DataTableConfigCache::signatureFor(TvOrder::class)) . ':meta';
        DataTableConfigCache::forget(TvOrder::class);
        $this->assertFalse(Cache::has($metaKey));

        $this->artisan('model:cache', ['--model' => TvOrder::class, '--strict' => true])->assertExitCode(0);

        $this->assertTrue(Cache::has($metaKey), 'warm menyimpan meta mobileTemplate');
        $this->assertSame(TvOrder::mobileTemplate(), Cache::get($metaKey)['mobileTemplate']);
        $this->assertSame(['code', 'customer.name'], Cache::get($metaKey)['mobileDependsOn']);
    }

    #[Test]
    public function model_cache_command_fails_in_strict_mode_on_template_violations(): void {
        $this->artisan('model:cache', ['--model' => TvUnknownPath::class, '--strict' => true])
            ->expectsOutputToContain('Rule 6')
            ->assertExitCode(1);
    }

    #[Test]
    public function model_cache_command_reports_expression_and_nested_link_violations(): void {
        $this->artisan('model:cache', ['--model' => TvExpressionBadSql::class, '--strict' => true])
            ->expectsOutputToContain('Rule 10')
            ->assertExitCode(1);
        $this->artisan('model:cache', ['--model' => TvNestedLink::class, '--strict' => true])
            ->expectsOutputToContain('Rule 8')
            ->assertExitCode(1);
    }

    #[Test]
    public function model_cache_clear_removes_meta_so_it_is_recomputed_on_next_warm(): void {
        $metaKey = DataTableConfigCache::cacheKey(TvOrder::class, DataTableConfigCache::signatureFor(TvOrder::class)) . ':meta';

        $this->artisan('model:cache', ['--model' => TvOrder::class, '--no-validate' => true])->assertExitCode(0);
        $this->assertTrue(Cache::has($metaKey));

        $this->artisan('model:cache', ['--model' => TvOrder::class, '--clear' => true, '--no-warm' => true])->assertExitCode(0);
        $this->assertFalse(Cache::has($metaKey), '--clear menghapus meta');
    }
}
