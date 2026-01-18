<?php

namespace App\Traits;

use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

trait TreeView {
  protected static bool $is_tree_view = true;

  protected static function bootTreeView() {
    static::creating(function (Model $model) {
      /** @var Model&self $model */

      return DB::transaction(function () use ($model) {
        $parentId = $model->parent_id;

        if ($parentId) {
          $parent = $model->newQuery()->lockForUpdate()->findOrFail($parentId);

          $rgt = $parent->rgt;

          $model->newQuery()->where('rgt', '>=', $rgt)->increment('rgt', 2);
          $model->newQuery()->where('lft', '>', $rgt)->increment('lft', 2);

          $model->lft   = $rgt;
          $model->rgt   = $rgt + 1;
          $model->depth = $parent->depth + 1;
        } else {
          $maxRgt = $model->newQuery()->max('rgt');
          $lft    = $maxRgt + 1;

          $model->lft   = $lft;
          $model->rgt   = $lft + 1;
          $model->depth = 0;
        }

        return true;
      });
    });

    static::updating(function (Model $model) {
      /** @var Model&self $model */
      // Jika sedang pass kedua, biarkan save lanjut
      if ($model->movingGuard) {
        return true;
      }

      // HANYA jalankan move saat parent_id memang berubah
      if (! $model->isDirty('parent_id')) {
        return true;
      }

      // Jalankan move atomik; JANGAN refresh() di sini
      $newParentId = $model->getAttribute('parent_id');
      $model->performMoveFromEvent($newParentId);

      // Set guard supaya updating berikutnya tidak eksekusi move lagi
      $model->movingGuard = true;

      // Biarkan Eloquent melanjutkan UPDATE → updated/saved tetap terpanggil
      return true;
    });
    // Soft delete cascade subtree; force delete tutup gap — sama seperti sebelumnya
    static::deleting(function (Model $model) {
      /** @var Model&self $model */
      $table = $model->getTable();

      return DB::transaction(function () use ($model, $table) {
        $lft   = $model->lft;
        $rgt   = $model->rgt;
        $width = $rgt - $lft + 1;

        $usingSoft = \in_array(SoftDeletes::class, class_uses_recursive($model))
          && method_exists($model, 'isForceDeleting')
          && ! $model->isForceDeleting();

        if ($usingSoft) {
          $now = now();
          $model->newQuery()->whereBetween("lft", [$lft, $rgt])->update(['deleted_at' => $now]);
          return false; // cegah delete default (kita sudah set subtree)
        }

        // force delete
        $model->newQuery()->whereBetween("lft", [$lft, $rgt])->delete();
        $model->newQuery()->where("rgt", '>', $rgt)->decrement("rgt", $width);
        $model->newQuery()->where("lft", '>', $rgt)->decrement("lft", $width);
        return false;
      });
    });

    static::restoring(function (Model $model) {
      /** @var Model&self $model */
      $table = $model->getTable();
      return DB::transaction(function () use ($model, $table) {
        $parentId = $model->parent_id;
        if ($parentId) {
          $parent = $model->newQuery()->withTrashed()->find($parentId);
          if ($parent && method_exists($parent, 'trashed') && $parent->trashed()) {
            throw new \RuntimeException('Restore parent terlebih dahulu.');
          }
        }
        $model->newQuery()->whereBetween($model->lft, [$model->lft, $model->rgt])
          ->update(['deleted_at' => null]);
        return true;
      });
    });
  }
  protected bool $movingGuard = false;

