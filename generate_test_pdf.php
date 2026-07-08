<?php
use Barryvdh\DomPDF\Facade\Pdf;
use Milon\Barcode\Facades\DNS1DFacade;
use Milon\Barcode\Facades\DNS2DFacade;

$credentialId = 'INK-2026-TES-001';
$verifyUrl    = 'http://localhost/verify/' . $credentialId;

$inkindoLogo = resource_path('images/inkindo-logo.png');

$viewData = [
    'organizerName'       => 'INKINDO JATIM',
    'logoPath'            => $inkindoLogo,
    'partnerLogos'        => [],
    'studentName'         => 'Budi Santoso',
    'courseTitle'         => 'Manajemen Proyek Konstruksi Tingkat Lanjut',
    'period'              => '12 sesi (24 jam)',
    'finalScore'          => 90,
    'grade'               => 'A',
    'signatureImagePath'  => null,
    'signerName'          => 'Ir. Irwan Susilo, ST., MT., IPM.',
    'signerTitle'         => 'Ketua DPP INKINDO Jawa Timur',
    'signatureImagePath2' => null,
    'signerName2'         => 'Ir. R. Pius X Rooswan Happmono, ST., MT., IP.',
    'signerTitle2'        => 'Sekretaris DPP INKINDO Jawa Timur',
    'credentialId'        => $credentialId,
    'instructorName'      => 'Dr. Siti Rahayu',
    'materials'           => [
        'Pengantar Manajemen Proyek',
        'Perencanaan dan Penjadwalan Proyek',
        'Manajemen Risiko Konstruksi',
        'Studi Kasus Proyek Infrastruktur',
    ],
    'verifyUrl'           => $verifyUrl,
    'barcode1dBase64'     => DNS1DFacade::getBarcodePNG($credentialId, 'C128', 1, 25),
    'qrCodeBase64'        => DNS2DFacade::getBarcodePNG($verifyUrl, 'QRCODE', 4, 4),
];

$pdf    = Pdf::loadView('certificates.pdf', $viewData)->setPaper('a4', 'landscape');
$output = $pdf->output();

$outputPath = base_path('test_certificate.pdf');
file_put_contents($outputPath, $output);

$dompdf    = $pdf->getDomPDF();
$pageCount = $dompdf->getCanvas()->get_page_count();

echo "PDF generated: {$outputPath}\n";
echo "Size: " . filesize($outputPath) . " bytes\n";
echo "ACTUAL page count (from dompdf canvas): {$pageCount}\n";
