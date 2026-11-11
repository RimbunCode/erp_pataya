<?php

namespace Database\Factories\Finances;

use App\Models\Finances\JournalVoucher;
use App\Models\Finances\JournalVoucherItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Baris Journal Voucher. `account_id` wajib diberikan pemanggil (akun dibuat lewat fixture test); tepat satu sisi
 * bernilai > 0 (`state` `debit()` atau `credit()`).
 *
 * @extends Factory<JournalVoucherItem>
 */
class JournalVoucherItemFactory extends Factory {
    protected $model = JournalVoucherItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'journal_voucher_id' => JournalVoucher::factory(),
            'debit'              => 100,
            'credit'             => 0,
            'line_no'            => 1,
        ];
    }

    public function debit(float|int|string $amount): static {
        return $this->state(['debit' => $amount, 'credit' => 0]);
    }

    public function credit(float|int|string $amount): static {
        return $this->state(['debit' => 0, 'credit' => $amount]);
    }
}
