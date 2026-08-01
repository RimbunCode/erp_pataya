<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class LogController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Log::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Log::dataTable($request);

        return Inertia::render('Core/Logs/Index');
    }

    public function show(Log $log) {
        $this->model = $log->loggable_type;
        $data        = class_exists($this->model) ? $this->model::find($log->loggable_id) : null;

        if (! $data) {
            $this->setBreadcrumbs($log);

            return Inertia::render('Core/ShowLog', [
                'title'        => $log->code,
                'formPathname' => '',
                'dataBefore'   => $log->data_before,
                'dataAfter'    => $log->data_after,
                'log'          => function () use ($log) {
                    $log->load('user');

                    return $log;
                },
            ]);
        }

        $keyBreadcrumb = $data->keyBreadcrumb ?? 'name';
        $this->setBreadcrumbs($data, $log);
        $alias = $this->staticPropertyOrNull($this->model, 'alias');
        $name  = Str::singular($alias ??
            \ucwords(str_replace(['_', '-'], ' ', $data->getTable())));

        return Inertia::render('Core/ShowLog', [
            'title'        => $data->$keyBreadcrumb,
            'formPathname' => $data->formComponent ?? '',
            'dataBefore'   => $log->data_before,
            'dataAfter'    => $log->data_after,
            'log'          => function () use ($log) {
                $log->load('user');

                return $log;
            },
        ]);
    }

    /**
     * Baca property STATIC bertipe apa pun secara aman. Beda dengan
     * `property_exists()` (yang tidak membedakan static/instance),
     * akses langsung `$model::$prop` pada property instance melempar
     * fatal Error — reflection di sini memverifikasi keduanya sebelum baca.
     */
    private function staticPropertyOrNull(string $class, string $property): mixed {
        if (! class_exists($class)) {
            return null;
        }
        try {
            $reflection = new \ReflectionProperty($class, $property);
        } catch (\ReflectionException) {
            return null;
        }

        return $reflection->isStatic() ? $reflection->getValue() : null;
    }
}
