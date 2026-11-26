<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\Category;
use App\Models\Inventory\ItemVariant;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Membangkitkan profil awal (default) dari COA saat ini (Finance Fase 2, Requirement 2.5): setiap peran yang punya
 * pasangan legacy `(root_type, account_type)` dipetakan ke akunnya BILA tepat satu akun aktif non-group cocok. Bila
 * lebih dari satu akun cocok (ambigu) atau tidak ada, peran dilaporkan dan tidak ditebak. Peran tanpa padanan legacy
 * (akun master atau belum dipakai) dilaporkan terpisah.
 *
 * Profil dibuat berstatus `draft` untuk ditinjau akuntan sebelum diaktifkan (rollout langkah 2). Idempoten: profil
 * awal dikenali dari `name` + versi 1 tanpa pendahulu; menjalankan ulang tidak menggandakan profil, hanya melengkapi
 * peran yang kini dapat di-resolve pada profil yang masih `draft` tanpa menimpa pemetaan yang sudah ada.
 *
 * `proposeRules()` (Requirement 12.7) hanya MENGUSULKAN aturan akun bersyarat awal (barang non-stok, retur, kategori)
 * untuk dibaca dan diputuskan akuntan: read-only, tidak memilih akun, dan tidak pernah membuat aturan.
 */
final class PostingProfileInitializer {
    public const PROFILE_NAME = 'Profil Awal (dari COA)';

    public function __construct(private readonly PostingProfileService $profiles) {}

    /**
     * Analisis read-only COA terhadap katalog peran.
     *
     * @return array{
     *     resolved: array<string, array{id: string, label: string}>,
     *     ambiguous: array<string, list<string>>,
     *     missing: array<string, string>,
     *     master: list<string>
     * }
     */
    public function analyze(): array {
        $report = ['resolved' => [], 'ambiguous' => [], 'missing' => [], 'master' => []];

        foreach (AccountRole::cases() as $role) {
            $pair = $role->legacyPair();
            if ($pair === null) {
                $report['master'][] = $role->value;

                continue;
            }

            [$rootType, $accountType] = $pair;
            $candidates               = Account::query()
                ->where('root_type', $rootType)
                ->where('account_type', $accountType)
                ->where('is_group', false)
                ->where('is_disabled', false)
                ->orderBy('account_number')
                ->get();

            if ($candidates->isEmpty()) {
                $report['missing'][$role->value] = "{$rootType}/{$accountType}";
            } elseif ($candidates->count() > 1) {
                $report['ambiguous'][$role->value] = $candidates->map(fn (Account $account): string => $this->label($account))->all();
            } else {
                $account                          = $candidates->first();
                $report['resolved'][$role->value] = ['id' => $account->getKey(), 'label' => $this->label($account)];
            }
        }

        return $report;
    }

