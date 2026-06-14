<?php

namespace Tests\Unit\Core;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use Tests\TestCase;

class BranchAddressFormattingTest extends TestCase {
    public function test_shipping_address_uses_indonesian_order(): void {
        $branch = new Branch([
            'shipping_street'   => 'Jl. Sudirman No. 10',
            'shipping_city'     => 'Jakarta Selatan',
            'shipping_state'    => 'DKI Jakarta',
            'shipping_zip_code' => '12190',
        ]);

        $branch->setRelation('shippingCountry', new Country(['name' => 'Indonesia']));

        $this->assertSame(
            'Jl. Sudirman No. 10, Jakarta Selatan, DKI Jakarta, 12190, Indonesia',
            $branch->shippingAddress,
        );
    }

    public function test_billing_address_uses_indonesian_order(): void {
        $branch = new Branch([
            'billing_street'   => 'Jl. Asia Afrika No. 8',
            'billing_city'     => 'Bandung',
            'billing_state'    => 'Jawa Barat',
            'billing_zip_code' => '40111',
        ]);

        $branch->setRelation('billingCountry', new Country(['name' => 'Indonesia']));

        $this->assertSame(
            'Jl. Asia Afrika No. 8, Bandung, Jawa Barat, 40111, Indonesia',
            $branch->billingAddress,
        );
    }

    public function test_address_omits_empty_segments_without_trailing_separator(): void {
        $branch = new Branch([
            'shipping_street'   => 'Jl. Imam Bonjol No. 5',
            'shipping_city'     => null,
            'shipping_state'    => 'Riau',
            'shipping_zip_code' => '',
        ]);

        $branch->setRelation('shippingCountry', new Country(['name' => 'Indonesia']));

        $this->assertSame(
            'Jl. Imam Bonjol No. 5, Riau, Indonesia',
            $branch->shippingAddress,
        );
    }
}
