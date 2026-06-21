<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Http\Requests\Guest\CompleteOrganizationProfileRequest;
use App\Models\OrganizationInvitation;
use App\Services\Admin\OrganizationInvitationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
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

        if ($invitation->status->value !== 'invited') {
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
            $path = $request->file('logo')->store('organization-logos', 'public');
            $logoFileId = $path;
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
<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OrganizationCompletionController extends Controller
{
    //
}
