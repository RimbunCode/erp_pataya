<?php

namespace App\Services\Asset\AssetItems;

use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

final class AssetItemPartitioner {
    /**
     * @param  Collection<int,Model>  $rows
     * @return array{items: Collection<int,Model>, asset_items: Collection<int,Model>}
     */
    public function partition(Collection $rows): array {
        [$assetItems, $items] = $rows->partition(fn (Model $row) => filled($row->getAttribute('asset_id')));

        return [
            'items'       => $items->values(),
            'asset_items' => $assetItems->values(),
        ];
    }

    public function apply(Model $document): Model {
        $document->loadMissing('items');
        $parts = $this->partition($document->getRelation('items')->toBase());

        $document->setRelation('items', new EloquentCollection($parts['items']->all()));
        $document->setRelation('assetItems', new EloquentCollection($parts['asset_items']->all()));

        return $document;
    }

    /**
     * @param  iterable<mixed>  $rows
     * @param  callable(mixed):(?string)  $assetIdOf
     * @return array{items: list<mixed>, asset_items: list<mixed>}
     */
    public function partitionArrays(iterable $rows, callable $assetIdOf): array {
        $items      = [];
        $assetItems = [];

        foreach ($rows as $row) {
            if (filled($assetIdOf($row))) {
                $assetItems[] = $row;
            } else {
                $items[] = $row;
            }
        }

        return ['items' => $items, 'asset_items' => $assetItems];
    }

    /**
     * @param  array<string,mixed>  $data
     * @return array<string,mixed>
     */
    public static function mergePayload(array $data): array {
        $assetItems = $data['asset_items'] ?? [];
        unset($data['asset_items']);

        if ($assetItems !== []) {
            $data['items'] = array_values(array_merge($data['items'] ?? [], array_values($assetItems)));
        }

        return $data;
    }
}
