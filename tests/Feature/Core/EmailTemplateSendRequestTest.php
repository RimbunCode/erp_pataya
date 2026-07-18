<?php

namespace Tests\Feature\Core;

use App\Http\Requests\Core\EmailTemplateSendRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class EmailTemplateSendRequestTest extends TestCase {
    private function baseData(): array {
        return [
            'to'      => 'customer@example.com',
            'subject' => 'Order PO-001',
            'body'    => '<p>Halo</p>',
        ];
    }

    public function test_valid_data_passes(): void {
        $validator = Validator::make($this->baseData(), (new EmailTemplateSendRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    public function test_to_is_required(): void {
        $data = $this->baseData();
        unset($data['to']);

        $validator = Validator::make($data, (new EmailTemplateSendRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('to', $validator->errors()->toArray());
    }

    public function test_to_must_be_valid_email(): void {
        $data       = $this->baseData();
        $data['to'] = 'not-an-email';

        $validator = Validator::make($data, (new EmailTemplateSendRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('to', $validator->errors()->toArray());
    }

    public function test_cc_and_bcc_entries_must_be_valid_emails(): void {
        $data        = $this->baseData();
        $data['cc']  = ['ok@example.com', 'not-an-email'];
        $data['bcc'] = ['also-invalid'];

        $validator = Validator::make($data, (new EmailTemplateSendRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('cc.1', $errors);
        $this->assertArrayHasKey('bcc.0', $errors);
    }

    public function test_cc_and_bcc_are_optional(): void {
        $validator = Validator::make($this->baseData(), (new EmailTemplateSendRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    public function test_subject_and_body_are_required(): void {
        $data = $this->baseData();
        unset($data['subject'], $data['body']);

        $validator = Validator::make($data, (new EmailTemplateSendRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('subject', $errors);
        $this->assertArrayHasKey('body', $errors);
    }

    public function test_include_pdf_accepts_boolean(): void {
        $data                = $this->baseData();
        $data['include_pdf'] = true;

        $validator = Validator::make($data, (new EmailTemplateSendRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    public function test_include_pdf_is_optional(): void {
        $validator = Validator::make($this->baseData(), (new EmailTemplateSendRequest)->rules());

        $this->assertFalse($validator->fails());
    }
}
