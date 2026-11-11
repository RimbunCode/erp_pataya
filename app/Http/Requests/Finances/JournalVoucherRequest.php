<?php

namespace App\Http\Requests\Finances;

use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Http\Requests\BaseFormRequest;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalDraftValidator;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * Validasi Journal Voucher (Finance Fase 1, Task 11; Requirement 12.1-12.2). Aturan ledger memakai validator yang
 * sama dengan `JournalService` (`JournalDraftValidator`): minimal 2 baris, tepat satu sisi per baris, dan
 * Σdebit = Σkredit dalam minor unit mata uang dasar, sehingga satu aturan keseimbangan berlaku di form dan di posting.
 * Pemeriksaan periode hanya dilakukan bila penegakan periode aktif (Q-P1-2).
 */
class JournalVoucherRequest extends BaseFormRequest {
    /** Batas atas nominal baris: kolom `decimal(20,4)` dan rentang aman `MinorUnit` (nilai >= 1e16 ditolak). */
    private const MAX_AMOUNT = '9999999999999999';

    public function authorize(): bool {
        return true;
    }

    /**
     * Sisi debit/kredit kosong dibaca sebagai 0 (form mengirim null untuk sisi yang tidak diisi).
     */
    protected function prepareForValidation(): void {
        $this->normalizeDate();

        $items = $this->input('items');
        if (! \is_array($items)) {
            return;
        }

        foreach ($items as $index => $item) {
            if (! \is_array($item)) {
                continue;
            }
            $items[$index]['debit']  = ($item['debit'] ?? null) === null || $item['debit'] === '' ? 0 : $item['debit'];
            $items[$index]['credit'] = ($item['credit'] ?? null) === null || $item['credit'] === '' ? 0 : $item['credit'];
        }
        $this->merge(['items' => $items]);
    }

    /**
     * Tanggal ber-offset (mis. `+07:00`) dinormalkan ke `config('app.timezone')` sebelum disimpan: Eloquent menulis
     * jam dinding apa adanya tanpa konversi, sehingga tanpa ini instan yang tersimpan bergeser (Requirement 6.9).
     */
    private function normalizeDate(): void {
        $date = $this->input('date');
        if (! \is_string($date) || trim($date) === '') {
            return;
        }

        try {
            $normalized = CarbonImmutable::parse($date)->setTimezone((string) config('app.timezone'))->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return;
        }
        $this->merge(['date' => $normalized]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'                => ['required', 'date'],
            'description'         => ['nullable', 'string', 'max:1000'],
            'items'               => ['required', 'array', 'min:2'],
            'items.*.id'          => ['nullable', 'string'],
            'items.*.account.id'  => ['required', 'string', new ExistsExcludingTrashed('accounts'), fn (string $attribute, mixed $value, Closure $fail) => $this->failWhenAccountNotPostable($value, $fail)],
            'items.*.debit'       => ['required', 'numeric', 'min:0', 'max:' . self::MAX_AMOUNT, 'decimal:0,4'],
            'items.*.credit'      => ['required', 'numeric', 'min:0', 'max:' . self::MAX_AMOUNT, 'decimal:0,4'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $draft = $this->draft();

            try {
                JournalDraftValidator::validate($draft, app(JournalService::class)->baseCurrency()[1]);
            } catch (InvalidJournalException|UnbalancedJournalException $e) {
                $validator->errors()->add('items', $e->getMessage());

                return;
            }

            if ((bool) app(SettingsService::class)->getForRead(FinanceSetting::class)->enforce_fiscal_period) {
                try {
                    app(FiscalPeriodService::class)->assertOpen($draft->transactionDate);
                } catch (ClosedPeriodException $e) {
                    $validator->errors()->add('date', $e->getMessage());
                }
            }
        }];
    }

    /**
     * Akun grup dan akun nonaktif tidak dapat diposting (`JournalService`), jadi ditolak sejak form disimpan.
     *
     * @param  Closure(string): mixed  $fail
     */
    private function failWhenAccountNotPostable(mixed $accountId, Closure $fail): void {
        if (! \is_string($accountId)) {
            return;
        }

        $account = Account::query()->withoutGlobalScopes()->find($accountId);
        if ($account === null || $account->deleted_at !== null) {
            return;
        }
        $label = "{$account->account_number} - {$account->account_name}";

        if ($account->is_group) {
            $fail(InvalidJournalException::accountIsGroup($label)->getMessage());
        } elseif ($account->is_disabled) {
            $fail(InvalidJournalException::accountDisabled($label)->getMessage());
        }
    }

    private function draft(): JournalDraft {
        $lines = [];
        foreach ((array) $this->input('items', []) as $item) {
            $lines[] = new JournalLineDraft(
                accountId: (string) $item['account']['id'],
                debit: $item['debit'],
                credit: $item['credit'],
            );
        }

        return new JournalDraft(
            transactionDate: CarbonImmutable::parse((string) $this->input('date')),
            lines: $lines,
        );
    }
}
