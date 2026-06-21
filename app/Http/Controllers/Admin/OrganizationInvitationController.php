<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReviewOrganizationInvitationRequest;
use App\Http\Requests\Admin\SendOrganizationInvitationRequest;
use App\Models\OrganizationInvitation;
use App\Services\Admin\OrganizationInvitationService;
use Illuminate\Http\RedirectResponse;

class OrganizationInvitationController extends Controller {
    public function __construct(
        private OrganizationInvitationService $orgInvitationService,
    ) {}

    public function store(SendOrganizationInvitationRequest $request): RedirectResponse {
        $validated = $request->validated();
        $user      = $request->user();

        if (! $user) {
            abort(401);
        }

        $this->orgInvitationService->sendInvitation($validated, $user);

        return back()->with('success', 'Undangan organisasi berhasil dikirim.');
    }

    public function review(ReviewOrganizationInvitationRequest $request, OrganizationInvitation $invitation): RedirectResponse {
        $validated = $request->validated();
        $user      = $request->user();

        if (! $user) {
            abort(401);
        }

        if ($validated['action'] === 'approve') {
            $this->orgInvitationService->approve($invitation, $user);

            return back()->with('success', 'Organisasi berhasil disetujui dan akun telah dibuat.');
        }

        $this->orgInvitationService->reject($invitation, $user, $validated['reason']);

        return back()->with('success', 'Pendaftaran organisasi telah ditolak.');
    }

    public function resend(OrganizationInvitation $invitation): RedirectResponse {
        $this->orgInvitationService->resendInvitation($invitation);

        return back()->with('success', 'Undangan berhasil dikirim ulang.');
    }

    public function destroy(OrganizationInvitation $invitation): RedirectResponse {
        $invitation->delete();

        return back()->with('success', 'Undangan organisasi telah dibatalkan.');
    }
}
