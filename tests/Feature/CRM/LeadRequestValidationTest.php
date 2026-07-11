<?php

namespace Tests\Feature\CRM;

use App\Models\CRM\Lead;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadRequestValidationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Kolom is_example ditambah via initPermissions() di prod (bukan migration).
        // Tambahkan manual agar global scope HasExampleData tidak error di SQLite.
        // roles/users/branches ikut kena karena AppMiddleware & _checkPermission() query relasi ini.
        foreach (['leads', 'roles', 'users', 'branches'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function leadPermissions(): array {
        return [
            Lead::class => [
                0 => [
                    ['only_creator' => false, 'permissions' => ['create' => true, 'select' => true, 'read' => true, 'write' => true, 'delete' => true]],
                ],
            ],
        ];
    }

    private function sessionWithLeadPermissions(): array {
        return [
            'permissions'         => $this->leadPermissions(),
            'permissions_version' => '0|0|0|0',
        ];
    }

    public function test_lead_cannot_be_created_without_company_name(): void {
        $user = User::factory()->create();

        $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithLeadPermissions())
            ->post('/leads', [
                'status' => 'new',
            ]);

        $this->assertSame(0, Lead::count());
    }

    public function test_lead_is_created_with_default_status_new(): void {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithLeadPermissions())
            ->post('/leads', [
                'company_name' => 'PT Contoh Sejahtera',
                'status'       => 'new',
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertSame(1, Lead::count());
        $this->assertSame('new', Lead::first()->status);
        $this->assertSame('PT Contoh Sejahtera', Lead::first()->company_name);
    }
}
