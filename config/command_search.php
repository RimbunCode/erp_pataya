<?php
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Core\Preference;
use App\Models\Finances\PaymentSchedule;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemAlternative;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;

return [
    'enabled'           => true,
    'default_limit'     => 30,
    'max_limit'         => 100,
    'record_chunk_size' => 300,

    /*
    |--------------------------------------------------------------------------
    | Model Priority
    |--------------------------------------------------------------------------
    |
    | Prioritas tambahan untuk model tertentu saat ranking hasil search.
    | Nilai lebih tinggi = hasil model lebih diprioritaskan saat relevansi mirip.
    |
    | Contoh:
    | \App\Models\Inventory\Item::class => 100,
    | \App\Models\Inventory\ItemAlternative::class => 10,
    |
    */
    'model_priorities' => [
        Item::class            => 100,
        ItemVariant::class     => 50,
        ItemAlternative::class => 0,
    ],

    /*
    |--------------------------------------------------------------------------
    | Model Exclusions
    |--------------------------------------------------------------------------
    |
    | - exclude_models: tidak diindex sama sekali (navigation + record)
    | - exclude_record_models: tidak diindex sebagai record, navigation tetap boleh
    |
    */
    'exclude_models' => [
        Preference::class,
    ],

    'exclude_record_models' => [
    ],

    /*
    |--------------------------------------------------------------------------
    | Record Target Mapping
    |--------------------------------------------------------------------------
    |
    | Jika model sumber tidak punya route *.show langsung, mapping ini dipakai
    | untuk resolve target dokumen final.
    |
    */
    'record_target_relations' => [
        PaymentSchedule::class      => 'payment_scheduleable',
        ApprovalInstanceStep::class => 'approvalInstance.document',
        StockLedgerEntry::class     => 'referenceable',
    ],

    /*
    |--------------------------------------------------------------------------
    | Route Override
    |--------------------------------------------------------------------------
    |
    | Pakai saat inferensi route otomatis tidak sesuai.
    |
    */
    'route_overrides' => [
        // \App\Models\Some\Model::class => 'someModels.show',
    ],
];
