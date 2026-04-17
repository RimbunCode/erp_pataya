<?php

namespace App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;

class Utils {
    public static function renderShow($formPathname, $name, $title, $data, $props = []) {
        return Inertia::render('ShowGeneral', array_merge([
            'name'         => $name,
            'title'        => $title,
            'formPathname' => $formPathname,
            $name          => $data,
        ], $props));
    }

    public static function isInertiaRequest(Request $request) {
        if (! $request->ajax()) {

            return true;
        }

        return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
    }

    public static function generateRandom($length, $includeSpecial = false) {
        $result           = '';
        $characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        if ($includeSpecial) {
            $characters .= '!@#$%^&*()_+-=[]{}|;\':",./<>?';
        }
        $charactersLength = strlen($characters);
        $counter          = 0;
        while ($counter < $length) {
            $result .= $characters[rand(0, $charactersLength - 1)];
            $counter += 1;
        }

        return $result;
    }

    public static function isNullOrWhitespace($value) {
        return $value === null || trim($value) === '';
    }

    public static function convertQuantity($qty, $conversionFactorFrom, $conversionFactorTo = 1) {
        if ($conversionFactorFrom == $conversionFactorTo) {
            return $qty;
        }

        if ($conversionFactorFrom > $conversionFactorTo) {
            return $qty * $conversionFactorFrom / $conversionFactorTo;
        }

        return $qty * $conversionFactorTo / $conversionFactorFrom;
    }

    public static function getValueObject($obj, $key) {
        $keys     = explode('.', $key);
        $newValue = $obj;
        foreach ($keys as $k) {
            if (is_array($newValue) && array_key_exists($k, $newValue)) {
                $newValue = $newValue[$k];
            } else {
                return null;
            }
        }

        return $newValue;
    }

    public static function convertTemplateLink($value) {
        if (! $value) {
            return null;
        }
        if ($value instanceof Collection || $value instanceof Model) {
            $value = $value->toArray();
        } elseif (! is_array($value)) {
            return null;
        }
        if (! isset($value['templateLink'])) {
            return null;
        }

        $template = $value['templateLink'] ?? '';
        $item     = preg_replace_callback('/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/', function ($match) use ($value) {
            $match[0] = preg_replace('/(.*?){:(.*?)}/i', ':$2', $match[0]);
            $newValue = static::getValueObject($value, substr($match[0], 1));

            return $newValue ?: $match[0];
        }, $template);

        preg_match('/<title(.*?)>(.*?)<\/title>/i', $item, $titleMatch);
        preg_match('/^[^<]+/', $item, $plainTextMatch);

        if (! empty($titleMatch)) {
            return trim($titleMatch[2] ?? '');
        }
        if (! empty($plainTextMatch)) {
            return trim($plainTextMatch[0] ?? '');
        }

        return null;
    }

