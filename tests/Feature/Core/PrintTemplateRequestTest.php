<?php

namespace Tests\Feature\Core;

use App\Http\Requests\Core\PrintTemplateRequest;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Tests\TestCase;

class PrintTemplateRequestTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        // Tabel print_templates dipakai bersama banyak file test (SQLite
        // in-memory shared per test-run) — guard idempotent (bukan
        // dropIfExists+create unconditional) agar tidak menghapus kolom
        // yang ditambahkan file test lain yang kebetulan berjalan lebih
        // dulu dalam proses yang sama.
        if (! Schema::hasTable('print_templates')) {
            Schema::create('print_templates', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->boolean('is_letter_head')->default(false);
                $table->string('model')->nullable();
                $table->string('name_model')->nullable();
                $table->boolean('is_default')->default(false);
                $table->string('default_language')->nullable();
                $table->string('font_family')->nullable();
                $table->string('paper')->nullable();
                $table->string('page_number')->nullable();
                $table->string('orientation')->default('portrait');
                $table->double('width')->nullable();
                $table->double('height')->nullable();
                $table->double('margin_top')->nullable();
                $table->double('margin_bottom')->nullable();
                $table->double('margin_left')->nullable();
                $table->double('margin_right')->nullable();
                $table->string('unit')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function test_print_template_paper_field_is_persisted_on_create_and_update(): void {
        $printTemplateId = (string) Str::ulid();
        DB::table('print_templates')->insert([
            'id'          => $printTemplateId,
            'name'        => 'Template Unit Test',
            'paper'       => 'A4',
            'orientation' => 'portrait',
            'unit'        => 'cm',
            'page_number' => 'bottom_right',
            'font_family' => 'Times New Roman',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $this->assertDatabaseHas('print_templates', [
            'id'          => $printTemplateId,
            'paper'       => 'A4',
            'orientation' => 'portrait',
        ]);

        DB::table('print_templates')->where('id', $printTemplateId)->update([
            'paper'       => 'custom',
            'orientation' => 'landscape',
            'updated_at'  => now(),
        ]);

        $this->assertDatabaseHas('print_templates', [
            'id'          => $printTemplateId,
            'paper'       => 'custom',
            'orientation' => 'landscape',
        ]);
    }

    public function test_orientation_potrait_is_normalized_before_validation(): void {
        $request = $this->makeRequest($this->validPayload([
            'orientation' => 'potrait',
        ]));

        $this->assertSame('portrait', $request->input('orientation'));

        $validator = Validator::make($request->all(), $request->rules());

        $this->assertFalse(
            $validator->fails(),
            json_encode($validator->errors()->toArray()),
        );
    }

    public function test_orientation_must_be_portrait_or_landscape(): void {
        $request = $this->makeRequest($this->validPayload([
            'orientation' => 'diagonal',
        ]));
        $validator = Validator::make($request->all(), $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('orientation', $validator->errors()->toArray());
    }

    public function test_paper_must_use_supported_options(): void {
        $request = $this->makeRequest($this->validPayload([
            'paper' => 'A6',
        ]));
        $validator = Validator::make($request->all(), $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('paper', $validator->errors()->toArray());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function makeRequest(array $payload): PrintTemplateRequest {
        $request = PrintTemplateRequest::create(
            '/settings/printTemplates',
            'POST',
            $payload,
        );
        $this->invokePrepareForValidation($request);

        return $request;
    }

    private function invokePrepareForValidation(PrintTemplateRequest $request): void {
        $reflection = new \ReflectionMethod(PrintTemplateRequest::class, 'prepareForValidation');
        $reflection->setAccessible(true);
        $reflection->invoke($request);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array {
        return array_replace_recursive([
            'name'           => 'Template Valid Name',
            'is_letter_head' => false,
            'permission'     => [
                'model' => 'App\\Models\\Sales\\SalesOrder',
            ],
            'paper'            => 'A4',
            'orientation'      => 'portrait',
            'width'            => 21,
            'height'           => 29.7,
            'margin_top'       => 2,
            'margin_bottom'    => 2,
            'margin_left'      => 2,
            'margin_right'     => 2,
            'page_number'      => 'bottom_right',
            'unit'             => 'cm',
            'font_family'      => 'Times New Roman',
            'default_language' => 'en',
        ], $overrides);
    }
}
