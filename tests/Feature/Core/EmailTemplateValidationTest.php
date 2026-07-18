<?php

namespace Tests\Feature\Core;

use App\Http\Requests\Core\EmailTemplateRequest;
use App\Models\Core\EmailTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class EmailTemplateValidationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Global scope HasExampleData butuh kolom is_example (ditambah via initPermissions di prod).
        if (Schema::hasTable('email_templates') && ! Schema::hasColumn('email_templates', 'is_example')) {
            Schema::table('email_templates', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    private function baseData(): array {
        return [
            'name'       => 'Notifikasi Sales Order',
            'permission' => ['model' => 'App\\Models\\Sales\\SalesOrder'],
            'subject'    => 'Order #{{ $doc->number }}',
            'body_html'  => '<p>Halo</p>',
        ];
    }

    public function test_valid_data_passes(): void {
        $validator = Validator::make($this->baseData(), (new EmailTemplateRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    public function test_name_is_required(): void {
        $data = $this->baseData();
        unset($data['name']);

        $validator = Validator::make($data, (new EmailTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('name', $validator->errors()->toArray());
    }

    public function test_name_must_be_unique_among_non_deleted_templates(): void {
        EmailTemplate::factory()->create(['name' => 'Notifikasi Sales Order']);

        $validator = Validator::make($this->baseData(), (new EmailTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('name', $validator->errors()->toArray());
    }

    public function test_soft_deleted_template_name_is_not_considered_duplicate(): void {
        $existing = EmailTemplate::factory()->create(['name' => 'Notifikasi Sales Order']);
        $existing->delete();

        $validator = Validator::make($this->baseData(), (new EmailTemplateRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    public function test_permission_model_is_required(): void {
        $data = $this->baseData();
        unset($data['permission']);

        $validator = Validator::make($data, (new EmailTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('permission.model', $validator->errors()->toArray());
    }

    public function test_subject_is_required(): void {
        $data = $this->baseData();
        unset($data['subject']);

        $validator = Validator::make($data, (new EmailTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('subject', $validator->errors()->toArray());
    }

    public function test_body_html_is_required(): void {
        $data = $this->baseData();
        unset($data['body_html']);

        $validator = Validator::make($data, (new EmailTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('body_html', $validator->errors()->toArray());
    }
}
