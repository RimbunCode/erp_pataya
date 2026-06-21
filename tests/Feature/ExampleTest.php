<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase {
    public function test_root_is_accessible(): void {
        $response = $this->get('/');

        $response->assertOk();
    }

    public function test_login_page_is_accessible(): void {
        $response = $this->get(route('login'));

        $response->assertOk();
    }

    public function test_student_dashboard_requires_authentication(): void {
        $response = $this->get(route('student.dashboard'));

        $response->assertRedirect(route('guest.home'));
    }
}
