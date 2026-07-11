<?php

namespace Database\Seeders;

use App\Models\CRM\LeadSource;
use Illuminate\Database\Seeder;

class LeadSourceSeeder extends Seeder {
    private function getLeadSources() {
        return [
            ['code' => 'web_form', 'name' => 'Web Form'],
            ['code' => 'email', 'name' => 'Email'],
            ['code' => 'manual', 'name' => 'Manual'],
            ['code' => 'api', 'name' => 'API'],
            ['code' => 'referral', 'name' => 'Referral'],
            ['code' => 'call', 'name' => 'Call'],
        ];
    }

    /**
     * Run the database seeds.
     */
    public function run(): void {
        foreach ($this->getLeadSources() as $leadSource) {
            LeadSource::updateOrCreate(['code' => $leadSource['code']], $leadSource);
        }
    }
}