    /**
     * Usulan aturan akun bersyarat awal untuk akuntan (Requirement 12.7, Q-P2-4). Read-only dan deterministik: tiap
     * usulan hanya menyebut bentuk aturan (jenis dokumen, varian, peran, kondisi) beserta DAFTAR kandidat akun; tidak
     * ada akun yang dipilih dan tidak ada aturan yang dibuat. Bentuk usulan mengikuti tabel "Aturan Akun Bersyarat"
     * pada design.md dan lolos validasi `PostingProfileService` bila akuntan memilih salah satu kandidat.
     *
     * Usulan: (1) Sales Invoice retur (`revenue`), (2) Purchase Invoice retur (`expense`), (3) Purchase Invoice
     * barang non-stok (`expense`, `is_stock_item=false`) bila ada varian barang non-stok, dan (4) satu usulan per
     * kategori yang memiliki varian barang non-stok (`is_stock_item=false` + kategori).
     *
     * @param  array{resolved: array<string, array{id: string, label: string}>, ambiguous: array<string, list<string>>}|null  $report  hasil `analyze()` (dihitung sendiri bila null), dipakai untuk kolom akun default peran
     * @return list<array{
     *     key: string,
     *     document_type: string,
     *     variant: string,
     *     role: string,
     *     conditions: array{is_stock_item: bool|null, category: string|null, category_id: string|null},
     *     basis: string|null,
     *     default_account: string,
     *     candidates: list<string>,
     *     note: string|null
     * }>
     */
    public function proposeRules(?array $report = null): array {
        $report ??= $this->analyze();

        $proposals = [
            $this->returnProposal('sales_invoice', AccountRole::Revenue, ['income'], 'penjualan', ['pembelian', 'purchase'], $report),
            $this->returnProposal('purchase_invoice', AccountRole::Expense, ['income', 'expense'], 'pembelian', ['penjualan', 'sales'], $report),
        ];

        $nonStockCount = ItemVariant::query()->where('is_stock_item', false)->count();
        if ($nonStockCount === 0) {
            return $proposals;
        }

        $expenseCandidates = $this->accountLabels(Account::query()->where('root_type', 'expense'))->all();
        $default           = $this->defaultAccount(AccountRole::Expense, $report);

        $proposals[] = [
            'key'             => 'purchase_invoice.non_stock',
            'document_type'   => 'purchase_invoice',
            'variant'         => 'normal',
            'role'            => AccountRole::Expense->value,
            'conditions'      => ['is_stock_item' => false, 'category' => null, 'category_id' => null],
            'basis'           => "{$nonStockCount} varian barang non-stok",
            'default_account' => $default,
            'candidates'      => $expenseCandidates,
            'note'            => 'Tanpa aturan ini baris barang non-stok memakai akun default peran expense (dipetakan ke akun Stok Diterima Belum Ditagih demi parity). Kandidat: akun berakar beban.',
        ];

        foreach ($this->nonStockCategories() as $category) {
            $proposals[] = [
                'key'             => "purchase_invoice.non_stock.category.{$category['id']}",
                'document_type'   => 'purchase_invoice',
                'variant'         => 'normal',
                'role'            => AccountRole::Expense->value,
                'conditions'      => ['is_stock_item' => false, 'category' => $category['name'], 'category_id' => $category['id']],
                'basis'           => "{$category['total']} varian barang non-stok pada kategori ini",
                'default_account' => $default,
                'candidates'      => $expenseCandidates,
                'note'            => 'Perlu hanya bila beban kategori ini berbeda dari beban barang non-stok umum; lebih spesifik, sehingga menang atas aturan non-stok tanpa kategori.',
            ];
        }

        return $proposals;
    }

    /**
     * @param  list<string>  $rootTypes
     * @param  list<string>  $otherWords  kata pembeda dokumen lawan (Indonesia dan Inggris) yang menyingkirkan kandidat
     * @param  array{resolved: array<string, array{id: string, label: string}>, ambiguous: array<string, list<string>>}  $report
     * @return array{key: string, document_type: string, variant: string, role: string, conditions: array{is_stock_item: bool|null, category: string|null, category_id: string|null}, basis: string|null, default_account: string, candidates: list<string>, note: string|null}
     */
    private function returnProposal(string $documentType, AccountRole $role, array $rootTypes, string $ownWord, array $otherWords, array $report): array {
        $candidates = $this->accountLabels(Account::query()->whereIn('root_type', $rootTypes))
            ->filter(static function (string $label) use ($otherWords): bool {
                $name = mb_strtolower($label);

                if (preg_match('/retur/u', $name) !== 1) {
                    return false;
                }
                foreach ($otherWords as $otherWord) {
                    if (str_contains($name, $otherWord)) {
                        return false;
                    }
                }

                return true;
            })
            ->values();

        $note = $candidates->isEmpty()
            ? "Tidak ada akun bernama \"retur\" yang cocok; buat akun Retur {$ownWord} lebih dulu pada COA atau pilih akun lain secara manual."
            : 'Kandidat disaring dari nama akun (mengandung "retur"/"return"); akun lain tetap dapat dipilih manual.';
        if ($documentType === 'purchase_invoice') {
            $note .= ' Tanpa kondisi barang, aturan ini juga berlaku pada baris barang stok; tambahkan kondisi bila perlu.';
        }

        return [
            'key'             => "{$documentType}.return",
            'document_type'   => $documentType,
            'variant'         => 'return',
            'role'            => $role->value,
            'conditions'      => ['is_stock_item' => null, 'category' => null, 'category_id' => null],
            'basis'           => null,
            'default_account' => $this->defaultAccount($role, $report),
            'candidates'      => $candidates->all(),
            'note'            => $note,
        ];
    }

