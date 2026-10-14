<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\PrintTemplateSourceScoper;
use Tests\TestCase;

class PrintTemplateSourceScoperTest extends TestCase {
    public function test_scopes_only_root_body_and_preserves_tbody_and_body_text(): void {
        $scoper = app(PrintTemplateSourceScoper::class);

        $html = $scoper->scopeHtml(
            '<body id="root"><table><tbody><tr><td>body</td></tr></tbody></table></body>',
            PrintTemplateSourceScoper::TEMPLATE_SCOPE,
        );

        $this->assertSame(
            '<section id="root" class="pt-scope pt-scope--template"><table><tbody><tr><td>body</td></tr></tbody></table></section>',
            $html,
        );
    }

    public function test_scopes_body_when_template_is_a_full_html_document(): void {
        $html = app(PrintTemplateSourceScoper::class)->scopeHtml(
            '<html><body class="legacy"><tbody><tr><td>body</td></tr></tbody></body></html>',
            PrintTemplateSourceScoper::TEMPLATE_SCOPE,
        );

        $this->assertSame('<html><section class="legacy pt-scope pt-scope--template"><tbody><tr><td>body</td></tr></tbody></section></html>', $html);
    }

    public function test_scopes_css_selectors_without_changing_class_or_string_values(): void {
        $scoper = app(PrintTemplateSourceScoper::class);

        $css = $scoper->scopeCss(
            'body .items-table, .note-body { color: red; content: "body"; }',
            PrintTemplateSourceScoper::TEMPLATE_SCOPE,
        );

        $this->assertSame('.pt-scope--template .items-table,.pt-scope--template .note-body{ color: red; content: "body"; }', $css);
    }

    public function test_preserves_body_inside_css_comments(): void {
        $css = app(PrintTemplateSourceScoper::class)->scopeCss(
            '/* body */ body .items { color: red; }',
            PrintTemplateSourceScoper::TEMPLATE_SCOPE,
        );

        $this->assertSame('/* body */ .pt-scope--template .items{ color: red; }', $css);
    }

    public function test_builds_layout_css_with_font_margins_and_page_number(): void {
        $template = new PrintTemplate([
            'unit'               => 'cm',
            'font_family'        => 'Arial',
            'width'              => 21,
            'height'             => 29.7,
            'margin_top'         => 1,
            'margin_right'       => 2,
            'margin_bottom'      => 3,
            'margin_left'        => 4,
            'page_number'        => 'bottom_center',
            'page_number_format' => ':page / :total',
        ]);

        $css = app(PrintTemplateSourceScoper::class)->layoutCss($template);

        $this->assertStringContainsString("font-family: 'Arial', sans-serif", $css);
        $this->assertStringContainsString('margin: 1cm 2cm 3cm 4cm', $css);
        $this->assertStringContainsString('size: 21cm 29.7cm', $css);
        $this->assertStringContainsString('@bottom-center', $css);
        $this->assertStringContainsString('counter(page)', $css);
    }

    public function test_layout_font_rule_is_scoped_and_margin_stays_on_body(): void {
        $template = new PrintTemplate([
            'unit'          => 'cm',
            'font_family'   => 'Courier New',
            'width'         => 21,
            'height'        => 29.7,
            'margin_top'    => 1,
            'margin_right'  => 2,
            'margin_bottom' => 3,
            'margin_left'   => 4,
        ]);

        $css = app(PrintTemplateSourceScoper::class)->layoutCss($template);

        $this->assertStringContainsString(".pt-scope { font-family: 'Courier New', sans-serif; }", $css);
        $this->assertStringContainsString('body { font-family:', $css);
        $this->assertMatchesRegularExpression('/^body \{[^}]*margin: 1cm 2cm 3cm 4cm;/m', $css);
        $this->assertDoesNotMatchRegularExpression('/\.pt-scope \{[^}]*margin/', $css);
    }

    public function test_layout_font_rule_wins_over_scoped_template_css_by_order(): void {
        $scoper      = app(PrintTemplateSourceScoper::class);
        $templateCss = $scoper->scopeCss('body { font-family: Arial, Helvetica, sans-serif; }', PrintTemplateSourceScoper::TEMPLATE_SCOPE);
        $layoutCss   = $scoper->layoutCss(new PrintTemplate(['unit' => 'cm', 'font_family' => 'Courier New', 'width' => 21, 'height' => 29.7]));
        $combined    = $templateCss . $layoutCss;

        // Spesifisitas sama (0,1,0): aturan yang dipasang belakangan menang.
        $this->assertStringContainsString('.pt-scope--template{ font-family: Arial', $templateCss);
        $this->assertGreaterThan(
            strpos($combined, '.pt-scope--template{'),
            strpos($combined, ".pt-scope { font-family: 'Courier New'"),
        );
    }
}
