<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Services\Guest\GuestPageContentService;
use Inertia\Inertia;
use Inertia\Response;

class GuestPageController extends Controller {
    public function __construct(private GuestPageContentService $guestPageContentService) {}

    public function home(): Response {
        return Inertia::render('Guest/Index', [
            'content' => $this->guestPageContentService->resolve(),
        ]);
    }

    public function verify(): Response {
        return Inertia::render('Guest/VerifyCTA/VerifyCTA', [
            'content' => $this->guestPageContentService->resolve(),
        ]);
    }

    public function about(): Response {
        return Inertia::render('Guest/AboutUs/AboutUs', [
            'content' => $this->guestPageContentService->resolve(),
        ]);
    }

    public function contact(): Response {
        return Inertia::render('Guest/Contact/ContactInfo', [
            'content' => $this->guestPageContentService->resolve(),
        ]);
    }
}
