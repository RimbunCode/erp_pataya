<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot saldo per akun sebagai baseline rekonsiliasi Finance Fase 1 (read-only).
 *
 * Konvensi tanda (diverifikasi dari `StockEntryService`, satu-satunya penulis `accounts.balance_amount`):
 * `balance_amount` bertanda "debit − kredit" untuk semua akun, tanpa memandang `balance_type`. Maka
 * `net` = Σdebit − Σkredit dari baris GL aktif dan `difference` = `net` − `balance_amount`.
 */
final class BalanceSnapshotService {
    public const HEADER = [
        'account_id', 'account_number', 'account_name', 'root_type', 'balance_type',
        'sum_debit', 'sum_credit', 'net', 'balance_amount', 'difference', 'note',
    ];

    public function __construct(private ?string $connection = null) {}

    /**
     * Menulis CSV (header + satu baris per akun, termasuk akun tanpa transaksi) ke handle terbuka.
     *
     * @param  resource  $handle
     * @return int jumlah baris akun yang ditulis
     */
    public function write($handle): int {
        /** @var Connection $db */
        $db = DB::connection($this->connection);

        fputcsv($handle, self::HEADER);

        $written = 0;
        $columns = ['a.id', 'a.account_number', 'a.account_name', 'a.root_type', 'a.balance_type', 'a.balance_amount', 'a.deleted_at'];

        $accounts = $db->table('accounts as a')
            ->leftJoin('general_ledgers as gl', function ($join) {
                $join->on('gl.account_id', '=', 'a.id')->whereNull('gl.deleted_at');
            })
            ->select($columns)
            ->selectRaw('COALESCE(SUM(gl.debit), 0) as sum_debit, COALESCE(SUM(gl.credit), 0) as sum_credit')
            ->groupBy($columns)
            ->orderBy('a.account_number')
            ->orderBy('a.id');

        foreach ($accounts->cursor() as $account) {
            fputcsv($handle, $this->row($account));
            $written++;
        }

        return $written;
    }

    /**
     * @return list<string>
     */
    private function row(object $account): array {
        $sumDebit  = (float) $account->sum_debit;
        $sumCredit = (float) $account->sum_credit;
        $net       = $sumDebit - $sumCredit;
        $balance   = (float) $account->balance_amount;

        $notes = [];
        if ($account->balance_type === null) {
            $notes[] = 'balance_type kosong';
        }
        if ($account->deleted_at !== null) {
            $notes[] = 'akun soft-deleted';
        }

        return [
            $account->id,
            $account->account_number,
            $account->account_name,
            $account->root_type,
            $account->balance_type ?? '',
            $this->number($sumDebit),
            $this->number($sumCredit),
            $this->number($net),
            $this->number($balance),
            $this->number($net - $balance),
            implode('; ', $notes),
        ];
    }

    private function number(float $value): string {
        return number_format($value, 4, '.', '');
    }
}
