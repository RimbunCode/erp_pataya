<?php

namespace App\Http\Controllers\Guest;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Guest\CompleteOrganizationProfileRequest;
use App\Models\Core\File;
use App\Models\OrganizationInvitation;
use App\Services\Admin\OrganizationInvitationService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationCompletionController extends Controller {
    public function __construct(
        private OrganizationInvitationService $orgInvitationService,
    ) {}

    public function show(string $token): Response {
        $invitation = OrganizationInvitation::where('token', $token)->firstOrFail();

        if ($invitation->isExpired()) {
            return Inertia::render('Guest/OrganizationComplete', [
                'invitation' => $this->transformInvitation($invitation),
                'expired'    => true,
            ]);
        }

        if ($invitation->status !== FormStatus::INVITED) {
            return Inertia::render('Guest/OrganizationComplete', [
                'invitation'  => $this->transformInvitation($invitation),
                'alreadyDone' => true,
            ]);
        }

        return Inertia::render('Guest/OrganizationComplete', [
            'invitation' => $this->transformInvitation($invitation),
        ]);
    }

    public function store(CompleteOrganizationProfileRequest $request, string $token): RedirectResponse {
        $invitation = OrganizationInvitation::where('token', $token)->firstOrFail();
        $validated  = $request->validated();

        $logoFileId = null;
        if ($request->hasFile('logo')) {
            $uploaded   = $request->file('logo');
            $path       = $uploaded->store('organization-logos', 'public');
            $fileRecord = File::create([
                'name'      => pathinfo((string) $uploaded->getClientOriginalName(), PATHINFO_FILENAME),
                'path'      => $path,
                'extension' => $uploaded->getClientOriginalExtension(),
                'mime_type' => $uploaded->getMimeType(),
                'is_public' => true,
                'user_id'   => null,
            ]);
            $logoFileId = $fileRecord->id;
        }

        $data = array_merge($validated, [
            'logo_file_id' => $logoFileId,
        ]);

        $this->orgInvitationService->completeProfile($invitation, $data);

        return redirect()->route('organization.success');
    }

    public function success(): Response {
        return Inertia::render('Guest/OrganizationCompleteSuccess');
    }

    /**
     * @return array<string, mixed>
     */
    private function transformInvitation(OrganizationInvitation $invitation): array {
        return [
            'organizationName' => $invitation->organization_name,
            'email'            => $invitation->email,
            'contactPerson'    => $invitation->contact_person,
            'status'           => $invitation->status->value,
        ];
    }
}
