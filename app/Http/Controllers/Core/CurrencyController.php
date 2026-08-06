<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CurrencyRequest;
use App\Models\Core\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CurrencyController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Currency::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Currency::dataTable($request);

        return Inertia::render('Settings/Currencies/Index');
    }

    public function show(Currency $currency) {
        $this->setBreadcrumbs($currency);
        $currency->showDetail();

        return Inertia::render('Settings/Currencies/Show', [
            'currency' => function () use ($currency) {
                $currency->loadRelations();

                return $currency;
            },
        ]);
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Currencies/Show');
    }

    public function store(CurrencyRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $currency = Currency::create($data);
        DB::commit();

        return back()->with('id', $currency->code);
    }

    public function update(CurrencyRequest $request, Currency $currency) {
        $data = $request->validated();
        DB::beginTransaction();
        $currency->fillForUpdate($data);
        DB::commit();

        return back();
    }
}