    /**
     * Label akun aktif non-group (terurut nomor akun, lalu id) dari query yang sudah dibatasi `root_type`.
     *
     * @param  Builder<Account>  $query
     * @return Collection<int, string>
     */
    private function accountLabels(Builder $query): Collection {
        return $query
            ->where('is_group', false)
            ->where('is_disabled', false)
            ->orderBy('account_number')
            ->orderBy('id')
            ->get()
            ->map(fn (Account $account): string => $this->label($account))
            ->values();
    }

    /**
     * Kategori (belum dihapus) yang memiliki varian barang non-stok, terurut nama lalu id.
     *
     * @return list<array{id: string, name: string, total: int}>
     */
    private function nonStockCategories(): array {
        $totals = ItemVariant::query()
            ->where('is_stock_item', false)
            ->whereNotNull('category_id')
            ->selectRaw('category_id, count(*) as total')
            ->groupBy('category_id')
            ->pluck('total', 'category_id');

        return Category::query()
            ->whereIn('id', $totals->keys())
            ->orderBy('name')
            ->orderBy('id')
            ->get()
            ->map(static fn (Category $category): array => ['id' => $category->getKey(), 'name' => $category->name, 'total' => (int) $totals[$category->getKey()]])
            ->all();
    }

    /**
     * @param  array{resolved: array<string, array{id: string, label: string}>, ambiguous: array<string, list<string>>}  $report
     */
    private function defaultAccount(AccountRole $role, array $report): string {
        if (isset($report['resolved'][$role->value])) {
            return $report['resolved'][$role->value]['label'];
        }

        return isset($report['ambiguous'][$role->value]) ? '(ambigu; belum dipetakan)' : '(belum dipetakan)';
    }

    /**
     * Menulis profil awal dari hasil `analyze()`.
     *
     * @param  array{resolved: array<string, array{id: string, label: string}>}  $report
     * @return array{profile: PostingProfile|null, action: string, written: list<string>}
     *                                                                                    `action`: `created` | `completed` | `unchanged` | `locked` (profil awal sudah bukan draft; tidak diubah)
     */
    public function apply(array $report, CarbonInterface|string|null $effectiveFrom = null): array {
        $existing = PostingProfile::query()
            ->where('name', self::PROFILE_NAME)
            ->where('version', 1)
            ->whereNull('previous_profile_id')
            ->first();

        $accounts = array_map(static fn (array $row): string => $row['id'], $report['resolved']);

        if ($existing === null) {
            $profile = $this->profiles->createDraft(self::PROFILE_NAME, $effectiveFrom ?? $this->defaultEffectiveFrom(), null, $accounts);

            return ['profile' => $profile, 'action' => 'created', 'written' => array_keys($accounts)];
        }

        if (! $existing->isDraft()) {
            return ['profile' => $existing, 'action' => 'locked', 'written' => []];
        }

        $mapped  = $existing->accounts()->pluck('role')->all();
        $written = [];
        foreach ($accounts as $role => $accountId) {
            if (\in_array($role, $mapped, true)) {
                continue;
            }
            $this->profiles->setAccount($existing, $role, $accountId);
            $written[] = $role;
        }

        return ['profile' => $existing, 'action' => $written === [] ? 'unchanged' : 'completed', 'written' => $written];
    }

    /**
     * Awal tahun fiskal tertua; tanpa tahun fiskal, 1 Januari tahun berjalan.
     */
    public function defaultEffectiveFrom(): string {
        $earliest = FiscalYear::query()->min('start_date');

        return $earliest !== null
            ? CarbonImmutable::parse($earliest)->toDateString()
            : CarbonImmutable::now()->startOfYear()->toDateString();
    }

    private function label(Account $account): string {
        return "{$account->account_number} - {$account->account_name}";
    }
}
