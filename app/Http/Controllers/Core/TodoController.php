<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\TodoRequest;
use App\Models\Core\Todo;
use App\Services\Core\TodoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TodoController extends Controller {
    protected bool $ignorePermission = true;
    private TodoService $service;

    public function __construct(Request $request, TodoService $service) {
        $this->service = $service;
        parent::__construct($request, Todo::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();

        $scope = $request->query('scope');
        $query = match ($scope) {
            'mine'  => Todo::assignedToMe($request->user()),
            'byMe'  => Todo::assignedByMe($request->user()->id),
            default => Todo::query(),
        };

        $query->dataTable($request);

        return Inertia::render('Core/Todos/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Core/Todos/Show');
    }

    public function store(TodoRequest $request) {
        DB::beginTransaction();
        $todo = $this->service->create($request->validated());
        DB::commit();

        return redirect()->route('todos.show', $todo)->with('id', $todo->id);
    }

    public function show(Todo $todo) {
        $this->setBreadcrumbs($todo);
        $todo->showDetail();

        return Inertia::render('Core/Todos/Show', [
            'todo' => function () use ($todo) {
                $todo->loadRelations();

                return $todo;
            },
            'referenceLabel' => $todo->reference?->code ?? $todo->reference?->name,
            'referenceRoute' => $todo->reference
                ? Str::plural($todo->reference->getNameClass()) . '.show'
                : null,
        ]);
    }

    public function update(TodoRequest $request, Todo $todo) {
        DB::beginTransaction();
        $this->service->update($todo, $request->validated());
        DB::commit();

        return back();
    }

    public function destroy(Todo $todo) {
        DB::beginTransaction();
        $todo->delete();
        $todo->logForDeleted();
        DB::commit();

        return redirect()->route('todos.index');
    }
}
