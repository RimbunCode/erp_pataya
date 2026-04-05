<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class LogContent implements CastsAttributes {
    private function convertToString($contents) {
        return implode('', array_map(function ($content) {

            if (! is_array($content)) {
                return "{$content}";
            }

            $payload = $content['content'] ?? '';
            $type    = $content['type'] ?? '';

            if (in_array($type, ['list', 'orderedList', 'ol', 'ul'])) {
                $tag   = in_array($type, ['list', 'ul']) ? 'ul' : 'ol';
                $lists = implode('', array_map(fn ($x) => "<li>{$x}</li>", $payload));

                return "<{$tag}>{$lists}</{$tag}>";
            }

            if (is_array($payload)) {
                $payload = $this->convertToString($payload);
            }

            switch ($type) {
                case 'br':
                    return '<br>';

                case 'strong':
                case 'bold':
                    return "<strong>{$payload}</strong>";

                case 'em':
                case 'i':
                case 'italic':
                    return "<em>{$payload}</em>";

                case 'u':
                case 'underline':
                    return "<u>{$payload}</u>";

                case 'link':
                    return "<a href=\"{$content['href']}\" rel=\"noopener noreferrer\" target=\"_blank\" >{$payload}</a>";

                case 'p':
                case '':
                    return "<pre>{$payload}</pre>";

                default:
                    return "<{$type}>{$payload}</{$type}>";

            }
        }, $contents));
    }

    /**
     * Cast the given value.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed {
        if (($attributes['type'] ?? 'log') != 'log') {
            return $value;
        }

        return json_decode($value);
    }

    /**
     * Prepare the given value for storage.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): mixed {
        if (($attributes['type'] ?? 'log') != 'log') {
            return $value;
        }
        $values = [];
        foreach (['en', 'id'] as $lang) {
            if (! is_array($value)) {
                return $values[$lang] = $value;
            }

            $key           = array_key_first($value);
            $val           = $value[$lang] ?? $value[$key];
            $values[$lang] = is_array($val) ? $this->convertToString($val) : "<p>{$val}</p>";
        }

        return json_encode($values);
    }
}
