<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SetupUserRequest;
use App\Services\Auth\UserRoleManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class SetupUserController extends Controller {
    public function __construct(
        Request $request,
        private UserRoleManager $userRoleManager,
    ) {
        $this->ignorePermission = true;
        parent::__construct($request);
    }

    public function show(Request $request) {
        $userRequest = $request->user();
        if ($userRequest->status == FormStatus::ACTIVE) {
            return redirect()->route('dashboard');
        }

        $hasPassword = $userRequest->password != null;
        $isWaiting   = $userRequest->status == FormStatus::PRE_REGISTERED && ($hasPassword);

        return Inertia::render('Auth/SetupUser', [
            'user'        => $userRequest,
            'hasPassword' => $hasPassword,
            'isWaiting'   => $isWaiting,
        ]);
    }

    public function update(SetupUserRequest $request) {
        $data            = $request->validated();
        $wantsInstructor = $request->boolean('wants_instructor');
        $currentPassword = $data['current_password'] ?? null;
        unset($data['wants_instructor']);
        unset($data['current_password']);

        DB::beginTransaction();
        $user        = $request->user();
        $hasPassword = $user->password != null;

        $hasBranch = $user->branches()->exists();

        $data['password'] = isset($data['password']) && ($currentPassword || ! $hasPassword)
            ? Hash::make($data['password']) : $user->password;

        $hasPassword    = $data['password'] != null;
        $data['status'] = $user->status == FormStatus::INVITED && $hasPassword && $hasBranch ? FormStatus::ACTIVE : $user->status;
        $user->fillForUpdate($data);
        $user->logForUpdated();

        $this->userRoleManager->ensureStudentRole($user);
        if ($wantsInstructor) {
            $this->userRoleManager->attachInstructorRole($user);
        }

        DB::commit();

        return back();
    }
}
