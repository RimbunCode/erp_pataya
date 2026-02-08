<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class LogController extends Controller
{
    public function show(Request $request, Log $log)
    {
        $this->model = $log->loggable_type;
        $data = $this->model::find($log->loggable_id);
        $keyBreadcrumb = $data->keyBreadcrumb ?? 'name';
        $this->setBreadcrumbs($data, $log);
        $name = Str::singular($this->model::$alias ??
          \ucwords(str_replace(['_', '-'], ' ', $data->getTable())));

        return Inertia::render('Core/ShowLog', [
            'title' => $data->$keyBreadcrumb,
            'formPathname' => $data->formComponent ?? $this->model::$formComponent ?? '',
            'dataBefore' => $log->data_before,
            'dataAfter' => $log->data_after,
            'log' => function () use ($log) {
                $log->load('user');

                return $log;
            },
        ]);
    }
}
