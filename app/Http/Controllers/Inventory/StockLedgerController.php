<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Inventory\StockLedgerEntry;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StockLedgerController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, StockLedgerEntry::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        StockLedgerEntry::dataTable($request);

        return Inertia::render('Inventory/StockLedger', [
        ]);
    }

    public function show(StockLedgerEntry $stockLedger) {
        $this->setBreadcrumbs($stockLedger);
        $stockLedger->showDetail();

        return Inertia::render('Inventory/StockLedgers/Show', [
            'stockLedger' => function () use ($stockLedger) {
                $stockLedger->loadRelations();

                return $stockLedger;
            },
        ]);
    }
}
