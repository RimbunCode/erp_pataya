<?php

namespace Tests\Feature\Http\Requests;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Routing\Redirector;
use Tests\TestCase;

class BaseFormRequestTest extends TestCase {
    public function test_it_injects_branch_id_from_session_into_validated_data(): void {
        session()->put('currentBranch', ['id' => 123]);

        $request = BranchAwareFormRequest::create('/', 'POST', [
            'name'      => 'Main Branch Item',
            'branch_id' => 999,
        ]);

        $request->setContainer($this->app);
        $request->setRedirector($this->app->make(Redirector::class));
        $request->validateResolved();

        $this->assertSame(123, $request->input('branch_id'));
        $this->assertSame(123, $request->validated('branch_id'));
        $this->assertSame([
            'name'      => 'Main Branch Item',
            'branch_id' => 123,
        ], $request->validated());
    }

    public function test_it_does_not_inject_branch_id_when_current_branch_is_missing(): void {
        session()->forget('currentBranch');

        $request = BranchAwareFormRequest::create('/', 'POST', [
            'name' => 'Main Branch Item',
        ]);

        $request->setContainer($this->app);
        $request->setRedirector($this->app->make(Redirector::class));
        $request->validateResolved();

        $this->assertNull($request->input('branch_id'));
        $this->assertSame([
            'name' => 'Main Branch Item',
        ], $request->validated());
    }
}

class BranchAwareFormRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name' => ['required', 'string'],
        ];
    }
}
