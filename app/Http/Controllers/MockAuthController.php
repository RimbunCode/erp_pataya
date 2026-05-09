<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MockAuthController extends Controller {
    // Data dummy per role
    private array $mockUsers = [
        'student' => [
            'id'       => '01MOCK000000000000STUDENT',
            'name'     => 'Budi Santoso',
            'nickname' => 'Budi',
            'email'    => 'student@inkindo.test',
            'role'     => 'student',
            'avatar'   => null,
        ], 'instructor' => [
            'id'       => '01MOCK0000000INSTRUCTOR1',
            'name'     => 'Dr. Siti Rahayu',
            'nickname' => 'Siti',
            'email'    => 'instructor@inkindo.test',
            'role'     => 'instructor',
            'avatar'   => null,
        ], 'organization' => [
            'id'       => '01MOCK000000ORGANIZATION',
            'name'     => 'PT. Maju Bersama',
            'nickname' => 'Maju Corp',
            'email'    => 'org@inkindo.test',
            'role'     => 'organization',
            'avatar'   => null,
        ], 'admin' => [
            'id'       => '01MOCK00000000000ADMIN01',
            'name'     => 'Administrator',
            'nickname' => 'Admin',
            'email'    => 'admin@inkindo.test',
            'role'     => 'admin',
            'avatar'   => null,
        ], 'multi' => [
            'id'       => '01MOCK000000000MULTIROLE',
            'name'     => 'Ahmad Faisal',
            'nickname' => 'Ahmad',
            'email'    => 'multi@inkindo.test',
            'roles'    => ['student', 'instructor'],
            'avatar'   => null,
        ],
    ];

    public function login(Request $request): RedirectResponse {
        $role = $request->input('role');

        if (! array_key_exists($role, $this->mockUsers)) {
            return back()->withErrors(['role' => 'Invalid role.']);
        }

        // Simpan mock user ke session
        $request->session()->put('mock_user', $this->mockUsers[$role]);
        $request->session()->put('mock_auth', true);

        return redirect()->route("{$role}.dashboard");
    }

    public function logout(Request $request): RedirectResponse {
        $request->session()->forget(['mock_user', 'mock_auth']);

        return redirect('/guest');
    }
}
