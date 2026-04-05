<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Models\Finances\GeneralLedger;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GeneralLedgerController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, GeneralLedger::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        GeneralLedger::dataTable($request);

        return Inertia::render('Finances/GeneralLedger', [
        ]);
    }
}
