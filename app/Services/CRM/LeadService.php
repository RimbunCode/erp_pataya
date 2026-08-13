<?php

namespace App\Services\CRM;

use App\Models\CRM\Lead;
use App\Models\CRM\LeadActivity;
use Symfony\Component\Uid\Ulid;

class LeadService {
    public function storeActivities(Lead $lead, array $activities): void {
        $activityIds = collect($activities)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingActivities = LeadActivity::query()
            ->where('lead_id', $lead->id)
            ->whereIn('id', $activityIds)
            ->get()
            ->keyBy('id');

        $keptIds = [];
        foreach ($activities as $activity) {
            $activity['lead_id']        = $lead->id;
            $activity['assigned_to_id'] = $activity['assigned_to']['id'] ?? null;

            if (isset($activity['id']) && Ulid::isValid($activity['id'])) {
                $existingActivities->get($activity['id'])?->update($activity);
                $keptIds[] = $activity['id'];
            } else {
                $keptIds[] = LeadActivity::create($activity)->id;
            }
        }

        LeadActivity::where('lead_id', $lead->id)
            ->whereNotIn('id', $keptIds)
            ->delete();
    }
}
