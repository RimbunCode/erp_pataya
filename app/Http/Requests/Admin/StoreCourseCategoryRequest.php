<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreCourseCategoryRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name'),
                function (string $attribute, mixed $value, Closure $fail): void {
                    $slug = Str::slug((string) $value);

                    if ($slug === '') {
                        $fail('Nama kategori tidak valid.');

                        return;
                    }

                    $slugExists = DB::table('categories')
                        ->where('slug', $slug)
                        ->exists();

                    if ($slugExists) {
                        $fail('Slug kategori sudah digunakan.');
                    }
                },
            ],
        ];
    }
}
