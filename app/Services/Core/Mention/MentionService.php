<?php

namespace App\Services\Core\Mention;

use App\Models\User\User;
use App\Notifications\CommentMentionNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Database\Eloquent\Model;

/**
 * Mengekstrak user yang di-@mention dari comment dan mengirimi mereka
 * CommentMentionNotification.
 */
class MentionService {
    public function __construct(
        private MentionAudienceResolver $audience,
        private NotifyUser $notifyUser,
    ) {}

    /**
     * Ambil id user yang di-mention.
     *
     * Sumber utama adalah `comment_json` (dokumen ProseMirror: node `type: mention`
     * dengan `attrs.id`), BUKAN HTML. HTMLSanitizerService membuang atribut
     * `data-id`/`data-type` (whitelist-nya hanya class/id/style/href/src/alt/title),
     * jadi `Log.activity` yang tersimpan tidak lagi memuat info mention, sementara
     * `comment_json` disimpan utuh. Memakai sumber yang sama untuk comment lama
     * (saat edit) dan comment baru membuat selisih keduanya konsisten.
     *
     * HTML mentah dari request hanya jadi cadangan bila `comment_json` tidak dikirim
     * (kolomnya nullable). Cocokkan `<span>` ber-`data-type="mention"` + `data-id`
     * dalam urutan atribut apa pun, supaya node lain ber-`data-id` tidak ikut tertangkap.
     *
     * @param  array<string, mixed>|null  $commentJson
     * @return array<int, string>
     */
    public function mentionedUserIds(?array $commentJson, ?string $html = null): array {
        $ids = [];

        if ($commentJson !== null && $commentJson !== []) {
            $this->collectFromNode($commentJson, $ids);
        } elseif ($html !== null && preg_match_all('/<span\b[^>]*>/i', $html, $spans)) {
            foreach ($spans[0] as $tag) {
                if (
                    preg_match('/\sdata-type\s*=\s*"mention"/i', $tag)
                    && preg_match('/\sdata-id\s*=\s*"([^"]+)"/i', $tag, $match)
                ) {
                    $ids[] = $match[1];
                }
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Kirim notifikasi mention untuk `$userIds`. Dilewati: pemicu sendiri (self-mention),
     * user yang tidak ada, dan user yang tidak punya akses `read` atas dokumen. Filter
     * permission di sini adalah lapis kedua: dropdown autocomplete hanya membatasi UI,
     * sedangkan payload comment bisa dipalsukan lewat devtools.
     *
     * @param  array<int, string>  $userIds
     */
    public function notify(?Model $document, User $actor, array $userIds): void {
        if ($document === null) {
            return;
        }

        $userIds = array_values(array_diff($userIds, [(string) $actor->getKey()]));
        if ($userIds === []) {
            return;
        }

        $allowed = $this->audience->readableBy($document::class, $document, $userIds);
        if ($allowed === []) {
            return;
        }

        foreach (User::whereIn('id', $allowed)->get() as $recipient) {
            $this->notifyUser->send($recipient, new CommentMentionNotification($document, $actor));
        }
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @param  array<int, string>  $ids
     */
    private function collectFromNode(array $node, array &$ids): void {
        if (($node['type'] ?? null) === 'mention') {
            $id = $node['attrs']['id'] ?? null;
            if (is_string($id) && $id !== '') {
                $ids[] = $id;
            }
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                $this->collectFromNode($child, $ids);
            }
        }
    }
}
