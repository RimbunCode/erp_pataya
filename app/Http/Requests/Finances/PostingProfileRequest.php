<?php

namespace App\Http\Requests\Finances;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use App\Models\Finances\Account;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Masukan simpan/ubah Posting Profile `draft` (Finance Fase 2, Requirement 8.1): nama, rentang berlaku, catatan, dan
 * peta peran => akun default, dan aturan akun bersyarat (Requirement 12, Task 12.2). Peran dibatasi pada katalog
 * `AccountRole`; kelayakan akun (non-group, aktif) dan tumpang-tindih diputuskan `PostingProfileService`. Status,
 * versi, dan rantai versi tidak dapat diisi dari request.
 *
 * Aturan dikirim sebagai daftar penuh (menggantikan seluruh aturan draft); tanpa kunci `rules` aturan tidak diubah.
 * Kondisi barang pada peran non peka-barang dan kombinasi kondisi kembar ditolak di sini per baris agar pesan
 * menempel pada barisnya; definisi "kembar" milik `PostingProfileService::conditionKey()` (Requirement 12.2, 12.5).
 */
class PostingProfileRequest extends FormRequest {
    use RejectsUnknownInput {
        withValidator as private rejectUnknownInput;
    }

    private const RULE_KEYS = ['role', 'document_type', 'variant', 'item_type', 'is_stock_item', 'item_category_id', 'account_id', 'priority'];

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name'                     => ['required', 'string', 'max:255'],
            'effective_from'           => ['required', 'date_format:Y-m-d'],
            'effective_to'             => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'notes'                    => ['nullable', 'string', 'max:2000'],
            'accounts'                 => ['nullable', 'array'],
            'accounts.*'               => ['nullable', 'string', 'max:64'],
            'rules'                    => ['nullable', 'array'],
            'rules.*'                  => ['array'],
            'rules.*.role'             => ['required', 'string', Rule::in(AccountRole::values())],
            'rules.*.account_id'       => ['required', 'string', 'max:64'],
            'rules.*.document_type'    => ['nullable', 'string', Rule::in(PostingDocumentType::values())],
            'rules.*.variant'          => ['nullable', 'string', Rule::in(['normal', 'return'])],
            'rules.*.item_type'        => ['nullable', 'string', Rule::in(PostingProfileService::ITEM_TYPES)],
            'rules.*.is_stock_item'    => ['nullable', 'boolean'],
            'rules.*.item_category_id' => ['nullable', 'string', 'max:64', Rule::exists('categories', 'id')->whereNull('deleted_at')],
            'rules.*.priority'         => ['nullable', 'integer', 'min:0', 'max:4294967295'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array {
        return [
            'rules.*.item_category_id.exists' => __('finances/postingProfile.errors.rule_unknown_category'),
        ];
    }

    public function withValidator(Validator $validator): void {
        $this->rejectUnknownInput($validator);

        $validator->after(function (Validator $validator): void {
            foreach (array_keys((array) $this->input('accounts', [])) as $role) {
                if (! \in_array((string) $role, AccountRole::values(), true)) {
                    $validator->errors()->add("accounts.{$role}", __('finances/postingProfile.errors.unknown_role', ['role' => $role]));
                }
            }

            $this->validateRuleRows($validator);
        });
    }

    private function validateRuleRows(Validator $validator): void {
        $rows = $this->input('rules');
        if (! \is_array($rows)) {
            return;
        }

        $service = app(PostingProfileService::class);
        $seen    = [];
        foreach ($rows as $index => $row) {
            if (! \is_array($row)) {
                continue;
            }

            foreach (array_diff(array_keys($row), self::RULE_KEYS) as $unknown) {
                $validator->errors()->add("rules.{$index}.{$unknown}", __('finances/postingProfile.errors.unknown_input', ['field' => $unknown]));
            }

            // Baris yang sudah punya galat apa pun (peran tak dikenal, tipe salah, nilai bukan teks) tidak dinilai lebih lanjut.
            if ($this->rowHasErrors($validator, $index)) {
                continue;
            }

            $role             = (string) ($row['role'] ?? '');
            $hasItemCondition = ($row['item_type'] ?? null) !== null && $row['item_type'] !== ''
                || ($row['is_stock_item'] ?? null) !== null && $row['is_stock_item'] !== ''
                || ($row['item_category_id'] ?? null) !== null && $row['item_category_id'] !== '';
            if ($hasItemCondition && ! AccountRole::isLineSensitiveRole($role)) {
                $validator->errors()->add("rules.{$index}.role", __('finances/postingProfile.errors.rule_item_condition_role', ['role' => $role]));

                continue;
            }

            $key = $service->conditionKey($row);
            if (isset($seen[$key])) {
                $validator->errors()->add("rules.{$index}.role", __('finances/postingProfile.errors.rule_duplicate', ['role' => $role]));
            }
            $seen[$key] = true;

            $this->validateRuleAccount($validator, $index, $role, (string) $row['account_id']);
        }
    }

    private function rowHasErrors(Validator $validator, int|string $index): bool {
        foreach (array_keys($validator->errors()->messages()) as $key) {
            if (str_starts_with((string) $key, "rules.{$index}.")) {
                return true;
            }
        }

        return false;
    }

    /**
     * Akun aturan harus ada, tidak terhapus, bukan group, dan aktif (Requirement 12.5); galat menempel pada barisnya.
     * `PostingProfileService` tetap penjaga akhir.
     */
    private function validateRuleAccount(Validator $validator, int|string $index, string $role, string $accountId): void {
        $account = Account::query()->withoutGlobalScopes()->find($accountId);
        $problem = match (true) {
            $account === null             => 'not_found',
            $account->deleted_at !== null => 'deleted',
            (bool) $account->is_group     => 'group',
            (bool) $account->is_disabled  => 'disabled',
            default                       => null,
        };
        if ($problem === null) {
            return;
        }

        $label = $account === null ? $accountId : "{$account->account_number} - {$account->account_name}";
        $validator->errors()->add("rules.{$index}.account_id", __('finances/postingProfile.errors.account_problem', [
            'role'    => $role,
            'account' => $label,
            'reason'  => __("finances/posting.account_problems.{$problem}"),
        ]));
    }

    /**
     * Peta peran => akun tanpa peran yang dikosongkan.
     *
     * @return array<string, string>
     */
    public function accountMap(): array {
        return array_filter(
            array_map('strval', (array) $this->validated('accounts', [])),
            static fn (string $accountId): bool => $accountId !== '',
        );
    }

    /**
     * Aturan akun bersyarat tervalidasi dalam bentuk yang diterima `PostingProfileService` (daftar kosong bila tidak
     * dikirim).
     *
     * @return list<array<string, mixed>>
     */
    public function ruleRows(): array {
        return array_values(array_map(static fn (array $row): array => Arr::only($row, self::RULE_KEYS), (array) $this->validated('rules', [])));
    }
}
