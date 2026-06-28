<?php

namespace App\Services\Core;

use App\Models\Core\Changelog;
use App\Models\Core\ChangelogRead;
use App\Models\User\User;
use League\CommonMark\GithubFlavoredMarkdownConverter;

class ChangelogService {
    public function store(string $version, string $environment, string $raw): Changelog {
        return Changelog::updateOrCreate(
            ['version' => $version],
            [
                'environment'  => $environment,
                'content_raw'  => $raw,
                'content_html' => $this->processHtml($raw),
                'deployed_at'  => now(),
            ],
        );
    }

    public function markAllRead(User $user): void {
        $unread = Changelog::whereDoesntHave('reads', fn ($q) => $q->where('user_id', $user->id))->get();

        foreach ($unread as $changelog) {
            ChangelogRead::firstOrCreate(
                ['changelog_id' => $changelog->id, 'user_id' => $user->id],
                ['read_at' => now()],
            );
        }
    }

    public function getUnreadCount(User $user): int {
        return Changelog::whereDoesntHave('reads', fn ($q) => $q->where('user_id', $user->id))->count();
    }

    private function processHtml(string $raw): string {
        // Inject ticket links sebelum parse Markdown agar [#code] dalam backtick
        // atau plain text tetap terkonversi. Regex hanya match format [#code] kita.
        $withLinks = preg_replace(
            '/\[#([\w\/\-]+)\]/',
            '[#$1](/tickets?code=$1)',
            $raw,
        );

        // html_input=strip mencegah arbitrary HTML dari raw content dieksekusi (XSS).
        $converter = new GithubFlavoredMarkdownConverter([
            'html_input'         => 'strip',
            'allow_unsafe_links' => false,
        ]);

        return (string) $converter->convert($withLinks);
    }
}
