<?php

namespace App\Services\CRM;

use App\Models\CRM\Opportunity;

class OpportunityService {
    private function fillRelations(array $data): array {
        $data['lead_id']        = $data['lead']['id'] ?? null;
        $data['customer_id']    = $data['customer']['id'] ?? null;
        $data['assigned_to_id'] = $data['assigned_to']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Opportunity {
        return Opportunity::create($this->fillRelations($data));
    }

    public function update(Opportunity $opportunity, array $data): Opportunity {
        $opportunity->fillForUpdate($this->fillRelations($data));

        return $opportunity;
    }
}
