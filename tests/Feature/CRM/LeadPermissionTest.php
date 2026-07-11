<?php

namespace Tests\Feature\CRM;

use App\Models\CRM\Lead;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeadPermissionTest extends TestCase {
    use RefreshDatabase;

    private function sessionWithPermissions(array $permissions): array {
        return [
            'permissions'         => $permissions,
            'permissions_version' => '0|0|0|0',
        ];
    }

    private function fullLeadPermissions(): array {
        return [
            Lead::class => [
                0 => [
                    ['only_creator' => false, 'permissions' => ['create' => true, 'select' => true, 'read' => true, 'write' => true, 'delete' => true]],
                ],
            ],
        ];
    }

    public function test_user_without_lead_permission_cannot_create_lead(): void {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions([]))
            ->post('/leads', [
                'company_name' => 'PT Ditolak',
                'status'       => 'new',
            ]);

        $response->assertForbidden();
        $this->assertSame(0, Lead::count());
    }

    public function test_user_without_write_permission_cannot_update_lead(): void {
        $user = User::factory()->create();
        $lead = Lead::create(['company_name' => 'PT Awal', 'status' => 'new']);

        $readOnlyPermissions = [
            Lead::class => [
                0 => [
                    ['only_creator' => false, 'permissions' => ['create' => false, 'select' => true, 'read' => true, 'write' => false, 'delete' => false]],
                ],
            ],
        ];

        $response = $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions($readOnlyPermissions))
            ->put("/leads/{$lead->id}", [
                'company_name' => 'PT Diubah',
                'status'       => 'contacted',
            ]);

        $response->assertForbidden();
        $this->assertSame('PT Awal', $lead->refresh()->company_name);
    }

    public function test_user_without_write_permission_cannot_convert_lead(): void {
        $user = User::factory()->create();
        $lead = Lead::create(['company_name' => 'PT Calon Konversi', 'status' => 'qualified']);

        $readOnlyPermissions = [
            Lead::class => [
                0 => [
                    ['only_creator' => false, 'permissions' => ['create' => false, 'select' => true, 'read' => true, 'write' => false, 'delete' => false]],
                ],
            ],
        ];

        $response = $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions($readOnlyPermissions))
            ->put("/leads/{$lead->id}/convert");

        $response->assertForbidden();
        $this->assertNull($lead->refresh()->converted_customer_id);
    }

    public function test_user_with_write_permission_can_convert_lead(): void {
        $user = User::factory()->create();
        $lead = Lead::create(['company_name' => 'PT Boleh Konversi', 'status' => 'qualified']);

        $response = $this
            ->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions($this->fullLeadPermissions()))
            ->put("/leads/{$lead->id}/convert");

        $response->assertRedirect();
        $this->assertSame('converted', $lead->refresh()->status);
        $this->assertNotNull($lead->converted_customer_id);
    }
}
