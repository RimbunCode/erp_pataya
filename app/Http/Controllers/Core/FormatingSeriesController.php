<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\FormatingSeriesRequest;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class FormatingSeriesController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, FormatingSeries::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        FormatingSeries::dataTable($request);

        return Inertia::render('Settings/FormatingSeries/Index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, FormatingSeries $formatingSeries) {
        $this->setBreadcrumbs($formatingSeries);
        $formatingSeries->showDetail();

        return $this->renderShow(
            'Settings/FormatingSeries/Show',
            'formatingSeries',
            $formatingSeries->name,
            $formatingSeries,
            [
                'codeFormats' => function () use ($request, $formatingSeries) {
                    $now             = Carbon::now();
                    $lang            = $request->cookie('lang') ?? 'en';
                    $currentBranchId = $request->session()->get('currentBranch');
                    $branch          = Branch::find($currentBranchId)->first();
                    $codeFormats     = [
                        [
                            'id'      => 'yyyy',
                            'display' => trans('core/formatingSeries.formats.year', locale: $lang) . " ({$now->translatedFormat('Y')})",
                        ],
                        [
                            'id'      => 'yy',
                            'display' => trans('core/formatingSeries.formats.year', locale: $lang) . " ({$now->translatedFormat('y')})",
                        ],
                        [
                            'id'      => 'mmmm',
                            'display' => trans('core/formatingSeries.formats.month', locale: $lang) . " ({$now->translatedFormat('F')})",
                        ],
                        [
                            'id'      => 'mmm',
                            'display' => trans('core/formatingSeries.formats.month', locale: $lang) . " ({$now->translatedFormat('M')})",
                        ],
                        [
                            'id'      => 'mm',
                            'display' => trans('core/formatingSeries.formats.month', locale: $lang) . " ({$now->translatedFormat('m')})",
                        ],
                    ];

                    $currentBranchId = $request->session()->get('currentBranch');
                    $branch          = Branch::find($currentBranchId)->first();

                    $model = $formatingSeries->model;
                    with(new $model, function ($objectModel) use (&$codeFormats, $branch, $lang) {
                        if (method_exists($objectModel, 'codeRelations')) {
                            $codeRelations = \array_map(function ($codeRelation) use ($objectModel) {
                                $splitCodeRelation = \explode(':', $codeRelation);
                                $id                = $splitCodeRelation[0];
                                $splitRelation     = explode('.', $splitCodeRelation[1]);
                                $relation          = $splitRelation[0];
                                $key               = $splitRelation[1];

                                return [
                                    'id'       => $id,
                                    'relation' => $relation,
                                    'model'    => $objectModel->$relation()->getModel()::class,
                                    'key'      => $key,
                                ];
                            }, $objectModel->codeRelations() ?? []);
                            $formatingRelation = FormatingSeries::whereIn('model', array_column($codeRelations, 'model'))->get();
                            foreach ($codeRelations as $codeRelation) {
                                $id       = $codeRelation['id'];
                                $relation = $codeRelation['relation'];
                                if ($relation == 'branch') {
                                    $key     = $codeRelation['key'];
                                    $display = ($key == 'code') ? $branch->code : $branch->name;

                                    $codeFormats[] = [
                                        'id'      => $id,
                                        'display' => trans('core/formatingSeries.formats.branch', locale: $lang) . " ($display)",
                                        'value'   => $display,
                                    ];

                                    continue;
                                }
                                $formatingSeries = $formatingRelation->where('model', $codeRelation['model'])?->first();
                                if ($formatingSeries) {
                                    $codeFormats[] = [
                                        'id'      => $id,
                                        'display' => Str::headline($id),
                                        'value'   => $formatingSeries?->format,
                                    ];

                                    continue;
                                }
                                $codeFormats[] = [
                                    'id'      => $id,
                                    'display' => Str::headline($id),
                                ];
                            }
                        }
                    });

                    return $codeFormats;
                },
            ],
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(FormatingSeriesRequest $request, FormatingSeries $formatingSeries) {
        $data = $request->validated();
        DB::beginTransaction();

        $logs                    = (array) $formatingSeries->logs;
        $formatingSeries->format = $data['format'];
        $keys                    = $formatingSeries->getKeyLogs();
        if (! \array_key_exists($keys, $logs)) {
            $logs[$keys] = [
                'current'    => 0,
                'updated_at' => now(),
            ];
            $data['logs'] = $logs;
        }

        $formatingSeries->fillForUpdate($data);
        $formatingSeries->logForUpdated();

        DB::commit();

        return back();
    }

    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Settings/FormatingSeries/Show',
            'formatingSeries',
            null,
            new ($this->model),
        );
    }
}
