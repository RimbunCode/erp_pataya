<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Services\Core\ManualBookService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ManualBookController extends Controller {
    protected bool $ignorePermission = true;

    public function __construct(
        Request $request,
        private readonly ManualBookService $manualBookService,
    ) {
        parent::__construct($request, null);
    }

    public function index(): Response {
        return Inertia::render('Core/ManualBook/Index', [
            'sections' => $this->manualBookService->listSections(),
        ]);
    }

    public function show(string $section): Response {
        $rendered = $this->manualBookService->renderSection($section);

        if ($rendered === null) {
            throw new NotFoundHttpException;
        }

        return Inertia::render('Core/ManualBook/Show', $rendered);
    }
}
