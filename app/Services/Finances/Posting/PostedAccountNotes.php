<?php

namespace App\Services\Finances\Posting;

/**
 * Kumpulan `PostedAccountNote` satu kali posting, dengan helper bagi recorder domain untuk menulis balik akun yang
 * benar-benar dipakai ke dokumen sumber (Requirement 13.2).
 */
final readonly class PostedAccountNotes {
    /**
     * @param  list<PostedAccountNote>  $notes
     */
    public function __construct(private array $notes = []) {}

    /**
     * @return list<PostedAccountNote>
     */
    public function all(): array {
        return $this->notes;
    }

    public function isEmpty(): bool {
        return $this->notes === [];
    }

    /**
     * @return list<PostedAccountNote>
     */
    public function forRole(string $role): array {
        return array_values(array_filter($this->notes, static fn (PostedAccountNote $note): bool => $note->role === $role));
    }

    /**
     * @return list<PostedAccountNote>
     */
    public function forPurpose(string $purpose): array {
        return array_values(array_filter($this->notes, static fn (PostedAccountNote $note): bool => $note->purpose === $purpose));
    }

    /**
     * Akun tunggal untuk peran tingkat dokumen: akun catatan pertama peran itu, null bila peran tidak dipakai.
     */
    public function accountFor(string $role): ?string {
        return $this->forRole($role)[0]->accountId ?? null;
    }

    /**
     * Akun peran itu bila SEMUA catatannya satu akun; null bila peran tidak dipakai atau akunnya beragam. Dipakai
     * untuk kolom header peran per baris (mis. revenue, expense).
     */
    public function uniformAccountFor(string $role): ?string {
        $accounts = array_values(array_unique(array_map(static fn (PostedAccountNote $note): string => $note->accountId, $this->forRole($role))));

        return \count($accounts) === 1 ? $accounts[0] : null;
    }

    /**
     * Peta `lineId => accountId` untuk peran per baris; catatan tanpa `lineId` dilewati. Bila satu baris punya
     * beberapa catatan peran itu, yang terakhir menang.
     *
     * @return array<string, string>
     */
    public function byLine(string $role): array {
        $map = [];
        foreach ($this->forRole($role) as $note) {
            if ($note->lineId !== null) {
                $map[$note->lineId] = $note->accountId;
            }
        }

        return $map;
    }
}
