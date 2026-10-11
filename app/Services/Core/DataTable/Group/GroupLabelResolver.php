<?php

namespace App\Services\Core\DataTable\Group;

use App\Models\Core\Preference;
use Illuminate\Database\Eloquent\Model;

/**
 * Label deskriptor grup untuk level relasi yang butuh perlakuan khusus
 * (spec asset-ownership-morph Requirement 8):
 *
 * - `groupMorph` (relasi morph): label MINIMAL pemilik -- `id`, `thisModel`,
 *   `templateLink`, dan kolom yang dirujuk templateLink -- BUKAN seluruh baris
 *   model target (SELECT * child morph membawa kolom sensitif, mis. phone/email/
 *   banks Customer). `thisModel` dipakai penyaring kolom aman endpoint lookup.
 * - `groupNullLabel` (grup NULL): label bawaan dari config kolom, mis.
 *   `['preference' => 'company_name']` -> nama perusahaan sebagai grup "milik
 *   sendiri" (ownership_id NULL).
 */
class GroupLabelResolver {
    /**
     * @return array<string, mixed>|null
     */
    public static function morphLabel(?Model $owner): ?array {
        if ($owner === null) {
            return null;
        }

        $class        = $owner::class;
        $templateLink = \method_exists($class, 'templateLink') ? (string) $class::templateLink() : ':name';
        \preg_match_all('/:([A-Za-z_]\w*)/', $templateLink, $matches);

        $label = [$owner->getKeyName() => $owner->getKey()];
        foreach (\array_unique($matches[1]) as $attribute) {
            $label[$attribute] = $owner->getAttribute($attribute);
        }

        return [...$label, 'id' => $owner->getKey(), 'templateLink' => $templateLink, 'thisModel' => $class];
    }

    /**
     * Label grup NULL dari config kolom; null bila config tak ada/ kosong.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>|null
     */
    public static function nullLabel(array $config): ?array {
        $preferenceKey = $config['groupNullLabel']['preference'] ?? null;
        if (! \is_string($preferenceKey) || $preferenceKey === '') {
            return null;
        }

        $name = Preference::find($preferenceKey)?->value;
        if (! \is_string($name) || $name === '') {
            return null;
        }

        return ['name' => $name, 'templateLink' => ':name'];
    }
}
