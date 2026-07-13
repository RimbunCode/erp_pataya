<?php

namespace Tests\Feature\CRM;

use App\Models\CRM\LeadSource;
use Database\Seeders\LeadSourceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeadSourceSeederTest extends TestCase {
    use RefreshDatabase;

    public function test_seeder_creates_expected_starter_lead_sources(): void {
        (new LeadSourceSeeder)->run();

        $this->assertSame(6, LeadSource::count());
        $this->assertEqualsCanonicalizing(
            ['web_form', 'email', 'manual', 'api', 'referral', 'call'],
            LeadSource::pluck('code')->all(),
        );
    }

    public function test_seeder_is_idempotent_when_run_multiple_times(): void {
        (new LeadSourceSeeder)->run();
        (new LeadSourceSeeder)->run();

        $this->assertSame(6, LeadSource::count());
    }
}
