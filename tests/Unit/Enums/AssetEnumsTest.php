<?php

namespace Tests\Unit\Enums;

use App\Enums\AssetOwnershipType;
use App\Enums\AssetType;
use App\Enums\FormStatus;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetEnumsTest extends TestCase {
    #[Test]
    public function asset_type_has_three_cases(): void {
        $cases = AssetType::cases();

        $this->assertCount(3, $cases);
        $values = array_map(fn ($c) => $c->value, $cases);
        $this->assertContains('existing_asset', $values);
        $this->assertContains('composite_asset', $values);
        $this->assertContains('composite_component', $values);
    }

    #[Test]
    public function asset_type_label_does_not_throw(): void {
        foreach (AssetType::cases() as $case) {
            $label = $case->label();
            $this->assertIsString($label);
            $this->assertNotEmpty($label);
        }
    }

    #[Test]
    public function asset_type_can_be_instantiated_from_value(): void {
        $this->assertSame(AssetType::EXISTING_ASSET, AssetType::from('existing_asset'));
        $this->assertSame(AssetType::COMPOSITE_ASSET, AssetType::from('composite_asset'));
        $this->assertSame(AssetType::COMPOSITE_COMPONENT, AssetType::from('composite_component'));
    }

    #[Test]
    public function asset_ownership_type_has_three_cases(): void {
        $cases = AssetOwnershipType::cases();

        $this->assertCount(3, $cases);
        $values = array_map(fn ($c) => $c->value, $cases);
        $this->assertContains('company', $values);
        $this->assertContains('supplier', $values);
        $this->assertContains('customer', $values);
    }

    #[Test]
    public function asset_ownership_type_label_does_not_throw(): void {
        foreach (AssetOwnershipType::cases() as $case) {
            $label = $case->label();
            $this->assertIsString($label);
            $this->assertNotEmpty($label);
        }
    }

    #[Test]
    public function asset_ownership_type_can_be_instantiated_from_value(): void {
        $this->assertSame(AssetOwnershipType::COMPANY, AssetOwnershipType::from('company'));
        $this->assertSame(AssetOwnershipType::SUPPLIER, AssetOwnershipType::from('supplier'));
        $this->assertSame(AssetOwnershipType::CUSTOMER, AssetOwnershipType::from('customer'));
    }

    #[Test]
    public function form_status_has_new_asset_cases(): void {
        $cases  = FormStatus::cases();
        $values = array_map(fn ($c) => $c->value, $cases);

        $expected = [
            'scrapped',
            'sold',
            'out_of_order',
            'in_maintenance',
            'issued',
            'partially_depreciated',
            'fully_depreciated',
            'capitalized',
            'work_in_progress',
        ];

        foreach ($expected as $value) {
            $this->assertContains($value, $values, "FormStatus must contain case: {$value}");
        }
    }

    #[Test]
    public function new_form_status_cases_label_does_not_throw(): void {
        $newCases = [
            FormStatus::SCRAPPED,
            FormStatus::SOLD,
            FormStatus::OUT_OF_ORDER,
            FormStatus::IN_MAINTENANCE,
            FormStatus::ISSUED,
            FormStatus::PARTIALLY_DEPRECIATED,
            FormStatus::FULLY_DEPRECIATED,
            FormStatus::CAPITALIZED,
            FormStatus::WORK_IN_PROGRESS,
        ];

        foreach ($newCases as $case) {
            $label = $case->label();
            $this->assertIsString($label);
            $this->assertNotEmpty($label);
        }
    }
}