  /** Dipanggil dari event updating: melakukan move atomik */
  protected function performMoveFromEvent($parentId): void {
    $table = $this->getTable();

    DB::transaction(function () use ($table, $parentId) {
      $node = $this->newQuery()->lockForUpdate()->findOrFail($this->getKey());

      // guard soft-deleted
      if (in_array(SoftDeletes::class, class_uses_recursive($node)) && method_exists($node, 'trashed') && $node->trashed()) {
        throw new \RuntimeException('Tidak dapat memindahkan node yang sedang soft-deleted.');
      }

      $lft   = (int) $node->lft;
      $rgt   = (int) $node->rgt;
      $depth = (int) $node->depth;
      $width = $rgt - $lft + 1;

      if ($parentId) {
        $parent = $this->newQuery()->lockForUpdate()->withTrashed()->findOrFail($parentId);

        if (method_exists($parent, 'trashed') && $parent->trashed()) {
          throw new \RuntimeException('Target parent sedang soft-deleted.');
        }

        // larang pindah ke dalam subtree sendiri
        if ($parent->lft >= $lft && $parent->rgt <= $rgt) {
          throw new \RuntimeException('Tidak boleh memindahkan ke dalam subtree sendiri.');
        }

        // OPEN GAP di target (pakai nilai rgt lama parent SEBELUM open gap)
        $targetRgt = (int) $parent->rgt;
        $this->newQuery()->where('rgt', '>=', $targetRgt)->increment('rgt', $width);
        $this->newQuery()->where('lft', '>', $targetRgt)->increment('lft', $width);

        // // refresh posisi SETELAH open gap
        $parent = $this->newQuery()->lockForUpdate()->withTrashed()->findOrFail($parentId);
        $node   = $this->newQuery()->lockForUpdate()->findOrFail($this->getKey());

        // offset = parent.rgt(setelah open) - width - node.lft(sekarang)
        $offset     = (int) $parent->rgt - $width - (int) $node->lft;
        $depthDelta = (int) $parent->depth + 1 - (int) $node->depth;

        // SHIFT BLOK subtree
        $this->newQuery()
          ->whereBetween('lft', [$node->lft, $node->rgt])
          ->update([
            'lft'   => DB::raw("lft + {$offset}"),
            'rgt'   => DB::raw("rgt + {$offset}"),
            'depth' => DB::raw("depth + {$depthDelta}"),
          ]);

        // CLOSE GAP lama
        $this->newQuery()->where('rgt', '>', $rgt)->decrement('rgt', $width);
        $this->newQuery()->where('lft', '>', $rgt)->decrement('lft', $width);

        // Update parent_id TANPA event (hindari loop)
        $this->updateQuietly(['parent_id' => $parentId]);

      } else {
        // PINDAH JADI ROOT PALING KANAN (tanpa open gap)
        $maxRgt = (int) $this->newQuery()->max('rgt');
        $offset = $maxRgt + 1 - $lft;

        // geser blok ke ujung kanan, set depth kembali relatif ke root
        $this->newQuery()
          ->whereBetween('lft', [$lft, $rgt])
          ->update([
            'lft'   => DB::raw("lft + {$offset}"),
            'rgt'   => DB::raw("rgt + {$offset}"),
            'depth' => DB::raw("depth - {$depth}"), // root kembali depth 0
          ]);

        // tutup gap lama
        $this->newQuery()->where('rgt', '>', $rgt)->decrement('rgt', $width);
        $this->newQuery()->where('lft', '>', $rgt)->decrement('lft', $width);

        $this->updateQuietly(['parent_id' => null]);
      }
    });
  }

  /**
   * Rebuild nested set values (lft, rgt, depth) for the entire table.
   * Runs in a transaction and locks rows to prevent concurrent writes.
   *
   * @param string|null $orderBy Optional column to order siblings before rebuilding.
   */
  public static function rebuildTree(?string $orderBy = null): void {
    /** @var Model&self $instance */
    $instance = new static();
    $query    = static::query();

    $usesSoftDeletes = \in_array(SoftDeletes::class, class_uses_recursive($instance));
    if ($usesSoftDeletes) {
      $query->withTrashed();
    }

    DB::transaction(function () use ($instance, $query, $orderBy) {
      // Lock all rows to keep snapshot stable while rebuilding
      $nodes   = $query->lockForUpdate()->get();
      $allIds  = $nodes->pluck($instance->getKeyName())->all();
      $grouped = $nodes->groupBy(function ($node) use ($allIds) {
        // Treat missing parents as roots to avoid losing orphans
        return $node->parent_id && in_array($node->parent_id, $allIds, true)
          ? $node->parent_id
          : null;
      });

      $counter = 1;
      $updates = [];

      $walk = function ($parentId, $depth) use (&$walk, &$counter, &$updates, $grouped, $instance, $orderBy) {
        if (! isset($grouped[$parentId])) {
          return;
        }

        $children = $grouped[$parentId]->sortBy(function ($node) use ($instance, $orderBy) {
          // Keep user order if provided, else existing lft, fallback to primary key for stability
          if ($orderBy) {
            return [$node->getAttribute($orderBy), $node->getKey()];
          }
          return [$node->lft ?? PHP_INT_MAX, $node->getKey()];
        });

        foreach ($children as $child) {
          $left = $counter++;
          $walk($child->getKey(), $depth + 1);
          $right = $counter++;

          $updates[$child->getKey()] = [
            'lft'   => $left,
            'rgt'   => $right,
            'depth' => $depth,
          ];
        }
      };

      $walk(null, 0);

      foreach ($updates as $id => $payload) {
        static::query()->whereKey($id)->update($payload);
      }
    });
  }
}
