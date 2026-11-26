<?php

namespace App\Services\Finances\Posting\AccountPanel;

use App\Enums\AccountRole;
use App\Enums\FormStatus;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Models\Finances\Account;
use App\Services\Finances\Posting\PostedAccountNote;
use App\Services\Finances\Posting\PostingService;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * Data panel baca-saja "Akun pencatatan" pada halaman dokumen (Finance Fase 2, Task 12.4; Requirement 13.4 dan 13.7).
 * Tidak pernah menulis ke DB, tidak memicu posting, dan tidak pernah melempar: kegagalan pratinjau menjadi `state`
 * `error`, bukan halaman 500. Status dokumen menentukan sumber data (bukan "ada kolom terisi atau tidak"), agar kolom
 * lama pada draf tidak tampil sebagai akun yang akan dipakai.
 *
 * `state`:
 * - `preview`: dokumen draf atau menunggu approval; akun hasil `PostingService::previewAccounts()` atas data
 *   tersimpan dan tanggal hari ini. `estimated` true bila ada angka yang baru pasti saat approve.
 * - `recorded`: dokumen sudah lewat approval dan akun tercatat pada kolom dokumen.
 * - `pending_approval`: draf yang jenisnya tidak dapat dipratinjau (Delivery Note, Purchase Receipt); akun baru
 *   ditentukan saat approve.
 * - `pending_posting`: sudah lewat approval tetapi belum ada akun tercatat (posting belum selesai atau gagal, atau
 *   dokumen dibuat sebelum pencatatan akun).
 * - `unavailable`: tidak ada yang ditampilkan (jenis tanpa panel, dokumen dibatalkan/ditolak/dihapus, atau data
 *   pendukung pratinjau belum lengkap).
 * - `error`: pratinjau gagal. Untuk `UnresolvedAccountRoleException`, `message` menyebut peran dan lapis yang kurang
 *   dan `fixable` true (Requirement 13.7); kegagalan lain dilaporkan ke log dan memakai pesan umum.
 *
 * @phpstan-type PanelRow array{role: string, label: string, lines: int, account: array{id: string, number: ?string, name: ?string}}
 * @phpstan-type PanelData array{state: string, estimated: bool, message: ?string, fixable: bool, rows: list<PanelRow>}
 */
final class PostedAccountPanel {
    private const array INACTIVE   = [FormStatus::CANCELED, FormStatus::REJECTED, FormStatus::DELETED];
    private const array UNAPPROVED = [FormStatus::DRAFT, FormStatus::NEED_APPROVAL];

    public function __construct(
        private readonly PanelSourceRegistry $sources,
        private readonly PostingService $posting,
    ) {}

    public function supports(Model $document): bool {
        return $this->sources->typeFor($document) !== null;
    }

    /**
     * @return PanelData
     */
    public function build(Model $document): array {
        $type   = $this->sources->typeFor($document);
        $source = $type === null ? null : $this->sources->sourceFor($type);
        if ($source === null) {
            return $this->result('unavailable');
        }

        try {
            $statuses = $this->statuses($document);
            if ($this->hasAny($statuses, self::INACTIVE)) {
                return $this->result('unavailable');
            }

            if ($this->hasAny($statuses, self::UNAPPROVED)) {
                $ctx = $source->previewContext($document);
                if ($ctx === null) {
                    return $this->result('pending_approval');
                }

                return $this->result('preview', estimated: $source->previewIsEstimate(), rows: $this->rowsFromPreview($this->posting->previewAccounts($ctx)->all()));
            }

            $recorded = $source->recorded($document);
            if ($recorded === []) {
                return $this->result('pending_posting');
            }

            return $this->result('recorded', rows: $this->rows($recorded));
        } catch (UnresolvedAccountRoleException $e) {
            return $this->result('error', message: $e->getMessage(), fixable: true);
        } catch (Throwable $e) {
            // Panel adalah informasi tambahan: kegagalan apa pun tidak boleh merusak halaman dokumen, tetapi tetap dilaporkan.
            report($e);

            return $this->result('error', message: __('finances/postedAccounts.errors.preview_failed'));
        }
    }

    /**
     * @return list<string>
     */
    private function statuses(Model $document): array {
        return array_values(array_map(
            static fn (mixed $status): string => $status instanceof BackedEnum ? (string) $status->value : (string) $status,
            (array) $document->getAttribute('status'),
        ));
    }

    /**
     * @param  list<string>  $statuses
     * @param  list<FormStatus>  $wanted
     */
    private function hasAny(array $statuses, array $wanted): bool {
        return array_intersect($statuses, array_map(static fn (FormStatus $status): string => $status->value, $wanted)) !== [];
    }

    /**
     * @param  list<PanelRow>  $rows
     * @return PanelData
     */
    private function result(string $state, bool $estimated = false, ?string $message = null, bool $fixable = false, array $rows = []): array {
        return ['state' => $state, 'estimated' => $estimated, 'message' => $message, 'fixable' => $fixable, 'rows' => $rows];
    }

    /**
     * Catatan akun hasil resolve dikelompokkan per peran dan akun; baris peka-barang menghitung jumlah baris.
     *
     * @param  list<PostedAccountNote>  $notes
     * @return list<PanelRow>
     */
    private function rowsFromPreview(array $notes): array {
        $groups = [];
        foreach ($notes as $note) {
            $key = "{$note->role}|{$note->accountId}";

            $groups[$key] ??= ['role' => $note->role, 'account' => $note->accountId, 'lines' => 0, 'seen' => []];
            if ($note->lineId !== null && ! isset($groups[$key]['seen'][$note->lineId])) {
                $groups[$key]['seen'][$note->lineId] = true;
                $groups[$key]['lines']++;
            }
        }

        return $this->rows(array_values(array_map(
            static fn (array $group): RecordedAccount => new RecordedAccount($group['role'], $group['account'], $group['lines']),
            $groups,
        )));
    }

    /**
     * Satu query untuk seluruh akun (tanpa N+1).
     *
     * @param  list<RecordedAccount>  $recorded
     * @return list<PanelRow>
     */
    private function rows(array $recorded): array {
        $ids      = array_values(array_unique(array_map(static fn (RecordedAccount $row): string => $row->accountId, $recorded)));
        $accounts = $ids === []
            ? []
            : Account::query()->withoutGlobalScopes()->withTrashed()->whereIn('id', $ids)->get()->keyBy(fn (Account $account): string => (string) $account->getKey())->all();

        return array_map(static function (RecordedAccount $row) use ($accounts): array {
            $account = $accounts[$row->accountId] ?? null;

            return [
                'role'    => $row->role,
                'label'   => AccountRole::tryFrom($row->role)?->label() ?? $row->role,
                'lines'   => $row->lines,
                'account' => ['id' => $row->accountId, 'number' => $account?->account_number, 'name' => $account?->account_name],
            ];
        }, $recorded);
    }
}
