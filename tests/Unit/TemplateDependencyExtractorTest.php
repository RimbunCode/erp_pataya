<?php

namespace Tests\Unit;

use App\Services\Core\DataTable\Template\TemplateDependencyExtractor;
use App\Services\Core\DataTableColumnSelector;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Property 3 (kelengkapan dependensi) dan Property 4 (paritas ekstraksi dengan
 * implementasi regex lama `templateLinkPlaceholders`).
 */
class TemplateDependencyExtractorTest extends TestCase {
    /**
     * Salinan implementasi lama `DataTableColumnSelector::templateLinkPlaceholders()`
     * sebagai oracle paritas. JANGAN ubah: ia membekukan perilaku sebelum refactor.
     *
     * @return list<string>
     */
    private static function legacyPlaceholders(?string $templateLink): array {
        if (! is_string($templateLink) || $templateLink === '') {
            return [];
        }

        $out = [];
        if (preg_match_all('/:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))/', $templateLink, $matches)) {
            foreach ($matches[1] as $raw) {
                $raw = preg_replace('/\{:.*?\}/', '', $raw);
                if ($raw !== '') {
                    $out[] = $raw;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * `templateLink()` seluruh model existing di app/Models.
     *
     * @return array<string, array{0: string}>
     */
    public static function existingTemplateLinks(): array {
        $modelPath = str_replace('\\', '/', dirname(__DIR__, 2) . '/app/Models');
        $cases     = [];

        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($modelPath, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }
            $relative = substr(str_replace('\\', '/', $file->getPathname()), strlen($modelPath) + 1);
            $class    = 'App\\Models\\' . str_replace(['/', '.php'], ['\\', ''], $relative);

            if (! class_exists($class) || ! is_subclass_of($class, EloquentModel::class) || ! method_exists($class, 'templateLink')) {
                continue;
            }
            $method = new \ReflectionMethod($class, 'templateLink');
            if (! $method->isStatic() || ! $method->isPublic() || $method->getNumberOfRequiredParameters() > 0) {
                continue;
            }

            try {
                $template = $class::templateLink();
            } catch (\Throwable) {
                continue;
            }
            if (is_string($template)) {
                $cases[$class] = [$template];
            }
        }

        return $cases;
    }

    #[Test]
    public function discovers_existing_template_links(): void {
        $this->assertGreaterThan(50, count(self::existingTemplateLinks()), 'provider harus menemukan templateLink() model existing');
    }

    #[Test]
    #[DataProvider('existingTemplateLinks')]
    public function matches_legacy_implementation_for_every_existing_template_link(string $template): void {
        $legacy = self::legacyPlaceholders($template);
        sort($legacy, SORT_STRING);

        $this->assertSame($legacy, TemplateDependencyExtractor::extract($template));
    }

    #[Test]
    public function delegated_selector_method_returns_extractor_result(): void {
        $template = '<b>:code</b> :name{:title} :customer.branch.name';

        $this->assertSame(
            TemplateDependencyExtractor::extract($template),
            DataTableColumnSelector::templateLinkPlaceholders($template),
        );
    }

    /**
     * @return array<string, array{0: ?string, 1: list<string>}>
     */
    public static function templateCases(): array {
        return [
            'null'                     => [null, []],
            'string kosong'            => ['', []],
            'tanpa placeholder'        => ['<strong>Judul statis</strong>', []],
            'placeholder dasar'        => ['<strong>:title</strong><muted>:model_name</muted>', ['model_name', 'title']],
            'relasi bertingkat'        => [':customer.branch.name', ['customer.branch.name']],
            'alias accessor'           => [':name{:title}', ['name']],
            'formatter date'           => [':created_at|datetime', ['created_at']],
            'formatter menempel'       => ['<muted>:amount|currency · :due_date|date</muted>', ['amount', 'due_date']],
            'formatter pada relasi'    => [':exportedBy.created_at|relative', ['exportedBy.created_at']],
            'formatter trans'          => ['<badge>:export_status|trans</badge>', ['export_status']],
            'ternary datar'            => [':asset_id ? :asset | :item', ['asset', 'asset_id', 'item']],
            'ternary bersarang'        => [':aa ? :bb | (:cc ? :dd | :ee)', ['aa', 'bb', 'cc', 'dd', 'ee']],
            'ternary dengan formatter' => [':paid ? :paid_at|date | :due_at|date', ['due_at', 'paid', 'paid_at']],
            'atribut ber-placeholder'  => ['<progress value=":per_billed" shape="bar"/>', ['per_billed']],
            'atribut avatar'           => ['<avatar src=":photo_url" name=":user.name"/>', ['photo_url', 'user.name']],
            'nav-link to'              => ['<nav-link to="customer"><strong>:code</strong></nav-link>', ['code', 'customer']],
            'nav-link to dot'          => ['<nav-link to="items.item">x</nav-link>', ['items.item']],
            'nav-link tanpa to'        => ['<nav-link><strong>:code</strong></nav-link>', ['code']],
            'chips of'                 => ['<chips of="deliveryNotes" max="3"/>', ['deliveryNotes']],
            'when field'               => ['<when field="exported_at"><muted>x</muted></when>', ['exported_at']],
            'when field kutip tunggal' => ["<when field='exportedBy.email'>x</when>", ['exportedBy.email']],
            'atribut non-path'         => ['<nav-link to="https://x.test/a b">x</nav-link>', []],
            'unik dan terurut'         => [':bb :aa :bb :aa.xx', ['aa', 'aa.xx', 'bb']],
            'tailwind varian class'    => ['<span class="hover:bg-red-500 md:flex text-xs">:name</span>', ['name']],
            'class dgn placeholder'    => ['<span class="text-xs :cls">:name</span>', ['cls', 'name']],
            'komposit'                 => [
                '<stack><badge>:export_status|trans</badge>'
                . '<when field="exported_at"><muted>:exported_at|datetime · :exportedBy.email</muted></when>'
                . '<nav-link to="customer"/><chips of="deliveryNotes"/></stack>',
                ['customer', 'deliveryNotes', 'export_status', 'exportedBy.email', 'exported_at'],
            ],
        ];
    }

    /**
     * Property 3: setiap placeholder (dengan/tanpa formatter, di teks/atribut/ternary) dan
     * setiap to/of/field termasuk di hasil ekstraksi.
     *
     * @param  list<string>  $expected
     */
    #[Test]
    #[DataProvider('templateCases')]
    public function extracts_all_referenced_paths(?string $template, array $expected): void {
        $this->assertSame($expected, TemplateDependencyExtractor::extract($template));
    }

    #[Test]
    public function extraction_is_deterministic_over_repeated_calls(): void {
        $template = '<stack>:aa|date :bb ? :cc | :dd</stack>';

        $this->assertSame(
            TemplateDependencyExtractor::extract($template),
            TemplateDependencyExtractor::extract($template),
        );
    }

    #[Test]
    public function strip_formatter_removes_pipe_alias_and_leading_colon(): void {
        $this->assertSame('created_at', TemplateDependencyExtractor::stripFormatter(':created_at|datetime'));
        $this->assertSame('created_at', TemplateDependencyExtractor::stripFormatter('created_at|datetime'));
        $this->assertSame('rel.sub.field', TemplateDependencyExtractor::stripFormatter(':rel.sub.field|trans'));
        $this->assertSame('name', TemplateDependencyExtractor::stripFormatter(':name{:title}'));
        $this->assertSame('plain', TemplateDependencyExtractor::stripFormatter('plain'));
    }
}
