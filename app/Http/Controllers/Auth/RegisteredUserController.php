<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\User\Role;
use App\Models\User\User;
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
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'lowercase', 'email', 'max:255'],
            'password' => ['required', 'confirmed', Rules\Password::min(8)],
            'dob'      => ['required', 'date', 'before:today'],
            'role'     => ['required', 'string', 'exists:roles,name'],
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
                'username'  => $request->nickname,
                'email'     => $request->email,
                'password'  => Hash::make($request->password),
                'birthdate' => $request->dob,
                'status'    => FormStatus::ACTIVE,
            ]);
            $user = $findUser->refresh();
        } else {
            $user = User::create([
                'name'      => $request->name,
                'username'  => $request->nickname,
                'email'     => $request->email,
                'password'  => Hash::make($request->password),
                'birthdate' => $request->dob,
                'status'    => FormStatus::ACTIVE,
            ]);
        }

        $role = Role::where('name', $request->role)
            ->where('is_disabled', false)
            ->firstOrFail();

        DB::table('user_role')->insertOrIgnore([
            'user_id'    => $user->id,
            'role_id'    => $role->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::commit();

        event(new Registered($user));

        Auth::login($user);

        return redirect($this->redirectByRole($request->role));
    }

    private function redirectByRole(string $role): string {
        return match ($role) {
            'student'      => route('student.dashboard', absolute: false),
            'instructor'   => route('instructor.dashboard', absolute: false),
            'organization' => route('organization.dashboard', absolute: false),
            'admin'        => route('admin.dashboard', absolute: false),
            default        => '/guest',
        };
    }
}
