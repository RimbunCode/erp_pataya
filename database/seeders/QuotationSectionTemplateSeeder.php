<?php

namespace Database\Seeders;

use App\Models\CRM\QuotationSectionTemplate;
use Illuminate\Database\Seeder;

/**
 * Isi awal template blok teks Quotation, bunyinya persis dari tiga surat contoh
 * (.kiro/specs/quotation-letter-fields/referensi-surat.md). Idempoten: aman
 * dijalankan ulang karena memakai updateOrCreate berdasar `name`.
 */
class QuotationSectionTemplateSeeder extends Seeder {
    /**
     * @return array<int, array{name: string, quotation_type: string, title: string, order: int, content: string}>
     */
    private function getTemplates(): array {
        return [
            [
                'name'           => 'Terms & Conditions - Unit Baru',
                'quotation_type' => 'new_unit',
                'title'          => 'Terms & Conditions',
                'order'          => 1,
                'content'        => implode("\n", [
                    '1. Terms of payment: 20% down payment after contract signed before shipping, 80% balance payment paid at the time of handover the unit.',
                    '2. Warranty period: 24 months from B/L date or 4000 working hours whichever comes first.',
                    '3. Quotation Validity: 14 days from the quotation date.',
                ]),
            ],
            [
                'name'           => 'Note - Sewa',
                'quotation_type' => 'rental',
                'title'          => 'Note',
                'order'          => 1,
                'content'        => implode("\n", [
                    '- All price excluded: PPN 11%, Fuel, Mob-demob cost (if any)',
                    '- All price included: 2 operator',
                    '- Rental time minimum for 1 (one) month',
                ]),
            ],
            [
                'name'           => 'Term of Payment - Sewa',
                'quotation_type' => 'rental',
                'title'          => 'Term of Payment',
                'order'          => 2,
                'content'        => implode("\n", [
                    '1. Regularly monthly payment.',
                    '2. Mob and de mob cost (if any) should be paid in advance.',
                    '3. The rental fee for the next month will be billed one week before the current tenancy ends.',
                ]),
            ],
            [
                'name'           => 'Owner Obligation - Sewa',
                'quotation_type' => 'rental',
                'title'          => 'Owner Obligation',
                'order'          => 3,
                'content'        => implode("\n", [
                    '1. Regular maintenance (including Full Maintenance) is provided: sparepart, oil and technicians',
                    '2. Repair and maintenance of equipment in the depot.',
                    '3. Guarantee the operational maintenance including: hydraulic oil, machine dan transmission.',
                    '4. Provide 2 (two) trained and licensed operators.',
                ]),
            ],
            [
                'name'           => 'Tenant Obligation - Sewa',
                'quotation_type' => 'rental',
                'title'          => 'Tenant Obligation',
                'order'          => 4,
                'content'        => implode("\n", [
                    '1. Ensure the security for the equipment in the depot.',
                    '2. Provide fuel with minimum of HSD (High Speed Diesel)',
                    '3. Provide the workshop',
                    '4. Provide a designated space or room for service and spare part storage.',
                    '5. The tenant must obtain insurance for all container handling.',
                    '6. Grant access permission to the depot.',
                ]),
            ],
        ];
    }

    /**
     * Run the database seeds.
     */
    public function run(): void {
        foreach ($this->getTemplates() as $template) {
            QuotationSectionTemplate::updateOrCreate(
                ['name' => $template['name']],
                $template,
            );
        }
    }
}
