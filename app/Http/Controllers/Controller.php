<?php

namespace App\Http\Controllers;

use App\Http\Requests\Core\CommentRequest;
use App\Http\Requests\Core\TagRequest;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\Log;
use App\Models\Core\Preference;
use App\Models\Core\PrintTemplate;
use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use App\Models\Sales\SalesOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use App\Utils;
use Exception;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

abstract class Controller {
    protected string $model;
    protected        $permissions;
    protected        $modelPermissions;
    protected        $onlyCreator      = false;
    protected string $lang;
    protected bool   $ignorePermission = false;

    /**
     * Summary of setBreadcrumbs
     *
     * @param  (Model|string)[]  $models
     * @return void
     */
    protected function setBreadcrumbs(Model|string ...$models) {
        $instanceModel = new $this->model;
        if (empty($models)) {
            $breadcrumbs = [['name' => ($instanceModel->translateKey ?? '') . '.title']];
        } else {
            $breadcrumbs = [];
            /**
             * @var Model $model
             */
            foreach ($models as $key => $model) {
                if (\gettype(value: $model) == 'string') {
                    if ($key == 0) {
                        $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? '') . '.title', 'link' => route("{$instanceModel->route}.index")];
                    }
                    $breadcrumbs[] = ['name' => $model];
                    break;
                }
                if ($key == 0) {
                    $breadcrumbs[] = ['name' => ($instanceModel->translateKey ?? '') . '.title', 'link' => route("{$model->route}.index")];
                    $name          = Arr::get($model->toArray(), $model->keyBreadcrumb ?? '', $model->name);
                    $breadcrumbs[] = ($key == (count($models) - 1)) ?
                        ['name' => $name] :
                        ['name' => $name, 'link' => route("{$model->route}.show", $model->id)];

                    continue;
                }
                preg_match('/([^\\\\]+)$/', \get_class($model), $className);
                $alias         = $model->aliasBreadcrumb ?? $className[1];
                $value         = Arr::get($model->toArray(), $model->keyBreadcrumb ?? '', $model->name);
                $breadcrumbs[] = ($key == (count($models) - 1)) ?
                    ['name' => "{$alias}: {$value}"] :
                    ['name' => "{$alias}: {$value}", 'link' => route("{$model->route}.show", $model->id)];
            }
        }
        Inertia::share([
            'breadcrumbs' => $breadcrumbs,
        ]);
    }

    protected function guard(array|string $action, int $level = 0) {
        return $this->model::_checkPermission($action, $level);
    }

    /**
     * Summary of exceptPermission
     *
     * @return null|bool
     */
    protected function exceptPermission(string $method) {
        return null;
    }

    /**
     * Summary of enforcePermission
     *
     * @return null|string|string[]|bool
     */
    protected function enforcePermission(string $method) {
        return null;
    }

    private function _matchMethodWithPermission(string $method) {
        return \in_array($method, ['addComment', 'addTag', 'addFile', 'removeFile', 'removeComment', 'removeTag']);
    }

    public function __construct(Request $request, ?string $model = null) {
        if (! $model) {
            return;
        }
        $this->lang  = $request->cookie('lang') ?? 'en';
        $this->model = $model;
        if (! $model) {
            return;
        }
        Inertia::share([
            'model' => $model,
        ]);

        if (! $this->ignorePermission) {
            $currentRoute = Route::getCurrentRoute();
            $method       = $currentRoute->getActionMethod();

            $customPermission = $this->exceptPermission($method);
            if (! ($request->hasValidSignature() && $request->user()->id == ($request->u ?? ''))) {
                if ($customPermission != true) {
                    $this->permissions      = $request->session()->get('permissions');
                    $this->modelPermissions = $this->permissions[$this->model] ?? null;
                    if ($this->modelPermissions === null) {
                        abort(403);
                    }
                    $keyPermission = match ($method) {
                        'index'   => 'select',
                        'create'  => 'create',
                        'store'   => 'create',
                        'show'    => 'read',
                        'update'  => 'write',
                        'destroy' => 'delete',
                        'import'  => 'import',
                        'export'  => 'export',
                        'share'   => 'share',
                        'submit'  => 'submit',
                        'cancel'  => 'cancel',
                        'print'   => 'print',
                        'amend'   => 'amend',
                        default   => $this->enforcePermission($method),
                    };
                    if (! $this->_matchMethodWithPermission($method)) {
                        if ($keyPermission) {
                            $this->onlyCreator = $this->guard($keyPermission, 0);
                            $request->merge(['onlyCreator' => $this->onlyCreator ?? false]);

                            foreach ($currentRoute->parameters() as $value) {
                                if (\is_string($value)) {
                                    continue;
                                }
                                if (\get_class($value) === $this->model) {
                                    $data = $value;
                                }
                            }
                            if (isset($data)) {
                                $allowed = $this->onlyCreator ? $data?->created_by_id == $request->user()->id : true;
                                if (! $allowed) {
                                    abort(403);
                                }
                            }
                        } else {
                            abort(403);
                        }
                    }
                }
            }
        }
    }

    protected function isInertiaRequest(Request $request) {
        if (! $request->ajax()) {
            return true;
        }

        return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
    }

    public function addComment(CommentRequest $request, $param) {
        $request->validated();

        preg_match_all('/data-id="([^"]+)"/', $request->comment, $matches);

        $usersMentioned = collect($matches[1])->unique();
        if ($usersMentioned->count() > 0) {
            $users = User::whereIn('id', $usersMentioned)->get();
        }

        Log::create([
            'user_id'       => $request->user()->id,
            'loggable_id'   => $param,
            'loggable_type' => $this->model,
            'type'          => 'comment',
            'activity'      => $request->comment,
        ]);

        return back();
    }

    protected function renderShow($formPathname, $name, $title, $data, $props = [], $settings = []) {
        return Inertia::render('ShowGeneral', array_merge([
            'name'         => $name,
            'title'        => $title,
            'formPathname' => $formPathname ?? (new $this->model)->formComponent ?? '',
            $name          => $data,
        ], [...$props, 'settings' => $settings]));
    }

    public function removeComment(Request $request, $param, Log $id) {
        if ($id->user_id != $request->user()->id || ! $id || $id->type != 'comment') {
            return back()->with('alert', [
                'message' => 'Failed remove comment',
            ]);
        }
        $id->delete();

        return back()->with('alert', [
            'message' => 'Failed remove comment',
        ]);
    }

    public function addTag(TagRequest $request, $param) {
        $request->validated();

        if ($request->new) {
            $tag = Tag::create([
                'name' => $request->name,
            ]);
            $tag->logs()->create([
                'user_id'  => $request->user()->id,
                'activity' => [
                    'en' => ':user created this',
                    'id' => ':user telah membuat ini',
                ],
            ]);
        }
        $tag = $request->isNew ? Tag::create([
            'name' => $request->name,
        ]) : Tag::find($request->id);

        Taggable::create([
            'taggable_id'   => $param,
            'taggable_type' => $this->model,
            'tag_id'        => $tag->id,
        ]);

        return back();
    }

    public function removeTag(Request $request, $param, Tag $id) {
        Taggable::where('taggable_id', $param)
            ->where('taggable_type', operator: $this->model)
            ->where('tag_id', $id->id)->delete();

        return back();
    }

    public function addFile(Request $request, $param) {
        DB::beginTransaction();
        preg_match('/[^\\\\]+$/', $this->model, $folderName);

        File::uploadFile($request, $folderName[0], function ($file) use ($param) {
            Fileable::create([
                'fileable_id'   => $param,
                'fileable_type' => $this->model,
                'file_id'       => $file->id,
            ]);
        });
        DB::commit();

        return back();
    }

    public function removeFile(Request $request, $param, File $id) {
        try {
            Fileable::where('fileable_id', $param)
                ->where('fileable_type', $this->model)
                ->where('file_id', $id->id)->delete();
        } catch (Exception $e) {
            dd($e);
        }

        return back();
    }

    public function print(Request $request, mixed $id, ?PrintTemplate $printTemplate = null) {
        $data = $this->model::find($id);
        $this->setBreadcrumbs($data, __('core/form.print_preview'));

        // Resolve the print template first so we can use its used_relations
        $printTemplate ??= PrintTemplate::where('model', $this->model)
            ->where('is_default', true)
            ->first();

        // Use template's used_relations for optimized eager loading when available
        $usedRelations = $printTemplate?->getUsedRelations() ?? [];

        $relationTracker                                             = app(RelationTrackerService::class);
        ['relations' => $validRelations, 'modelColumns' => $columns] = $relationTracker->validateRelations($this->model, $usedRelations, true);
        $data->load($validRelations);

        $printTemplate->loadRelations();

        $docInfo = [
            'doc_name' => $data->translateKey . ".name",
        ];

        return Inertia::render('Core/Print', [
            'doc'           => $data,
            'docInfo'       => $docInfo,
            'columns'       => $columns,
            'printTemplate' => $printTemplate->toArray(),
        ]);
    }

    public function createPrintTemplate() {
        $model         = Permission::where('model', $this->model)->first();
        $printTemplate = PrintTemplate::create([
            'model'      => $this->model,
            'name'       => "{$model->name}-" . Utils::generateRandom(5),
            'name_model' => $model->name,
        ]);

        return redirect()->route('printTemplates.show', $printTemplate);
    }

    public function amend(string $id) {
        $data = $this->model::findOrFail($id);
        if (! $data) {
            return back();
        }

        $test = new SalesOrder;

        $newData = $data->amend();

        $currentRoute = Route::getCurrentRoute();
        $route        = Str::before($currentRoute->getAction()['as'], '.') . '.show';

        return redirect()->route($route, $newData->id);
    }
}
