<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\UserRequest;
use App\Models\User\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class SetupUserController extends Controller {
    public function __construct(Request $request) {
        $this->ignorePermission = true;
        parent::__construct($request);
    }

    public function show(Request $request) {
        $userRequest = $request->user();

        $hasPassword = $userRequest->password != null;

        return Inertia::render('Auth/SetupUser', [
            'user'        => $userRequest,
            'hasPassword' => $hasPassword,
        ]);
    }

    public function update(UserRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $user = $request->user();

        $data['password'] = isset($data['password']) ? Hash::make($data['password']) : $user->password;

        $hasPassword    = $data['password'] != null;
        $data['status'] = $user->method == FormStatus::PRE_REGISTERED && $hasPassword ? FormStatus::ACTIVE : $user->status;
        $user->fillForUpdate($data);
        $user->logForUpdated();
        DB::commit();

        return back();
    }
}
