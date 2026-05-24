<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\User\User;
use App\Services\Auth\RoleResolver;
use App\Services\Auth\UserRoleManager;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller {
    public function __construct(
        private RoleResolver $roleResolver,
        private UserRoleManager $userRoleManager,
    ) {}

    /**
     * Display the registration view.
     */
    public function create(): Response {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse {
        $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'username'  => ['nullable', 'string', 'max:255', 'alpha_dash'],
            'email'     => ['required', 'string', 'lowercase', 'email', 'max:255'],
            'phone'     => ['nullable', 'string', 'max:20'],
            'password'  => ['required', 'confirmed', Rules\Password::min(8)],
            'gender'    => ['nullable', 'in:male,female'],
            'birthdate' => ['nullable', 'date', 'before:today'],
            'role'      => ['nullable', 'string'],
        ]);

        DB::beginTransaction();

        $findUser = User::where('email', $request->email)->first();

        if ($findUser) {
            if ($findUser->status != FormStatus::INVITED) {
                throw ValidationException::withMessages([
                    'email' => 'Email already exists',
                ]);
            }
            $findUser->update([
                'name'      => $request->name,
                'username'  => $request->username ?? null,
                'email'     => $request->email,
                'phone'     => $request->phone ?? null,
                'password'  => Hash::make($request->password),
                'gender'    => $request->gender ?? null,
                'birthdate' => $request->birthdate ?? null,
                'status'    => FormStatus::ACTIVE,
            ]);
            $user = $findUser->refresh();
        } else {
            $user = User::create([
                'name'      => $request->name,
                'username'  => $request->username ?? null,
                'email'     => $request->email,
                'phone'     => $request->phone ?? null,
                'password'  => Hash::make($request->password),
                'gender'    => $request->gender ?? null,
                'birthdate' => $request->birthdate ?? null,
                'status'    => FormStatus::ACTIVE,
            ]);
        }

        $wantsInstructor = $this->userRoleManager->resolveWantsInstructor(
            null,
            $request->string('role')->toString(),
        );

        $this->userRoleManager->applyPublicRegistrationRoles($user, $wantsInstructor);

        DB::commit();

        event(new Registered($user));

        Auth::login($user);

        $normalizedRoles = $this->roleResolver->normalizeRoles(
            $user->fresh('roles')->roles->pluck('name')->toArray(),
        );

        if (\count($normalizedRoles) > 1) {
            return redirect()->route('login.select-role');
        }

        return redirect($this->roleResolver->dashboardPath('student'));
    }
}