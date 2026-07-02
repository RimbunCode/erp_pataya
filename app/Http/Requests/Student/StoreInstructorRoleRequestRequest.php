<?php

namespace App\Http\Requests\Student;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class StoreInstructorRoleRequestRequest extends BaseFormRequest {
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
            'notes'      => ['required', 'string', 'max:2000'],
            'files'      => ['nullable', 'array', 'size:1'],
            'files.*'    => ['required', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,webp'],
            'filesId'    => ['nullable', 'array', 'size:1'],
            'filesId.*'  => ['required', 'string', 'exists:files,id'],
            'name'       => ['required_with:files', 'array', 'size:1'],
            'name.*'     => ['required_with:files', 'string', 'max:255'],
            'isPublic'   => ['required_with:files', 'array', 'size:1'],
            'isPublic.*' => ['required_with:files'],
        ];
    }

    /**
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array {
        return [
            function (Validator $validator): void {
                $hasUploadedFile = $this->hasFile('files');
                $hasLibraryFile  = \is_array($this->input('filesId')) && \count($this->input('filesId')) > 0;

                if (! $hasUploadedFile && ! $hasLibraryFile) {
                    $validator->errors()->add('files', 'Bukti wajib diunggah.');
                }

                if ($hasUploadedFile && $hasLibraryFile) {
                    $validator->errors()->add('files', 'Gunakan salah satu sumber file saja.');
                }
            },
        ];
    }
}
