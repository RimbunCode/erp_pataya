<?php

namespace Tests\Feature\CRM;

use App\Enums\FormStatus;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalScheme;
use App\Models\CRM\Quotation;
use App\Models\User\Permission;
use App\Models\User\User;

class QuotationApprovalFlowTest extends QuotationTestCase {
    public function test_submit_marks_quotation_as_submitted_when_no_approval_scheme_is_active(): void {
        $quotation = $this->storeQuotation();

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->put(route('quotations.submit', $quotation))
            ->assertRedirect();

        $quotation->refresh();

        $this->assertContains(FormStatus::SUBMITTED, $quotation->status);
        $this->assertNotContains(FormStatus::DRAFT, $quotation->status);
        $this->assertNotNull($quotation->submitted_at);
    }

    public function test_submit_marks_auto_approved_quotation_as_submitted(): void {
        $scheme = $this->createApprovalScheme('Quotation Auto Approval');
        $scheme->steps()->create([
            'sequence'          => 0,
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $this->user->id,
        ]);
        $quotation = $this->storeQuotation();

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->put(route('quotations.submit', $quotation))
            ->assertRedirect();

        $quotation->refresh();
        $approval = ApprovalInstance::query()
            ->where('document_type', Quotation::class)
            ->where('document_id', $quotation->id)
            ->firstOrFail();

        $this->assertSame(FormStatus::APPROVED, $approval->status);
        $this->assertContains(FormStatus::SUBMITTED, $quotation->status);
        $this->assertNotContains(FormStatus::DRAFT, $quotation->status);
        $this->assertNotNull($quotation->submitted_at);
    }

    public function test_final_manual_approval_marks_quotation_as_submitted(): void {
        $approver = User::factory()->create();
        $scheme   = $this->createApprovalScheme('Quotation Manual Approval');
        $scheme->steps()->create([
            'sequence'          => 0,
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $approver->id,
        ]);
        $quotation = $this->storeQuotation();

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->put(route('quotations.submit', $quotation))
            ->assertRedirect();

        $approval = ApprovalInstance::query()
            ->where('document_type', Quotation::class)
            ->where('document_id', $quotation->id)
            ->firstOrFail();

        $this->assertSame(FormStatus::PENDING, $approval->status);
        $this->assertContains(FormStatus::NEED_APPROVAL, $quotation->fresh()->status);

        $this->actingAs($approver)
            ->post(route('approvalInstances.decision', $approval->steps()->firstOrFail()), [
                'decision' => 'approve',
            ])
            ->assertOk();

        $quotation->refresh();

        $this->assertSame(FormStatus::APPROVED, $approval->fresh()->status);
        $this->assertContains(FormStatus::SUBMITTED, $quotation->status);
        $this->assertNotContains(FormStatus::NEED_APPROVAL, $quotation->status);
        $this->assertNotNull($quotation->submitted_at);
    }

    public function test_final_manual_rejection_marks_quotation_as_rejected(): void {
        $approver = User::factory()->create();
        $scheme   = $this->createApprovalScheme('Quotation Manual Rejection');
        $scheme->steps()->create([
            'sequence'          => 0,
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $approver->id,
        ]);
        $quotation = $this->storeQuotation();

        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->put(route('quotations.submit', $quotation))
            ->assertRedirect();

        $approval = ApprovalInstance::query()
            ->where('document_type', Quotation::class)
            ->where('document_id', $quotation->id)
            ->firstOrFail();

        $this->actingAs($approver)
            ->post(route('approvalInstances.decision', $approval->steps()->firstOrFail()), [
                'decision' => 'reject',
            ])
            ->assertOk();

        $quotation->refresh();

        $this->assertSame(FormStatus::REJECTED, $approval->fresh()->status);
        $this->assertContains(FormStatus::REJECTED, $quotation->status);
        $this->assertNotContains(FormStatus::NEED_APPROVAL, $quotation->status);
        $this->assertNotNull($quotation->submitted_at);
    }

    private function createApprovalScheme(string $name): ApprovalScheme {
        $permission = Permission::query()
            ->where('model', Quotation::class)
            ->firstOrFail();

        return ApprovalScheme::create([
            'name'          => $name,
            'permission_id' => $permission->id,
            'name_model'    => 'Quotation',
            'model'         => Quotation::class,
            'is_active'     => true,
            'trigger_on'    => 'submit',
        ]);
    }
}
