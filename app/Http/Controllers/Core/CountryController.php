<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CountryRequest;
use App\Models\Core\Country;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CountryController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Country::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Country::dataTable($request);

        return Inertia::render('Settings/Countries/Index');
    }

    public function show(Country $country) {
        $this->setBreadcrumbs($country);
        $country->showDetail();

        return Inertia::render('Settings/Countries/Show', [
            'country' => function () use ($country) {
                $country->loadRelations();

                return $country;
            },
        ]);
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Countries/Show');
    }

    public function store(CountryRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $country = Country::create($data);
        $country->logForCreated();
        DB::commit();

        return back()->with('id', $country->code);
    }

    public function update(CountryRequest $request, Country $country) {
        $data = $request->validated();
        DB::beginTransaction();
        $country->fillForUpdate($data);
        $country->logForUpdated();
        DB::commit();

        return back();
    }
}
