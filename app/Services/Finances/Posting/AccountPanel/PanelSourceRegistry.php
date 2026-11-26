<?php

namespace App\Services\Finances\Posting\AccountPanel;

use App\Enums\PostingDocumentType;
use Illuminate\Contracts\Container\Container;
use Illuminate\Database\Eloquent\Model;

/**
 * Peta model dokumen => jenis dokumen posting => `PanelSource` (Task 12.4). Pendaftarannya dilakukan di luar
 * namespace Posting (AppServiceProvider), sehingga kode ini tidak mengimpor model modul bisnis (P-8).
 * Sumber di-resolve malas lewat container.
 */
final class PanelSourceRegistry {
    /** @var array<class-string<Model>, PostingDocumentType> */
    private array $types = [];

    /** @var array<string, class-string<PanelSource>> `PostingDocumentType->value` => FQCN `PanelSource` */
    private array $sources = [];

    public function __construct(private readonly Container $container) {}

    /**
     * @param  class-string<Model>  $modelClass
     * @param  class-string<PanelSource>  $sourceClass
     */
    public function register(string $modelClass, PostingDocumentType $type, string $sourceClass): void {
        $this->types[$modelClass]    = $type;
        $this->sources[$type->value] = $sourceClass;
    }

    /**
     * Cek murah tanpa membuat instance model, dipakai DataTable sebelum me-resolve panel.
     */
    public function handles(string $modelClass): bool {
        return isset($this->types[$modelClass]);
    }

    /**
     * Jenis dokumen posting untuk model ini, null bila modelnya tidak punya panel.
     */
    public function typeFor(Model $document): ?PostingDocumentType {
        return $this->types[$document::class] ?? null;
    }

    public function sourceFor(PostingDocumentType $type): ?PanelSource {
        $class = $this->sources[$type->value] ?? null;

        return $class !== null && class_exists($class) ? $this->container->make($class) : null;
    }
}
