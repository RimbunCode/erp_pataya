<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase {
    /**
     * A basic test example.
     */
    public function test_root_redirects_to_dashboard(): void {
        $response = $this->get('/');

        $response->assertRedirect(route('dashboard'));
    }

    public function test_dashboard_requires_authentication(): void {
        $response = $this->get(route('dashboard'));

        $response->assertRedirect(route('login'));
    }

    public function test_login_page_is_accessible(): void {
        $response = $this->get(route('login'));

        $response->assertRedirect();
    }
}