    /**
     * @param  array<FormStatus>  $status
     * @param FormStatus
     *     | array<FormStatus>                                    // a) any-of / b) full-pattern (lihat di bawah)
     *     | array<int, array{from: FormStatus, to: FormStatus|array<FormStatus>}> // c) rule-list
     * $from
     * @param  FormStatus|array<FormStatus>|null  $to  // hanya dipakai untuk a) & b)
     * @param  bool  $forceInsert  // jika tidak ada yang terganti, tambahkan $to ke hasil
     * @return array<FormStatus>
     */
    public static function replaceStatus(
        array $status,
        FormStatus|array $from,
        FormStatus|array|null $to = null,
        bool $forceInsert = false,
    ): array {
        $current = $status;

        $toArray = function (FormStatus|array|null $v): array {
            if ($v === null) {
                return [];
            }

            return \is_array($v) ? \array_values($v) : [$v];
        };

        $dedup = function (array $arr): array {
            $seen = [];

            return \array_values(\array_filter($arr, function (FormStatus $s) use (&$seen) {
                $k = $s->value; // atau $s->value
                if (isset($seen[$k])) {
                    return false;
                }
                $seen[$k] = true;

                return true;
            }));
        };

        $isAllEnum = function (array $arr): bool {
            foreach ($arr as $v) {
                if (! $v instanceof FormStatus) {
                    return false;
                }
            }

            return true;
        };

        // === (c) RULE LIST: [['from'=>FormStatus,'to'=>FormStatus|FormStatus[]], ...]
        $isRuleList = \is_array($from)
          && $from !== []
          && \is_array($from[0] ?? null)
          && \array_key_exists('from', $from[0])
          && \array_key_exists('to', $from[0]);

        if ($isRuleList) {
            /** @var array<int, array{from: FormStatus, to: FormStatus|array<FormStatus>}> $from */
            $work = $current;
            foreach ($from as $rule) {
                $work = static::replaceStatus($work, $rule['from'], $rule['to'], $rule['forceInsert'] ?? $forceInsert);
            }

            return $dedup($work);
        }

        // === (a) ANY-OF: ganti setiap elemen yang ada di daftar $from (jika $from array enum)
        //      (tambahkan blok ini jika kamu ingin perilaku any-of selain full-pattern)
        if (\is_array($from) && $isAllEnum($from) && $to !== null) {
            $fromSet = array_flip(array_map(fn (FormStatus $s) => $s->value, $from));
            $rep     = $toArray($to);
            $out     = [];
            $changed = false;

            foreach ($current as $st) {
                if (isset($fromSet[$st->value])) {
                    $out     = array_merge($out, $rep);
                    $changed = true;
                } else {
                    $out[] = $st;
                }
            }

            if (! $changed && $forceInsert) {
                $out = array_merge($out, $rep);
            }

            return $dedup($out);
        }

        // === (b) FULL-PATTERN: jika seluruh isi array sama dengan pola (set-compare), ganti jadi $to
        if (is_array($from) && $isAllEnum($from)) {
            /** @var array<FormStatus> $from */
            $pattern = array_values($from);
            $a       = array_map(fn (FormStatus $s) => $s->value, $pattern);
            $b       = array_map(fn (FormStatus $s) => $s->value, $current);
            sort($a);
            sort($b);

            if ($a === $b) {
                return $dedup($toArray($to));
            }

            // tidak match → pakai forceInsert kalau diminta
            if ($forceInsert) {
                return $dedup(array_merge($current, $toArray($to)));
            }

            return $current;
        }

        // === (1) SINGLE: ganti satu enum → 1..n
        if ($from instanceof FormStatus) {
            $replacement = $toArray($to);
            $out         = [];
            $changed     = false;

            foreach ($current as $st) {
                if ($st === $from) {
                    $out     = array_merge($out, $replacement);
                    $changed = true;
                } else {
                    $out[] = $st;
                }
            }

            if (! $changed && $forceInsert) {
                $out = array_merge($out, $replacement);
            }

            return $dedup($out);
        }

        // default
        return $current;
    }

    public static function getPreferenceColumns() {
        return [
            [
                'name'  => 'company_name',
                'title' => trans('core/company.company_details.name'),
                'type'  => 'string',
            ],
            [
                'name'  => 'short_name',
                'title' => trans('core/company.company_details.short_name'),
                'type'  => 'string',
            ],
            [
                'name'  => 'email',
                'title' => trans('core/company.company_details.email'),
                'type'  => 'string',
            ],
            [
                'name'  => 'phone',
                'title' => trans('core/company.company_details.phone'),
                'type'  => 'string',
            ],
            [
                'name'  => 'street',
                'title' => trans('core/company.company_details.street'),
                'type'  => 'string',
            ],
            [
                'name'  => 'city',
                'title' => trans('core/company.company_details.city'),
                'type'  => 'string',
            ],
            [
                'name'  => 'state',
                'title' => trans('core/company.company_details.state'),
                'type'  => 'string',
            ],
            [
                'name'  => 'zip_code',
                'title' => trans('core/company.company_details.zip_code'),
                'type'  => 'string',
            ],
            [
                'name'  => 'country_name',
                'title' => trans('core/company.company_details.country'),
                'type'  => 'string',
            ],
        ];
    }

    public static function countAmount($basicAmount, $taxAmount, $discountOn, $discountAmount) {
        switch ($discountOn) {
            case 'grand_total':
                return $basicAmount + $taxAmount - $discountAmount;
            case 'net_total':
                return $basicAmount - $discountAmount + $taxAmount;
            default:
                return $basicAmount + $taxAmount;
        }
    }

    public static function findRelationsTo(string $model, string $targetClass): array {
        $relations = [];

        // hindari query/constraint selama deteksi
        Relation::noConstraints(function () use ($model, $targetClass, &$relations) {
            $model   = new $model;
            $reflect = new \ReflectionClass($model);

            foreach ($reflect->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
                // lewati method bawaan Eloquent & static
                if ($method->isStatic() || $method->getNumberOfParameters() > 0) {
                    continue;
                }
                $name = $method->getName();
                if (in_array($name, ['newQuery', 'newModelQuery', 'getAttribute'])) {
                    continue;
                }

                try {
                    $relation = $model->$name();
                } catch (\Throwable $e) {
                    continue; // skip method yang bukan relasi/throw
                }

                if (
                    $relation instanceof Relation &&
                    is_a($relation->getRelated(), $targetClass)
                ) {
                    $relations[] = $name;
                }
            }
        });

        return $relations; // misal: ['items', 'itemLines']
    }
}
