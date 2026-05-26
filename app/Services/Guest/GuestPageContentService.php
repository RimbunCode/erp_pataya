<?php

namespace App\Services\Guest;

use App\Models\Core\Preference;
use Illuminate\Support\Facades\Schema;

class GuestPageContentService {
    public const PREFERENCE_KEY = 'guest_page_content_v1';

    private ?bool $hasPreferencesTable = null;

    /**
     * @return array<string, mixed>
     */
    public function resolve(): array {
        $defaultContent = $this->defaultContent();

        if (! $this->hasPreferencesTable()) {
            return $defaultContent;
        }

        $storedContent = Preference::query()->find(self::PREFERENCE_KEY)?->value;

        return $this->sanitizeValue($storedContent, $defaultContent);
    }

    /**
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    public function store(array $content): array {
        $defaultContent    = $this->defaultContent();
        $normalizedContent = $this->sanitizeValue($content, $defaultContent);

        if (! $this->hasPreferencesTable()) {
            return $normalizedContent;
        }

        Preference::query()->updateOrCreate(
            ['key' => self::PREFERENCE_KEY],
            ['value' => $normalizedContent],
        );

        return $normalizedContent;
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultContent(): array {
        return [
            'home' => [
                'hero' => [
                    'badge'              => $this->doc('NEW: BIM CERTIFICATION 2024'),
                    'title'              => $this->doc('ENGINEER YOUR DIGITAL FUTURE'),
                    'description'        => $this->doc('The official Learning Management System of INKINDO. Advanced training, professional certifications, and a community of experts.'),
                    'primaryCtaLabel'    => $this->doc('START LEARNING'),
                    'secondaryCtaLabel'  => $this->doc('HOW IT WORKS'),
                    'statsLabel'         => $this->doc('12K+ CERTIFIED MEMBERS'),
                    'topCardTitle'       => $this->doc('INDUSTRY READY'),
                    'topCardSubtitle'    => $this->doc('GLOBAL STANDARDS'),
                    'bottomCardTitle'    => $this->doc('ISO CERTIFIED LMS'),
                    'bottomCardSubtitle' => $this->doc('VERIFIED PROGRAM'),
                ],
                'trusted' => [
                    'heading'   => $this->doc('TRUSTED BY INDUSTRY LEADERS'),
                    'companies' => [
                        $this->doc('WIKA'),
                        $this->doc('ADHI KARYA'),
                        $this->doc('PP (PERSERO)'),
                        $this->doc('HUTAMA KARYA'),
                        $this->doc('WASZKITA'),
                    ],
                ],
                'popular' => [
                    'heading'     => $this->doc('POPULAR TRAINING PROGRAMS'),
                    'description' => $this->doc('Explore industry-ready courses designed by certified professionals'),
                ],
                'why' => [
                    'heading'     => $this->doc('WHY INKINDO LEARNING?'),
                    'description' => $this->doc('We provide more than just courses. We provide a bridge to professional excellence.'),
                    'features'    => [
                        [
                            'title'       => $this->doc('OFFICIAL CERTIFICATION'),
                            'description' => $this->doc('Earn credentials that are recognized by major construction companies and regulatory bodies in Indonesia.'),
                            'linkLabel'   => $this->doc('LEARN MORE'),
                        ],
                        [
                            'title'       => $this->doc('EXPERT INSTRUCTORS'),
                            'description' => $this->doc('Learn directly from industry veterans and certified BIM managers who are active in national projects.'),
                            'linkLabel'   => $this->doc('LEARN MORE'),
                        ],
                        [
                            'title'       => $this->doc('HYBRID EXPERIENCE'),
                            'description' => $this->doc('Flexible learning paths combining online modules with hands-on workshops and site visits.'),
                            'linkLabel'   => $this->doc('LEARN MORE'),
                        ],
                    ],
                ],
                'ctaBanner' => [
                    'heading'      => $this->doc('READY TO START YOUR JOURNEY?'),
                    'description'  => $this->doc('Join over 12,000 engineers who have leveled up their careers through our platform.'),
                    'primaryCta'   => $this->doc('GET STARTED NOW'),
                    'secondaryCta' => $this->doc('CONTACT US'),
                ],
            ],
            'about' => [
                'hero' => [
                    'title'       => $this->doc('Empowering Engineers Since 1970'),
                    'description' => $this->doc('INKINDO (Ikatan Nasional Konsultan Indonesia) Learning Center is a hub for engineering excellence and professional development in Indonesia.'),
                ],
                'stats' => [
                    [
                        'value' => $this->doc('54+'),
                        'label' => $this->doc('Years of Excellence'),
                    ],
                    [
                        'value' => $this->doc('12K+'),
                        'label' => $this->doc('Certified Professionals'),
                    ],
                    [
                        'value' => $this->doc('450+'),
                        'label' => $this->doc('Expert Instructors'),
                    ],
                    [
                        'value' => $this->doc('34'),
                        'label' => $this->doc('Regional Chapters'),
                    ],
                ],
                'vision' => [
                    'title'       => $this->doc('Our Vision'),
                    'description' => $this->doc('Menjunjung tinggi kehormatan, kemuliaan dan nama baik profesi konsultan dalam hubungan kerja dengan pemberi tugas, sesama rekan konsultan dan masyarakat.'),
                ],
                'mission' => [
                    'title' => $this->doc('Our Mission'),
                    'items' => [
                        $this->doc('Inkindo Jatim sebagai learning organisation yang dinamis dan adaptif terhadap perubahan peradaban.'),
                        $this->doc('Inkindo Jatim sebagai wadah komunikasi anggota dan salah satu pusat environment jasa konstruksi khususnya di Jawa Timur.'),
                        $this->doc('Penegakan norma, etika dan aturan organisasi.'),
                        $this->doc('Menjunjung dan menjaga marwah organisasi.'),
                        $this->doc('Mendorong dan menjaga iklim usaha jasa konsultan yang kondusif.'),
                        $this->doc('Mendorong inovasi yang bermanfaat bagi masyarakat, berwawasan lingkungan serta berkelanjutan.'),
                        $this->doc('Mendorong anggota dalam adaptasi terhadap perubahan peradaban melalui transformasi digital.'),
                        $this->doc('Mitra strategis bagi pemerintah, dunia usaha atau mitra kerja, dunia akademik serta masyarakat.'),
                    ],
                ],
            ],
            'verify' => [
                'title'       => $this->doc('CERTIFICATE VERIFICATION'),
                'description' => $this->doc('Verify the authenticity of professional certifications issued by the INKINDO Learning Center.'),
                'fieldLabel'  => $this->doc('Certificate ID Number'),
                'placeholder' => $this->doc('e.g., INK-2024-001'),
                'buttonLabel' => $this->doc('VERIFY NOW'),
                'securityTip' => $this->doc('Security Tip: Always check if the certificate ID matches the one printed on the physical document.'),
            ],
            'contact' => [
                'hero' => [
                    'title'       => $this->doc('Get In Touch'),
                    'description' => $this->doc('Have questions about our certification programs or institutional partnerships? Our team is here to help.'),
                ],
                'contactItems' => [
                    [
                        'label' => $this->doc('OFFICE ADDRESS'),
                        'value' => $this->doc("Jl. Bendungan Hilir No.29,\nJakarta Pusat, DKI Jakarta 10210"),
                    ],
                    [
                        'label' => $this->doc('PHONE NUMBER'),
                        'value' => $this->doc('+62 (21) 573-8603'),
                    ],
                    [
                        'label' => $this->doc('EMAIL ADDRESS'),
                        'value' => $this->doc('info@inkindo-learning.com'),
                    ],
                ],
                'support' => [
                    'label'       => $this->doc('Global Support'),
                    'description' => $this->doc('Available Monday to Friday, 08:00 AM - 05:00 PM WIB'),
                ],
                'form' => [
                    'fullNameLabel'       => $this->doc('Full Name'),
                    'fullNamePlaceholder' => $this->doc('John Doe'),
                    'emailLabel'          => $this->doc('Email Address'),
                    'emailPlaceholder'    => $this->doc('john@example.com'),
                    'subjectLabel'        => $this->doc('Subject'),
                    'subjectPlaceholder'  => $this->doc('Inquiry about BIM Certification'),
                    'messageLabel'        => $this->doc('Message'),
                    'messagePlaceholder'  => $this->doc('Tell us more about your needs...'),
                    'submitLabel'         => $this->doc('SEND MESSAGE'),
                ],
            ],
            'footer' => [
                'brand' => [
                    'title'       => $this->doc('INKINDO'),
                    'subtitle'    => $this->doc('Learning Center'),
                    'description' => $this->doc('Leading the digital transformation of professional training and certification for engineering and construction industries in Indonesia.'),
                ],
                'explore' => [
                    'title' => $this->doc('EXPLORE'),
                    'links' => [
                        $this->doc('BROWSE TRAININGS'),
                        $this->doc('CERTIFICATION PATH'),
                        $this->doc('OUR INSTRUCTORS'),
                        $this->doc('AFFILIATE PROGRAM'),
                    ],
                ],
                'company' => [
                    'title' => $this->doc('COMPANY'),
                    'links' => [
                        $this->doc('ABOUT INKINDO'),
                        $this->doc('CAREER OPPORTUNITIES'),
                        $this->doc('PRIVACY POLICY'),
                        $this->doc('TERMS OF SERVICE'),
                    ],
                ],
                'contact' => [
                    'title'   => $this->doc('CONTACT US'),
                    'address' => $this->doc('Jl. Bendungan Hilir No.29, Jakarta Pusat, DKI Jakarta 10210'),
                    'phone'   => $this->doc('+62 (21) 573-8603'),
                    'email'   => $this->doc('info@inkindo-learning.com'),
                ],
                'bottom' => [
                    'copyright'  => $this->doc('© 2024 INKINDO LEARNING CENTER. ALL RIGHTS RESERVED.'),
                    'helpCenter' => $this->doc('HELP CENTER'),
                    'sitemap'    => $this->doc('SITEMAP'),
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function doc(string $text): array {
        $lines = preg_split('/\r\n|\r|\n/', trim($text));

        if (! is_array($lines) || count($lines) === 0) {
            return [
                'type'    => 'doc',
                'content' => [['type' => 'paragraph']],
            ];
        }

        $content = [];

        foreach ($lines as $line) {
            $line = (string) $line;

            if (trim($line) === '') {
                $content[] = ['type' => 'paragraph'];

                continue;
            }

            $content[] = [
                'type'    => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => $line,
                    ],
                ],
            ];
        }

        return [
            'type'    => 'doc',
            'content' => $content,
        ];
    }

    private function sanitizeValue(mixed $value, mixed $default): mixed {
        if ($this->isTipTapDoc($default)) {
            if ($this->isTipTapDoc($value)) {
                return $value;
            }

            if (is_string($value)) {
                return $this->doc($value);
            }

            return $default;
        }

        if (! is_array($default)) {
            return is_scalar($value) ? $value : $default;
        }

        if (! is_array($value)) {
            $value = [];
        }

        if ($this->isList($default)) {
            $result = [];
            foreach ($default as $index => $defaultItem) {
                $result[] = $this->sanitizeValue($value[$index] ?? null, $defaultItem);
            }

            return $result;
        }

        $result = [];
        foreach ($default as $key => $defaultItem) {
            $result[$key] = $this->sanitizeValue($value[$key] ?? null, $defaultItem);
        }

        return $result;
    }

    private function isTipTapDoc(mixed $value): bool {
        return is_array($value)
            && ($value['type'] ?? null) === 'doc'
            && array_key_exists('content', $value)
            && is_array($value['content']);
    }

    /**
     * @param  array<int|string, mixed>  $value
     */
    private function isList(array $value): bool {
        if ($value === []) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    private function hasPreferencesTable(): bool {
        if ($this->hasPreferencesTable !== null) {
            return $this->hasPreferencesTable;
        }

        $this->hasPreferencesTable = Schema::hasTable('preferences');

        return $this->hasPreferencesTable;
    }
}

