<?php

namespace App\Http\Requests\User;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Lang;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest {
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
            'name'              => ['required', 'string', 'min:3', 'max:255'],
            'email'             => ['required', 'string', 'email:rfc'],
            'username'          => ['nullable', Rule::requiredIf(fn () => $this->id == $this->user()->id), 'string', 'regex:/^[\w\-\.]*$/'],
            'gender'            => ['nullable', 'string', 'in:male,female'],
            'birthdate'         => ['nullable', 'date'],
            'phone'             => ['nullable', 'string'],
            'roles'             => ['nullable', 'array', 'min:1'],
            'roles.*'           => ['required', 'string', 'exists:roles,id'],
            'branches'          => ['nullable', 'array', 'min:1'],
            'branches.*'        => ['nullable', Rule::requiredIf(fn () => $this->id != $this->user()->id), 'string', 'exists:branches,id'],
            'default_branch_id' => ['nullable', Rule::requiredIf(fn () => $this->id != $this->user()->id), 'string', 'exists:branches,id'],
        ];
    }

    private function scanDirectory($dir) {
        $files = scandir($dir);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $path = $dir . DIRECTORY_SEPARATOR . $file;

            if (is_dir($path)) {
                $results[$file] = $this->scanDirectory($path); // Panggil rekursi jika folder
            } else {
                $results[] = \str_replace('.php', '', $file); // Simpan file ke array
            }
        }

        return $results;
    }
    // public function attributes() {
    //   dd($this->scanDirectory(\base_path('lang\en')));
    //   dd(scandir(\base_path('lang\en')));
    //   dd(include_once \base_path('lang\en\user\user'));
    //   $locale = app()->getLocale();
    //   return [
    //     'default_branch_id' => $locale == 'id' ? 'test' : 'default branch',
    //   ];
    // }
}
