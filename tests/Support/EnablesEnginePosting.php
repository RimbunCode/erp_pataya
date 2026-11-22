<?php

namespace Tests\Support;

use App\Models\Finances\Account;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\PostingProfileService;

/**
 * Pembantu uji Finance Fase 2, Task 14.1 dan Q-P2-23 (2026-11-22): semua posting berjalan lewat Posting Engine yang
 * selalu aktif (tidak ada mode `off`/`shadow`). Uji yang memposting dokumen memanggil `enableEnginePosting()` di
 * `setUp()` (setelah `setUpFinanceFixtures()` yang memuat `PostingProfile::class`): bila peta peran diberikan, sebuah
 * Posting Profile aktif sejak 2020 memetakan peran ke akun fixture. Peta dibuat eksplisit per kelas uji supaya jelas akun mana yang menjawab tiap peran; fallback legacy
 * (`finance.posting.legacy_account_fallback`) TIDAK dinyalakan.
 */
trait EnablesEnginePosting {
    /**
     * @param  array<string, Account|string>  $roleAccounts  peran => akun (atau id akun) default profil (kosong: tanpa profil)
     */
    protected function enableEnginePosting(array $roleAccounts = []): ?PostingProfile {
        if ($roleAccounts === []) {
            return null;
        }

        $profiles = app(PostingProfileService::class);

        return $profiles->activate($profiles->createDraft(
            'Profil uji',
            '2020-01-01',
            null,
            array_map(fn (Account|string $account): string => $account instanceof Account ? (string) $account->id : $account, $roleAccounts),
        ));
    }

    /**
     * Metode Pembayaran dengan akun kas/bank default: sumber akun master `cash_or_bank` bagi Payment Entry
     * (Requirement 7.4). Pasang pada Payment Entry lewat `['payment_method_id' => $method->id]`.
     */
    protected function makeCashPaymentMethod(Account $cash): PaymentMethod {
        return PaymentMethod::create(['name' => 'Metode ' . $cash->account_number . ' ' . substr((string) $cash->id, -6), 'default_account_id' => $cash->id]);
    }
}
