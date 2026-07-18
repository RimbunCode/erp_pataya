<?php

namespace App\Services\Core\EmailTemplate;

use App\Models\Core\EmailTemplate;
use App\Models\Core\Preference;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * Compile subject dan body sebuah EmailTemplate menjadi string final,
 * berdasarkan data dokumen nyata. Eksekusi selalu di server (bukan
 * client-side seperti PrintTemplate) karena penerima email tidak
 * membuka aplikasi ini.
 *
 * Merge-tag DIRENDER dengan whitelist substitution (bukan Blade::render()):
 * hanya token berpola `{{ $doc->a->b->c }}`/`{{ $docInfo->x }}`/`{{ $company->x }}`
 * yang disubstitusi via data_get() + escape HTML. Body template ditulis oleh
 * user berpermission write EmailTemplate, tapi tidak pernah dieksekusi sebagai
 * kode PHP — mencegah Server-Side Template Injection meski penulis template
 * tepercaya (defense in depth untuk kasus akun tersebut dibajak, atau scope
 * penulisan template diperluas ke role lebih rendah di spec mendatang).
 */
class EmailTemplateRenderService {
    protected const string TOKEN_PATTERN = '/\{\{\s*\$(doc|docInfo|company)((?:->[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}/';

    public function __construct(
        protected RelationTrackerService $relationTracker,
    ) {}

    /**
     * @return array{subject: string, body: string}
     */
    public function render(EmailTemplate $emailTemplate, Model $doc): array {
        $relations = $this->extractRelationPaths($emailTemplate->subject . $emailTemplate->body_html);

        if ($relations !== [] && $emailTemplate->model) {
            $validRelations = $this->relationTracker->validateRelations($emailTemplate->model, $relations);
            $doc->loadMissing($validRelations);
        }

        $data = [
            'doc'     => $doc,
            'docInfo' => [
                'doc_name' => $doc->translateKey . '.name',
            ],
            'company' => $this->resolveCompanyDetails(),
        ];

        return [
            'subject' => $this->renderMergeTags($emailTemplate->subject, $data),
            'body'    => $this->renderMergeTags($emailTemplate->body_html, $data),
        ];
    }

    /**
     * Ekstrak path relasi dari token `{{ $doc->a->b->c }}`.
     * Semua segmen kecuali yang terakhir dianggap relasi (yang terakhir = atribut).
     *
     * @return string[]
     */
    protected function extractRelationPaths(string $template): array {
        preg_match_all(self::TOKEN_PATTERN, $template, $matches, PREG_SET_ORDER);

        $relations = [];
        foreach ($matches as $match) {
            if ($match[1] !== 'doc' || $match[2] === '') {
                continue;
            }

            $segments = array_values(array_filter(explode('->', $match[2])));

            // Segmen terakhir adalah atribut, bukan relasi.
            array_pop($segments);

            if ($segments === []) {
                continue;
            }

            $path = '';
            foreach ($segments as $segment) {
                $path .= ($path ? '.' : '') . $segment;
                $relations[] = $path;
            }
        }

        return array_values(array_unique($relations));
    }

    protected function resolveCompanyDetails(): array {
        return Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
            ->get(['key', 'value'])
            ->mapWithKeys(fn ($pref) => [$pref->key => $pref->value])
            ->toArray();
    }

    /**
     * Substitusi setiap token whitelist dengan nilai data via data_get()
     * (dot notation, tidak pernah mengeksekusi kode). Token yang tidak
     * cocok pola whitelist, atau path-nya tidak ditemukan, dibiarkan
     * kosong tanpa menggagalkan render token lain.
     */
    protected function renderMergeTags(string $template, array $data): string {
        return preg_replace_callback(self::TOKEN_PATTERN, function ($match) use ($data) {
            [, $root, $accessorChain] = $match;

            $path = $accessorChain === '' ? $root : $root . '.' . implode('.', explode('->', ltrim($accessorChain, '->')));

            try {
                $value = data_get($data, $path);
            } catch (Throwable) {
                return '';
            }

            if (is_array($value) || is_object($value) && ! method_exists($value, '__toString')) {
                return '';
            }

            return e((string) ($value ?? ''));
        }, $template) ?? '';
    }
}
