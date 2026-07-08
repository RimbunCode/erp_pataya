@php
    $certificateBgBase64 = base64_encode(file_get_contents(resource_path('images/certificate-bg.png')));
@endphp
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: a4 landscape;
            margin: 0;
        }

        html,
        body {
            height: 100%;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
        }

        .page {
            display: table;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            background-image: url('data:image/png;base64,{{ $certificateBgBase64 }}');
            background-repeat: no-repeat;
            background-position: center;
            background-size: cover;
        }

        .page+.page {
            page-break-before: always;
        }

        .page-inner {
            display: table-cell;
            vertical-align: middle;
            text-align: center;
            padding: 20mm 28mm;
            box-sizing: border-box;
        }

        /* Front page */
        .header-zone {
            text-align: center;
        }

        .partner-logos {
            margin-bottom: 5mm;
        }

        .partner-logos img {
            max-height: 14mm;
            margin: 0 3mm;
            vertical-align: middle;
        }

        .logo {
            max-height: 20mm;
            margin-bottom: 4mm;
        }

        .organizer {
            font-size: 16px;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 3mm;
        }

        .title {
            font-size: 36px;
            font-weight: bold;
        }

        .body-zone {
            text-align: center;
            margin-top: 7mm;
        }

        .student-name {
            font-size: 28px;
            font-weight: bold;
            margin: 6mm 0;
            text-decoration: underline;
        }

        .course-title {
            font-size: 20px;
            margin-bottom: 3mm;
        }

        .period {
            font-size: 16px;
            color: #444;
            margin-bottom: 3mm;
        }

        .score-block {
            font-size: 16px;
            margin: 3mm 0;
        }

        .signature-row {
            display: table;
            width: 70%;
            margin: 18mm auto 0;
            table-layout: fixed;
        }

        .signature-col {
            display: table-cell;
            width: 50%;
            text-align: center;
            vertical-align: bottom;
        }

        .signer-group {}

        .signature-space {
            height: 20mm;
        }

        .signature-image {
            max-height: 20mm;
        }

        .signer-name {
            font-weight: bold;
            font-size: 16px;
            margin-top: 3mm;
        }

        .signer-title {
            font-size: 13px;
            color: #444;
        }

        /* Footer corners: siblings of .page, fixed to bottom of each page */
        .corner-left {
            position: fixed;
            left: 22mm;
            bottom: 16mm;
            text-align: left;
        }

        .corner-right {
            position: fixed;
            right: 22mm;
            bottom: 16mm;
            text-align: right;
        }

        .barcode-1d {
            max-width: 34mm;
            max-height: 8mm;
        }

        .credential-id {
            font-size: 8px;
            color: #333;
            margin-top: 1mm;
        }

        .qr-code {
            max-width: 16mm;
            max-height: 16mm;
        }

        /* Back page */
        .back-content {
            text-align: left;
            width: 100%;
        }

        .back-title {
            font-size: 26px;
            font-weight: bold;
            margin-bottom: 6mm;
            text-align: center;
        }

        .back-meta {
            display: table;
            font-size: 16px;
            margin-bottom: 7mm;
        }

        .back-meta-row {
            display: table-row;
        }

        .back-meta-label {
            display: table-cell;
            font-weight: bold;
            padding-right: 5mm;
            padding-bottom: 2.5mm;
            white-space: nowrap;
        }

        .back-meta-value {
            display: table-cell;
            padding-bottom: 2.5mm;
        }

        .materials {
            font-size: 16px;
        }

        .materials ol {
            padding-left: 6mm;
            margin: 0;
        }

        .materials li {
            margin-bottom: 2.5mm;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="page-inner">
            <div class="header-zone">
                @if($logoPath || ! empty($partnerLogos))
                    <div class="partner-logos">
                        @if($logoPath)
                            <img src="{{ $logoPath }}" class="logo">
                        @endif
                        @if(! empty($partnerLogos))
                            @foreach($partnerLogos as $partnerLogo)
                                <img src="{{ $partnerLogo }}">
                            @endforeach
                        @endif
                    </div>
                @endif
                <div class="organizer">{{ $organizerName }}</div>
                <div class="title">SERTIFIKAT</div>
            </div>

            <div class="body-zone">
                <div>diberikan kepada</div>
                <div class="student-name">{{ $studentName }}</div>
                <div>atas partisipasinya dalam pelatihan</div>
                <div class="course-title">{{ $courseTitle }}</div>
                <div class="period">{{ $period }}</div>

                <div class="signature-row">
                    <div class="signature-col">
                        @if($signatureImagePath)
                            <img src="{{ $signatureImagePath }}" class="signature-image">
                        @else
                            <div class="signature-space"></div>
                        @endif
                        <div class="signer-group">
                            <div class="signer-name">{{ $signerName }}</div>
                            <div class="signer-title">{{ $signerTitle }}</div>
                        </div>
                    </div>
                    <div class="signature-col">
                        @if($signatureImagePath2)
                            <img src="{{ $signatureImagePath2 }}" class="signature-image">
                        @else
                            <div class="signature-space"></div>
                        @endif
                        <div class="signer-group">
                            <div class="signer-name">{{ $signerName2 }}</div>
                            <div class="signer-title">{{ $signerTitle2 }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="page">
        <div class="page-inner">
            <div class="back-content">
                <div class="back-title">Rincian Pelatihan</div>
                <div class="back-meta">
                    <div class="back-meta-row">
                        <div class="back-meta-label">Judul Pelatihan</div>
                        <div class="back-meta-value">: {{ $courseTitle }}</div>
                    </div>
                    <div class="back-meta-row">
                        <div class="back-meta-label">Periode</div>
                        <div class="back-meta-value">: {{ $period }}</div>
                    </div>
                    <div class="back-meta-row">
                        <div class="back-meta-label">Instruktur</div>
                        <div class="back-meta-value">: {{ $instructorName }}</div>
                    </div>
                    <div class="back-meta-row">
                        <div class="back-meta-label">No. Sertifikat</div>
                        <div class="back-meta-value">: {{ $credentialId }}</div>
                    </div>
                </div>

                <div class="materials">
                    <strong>Daftar Materi:</strong>
                    <ol>
                        @foreach($materials as $material)
                            <li>{{ $material }}</li>
                        @endforeach
                    </ol>
                </div>
            </div>
        </div>
    </div>

    <div class="corner-left">
        @if($barcode1dBase64)
            <img src="data:image/png;base64,{{ $barcode1dBase64 }}" class="barcode-1d">
        @endif
        <div class="credential-id">No. Sertifikat: {{ $credentialId }}</div>
    </div>

    <div class="corner-right">
        @if($qrCodeBase64)
            <img src="data:image/png;base64,{{ $qrCodeBase64 }}" class="qr-code">
        @endif
    </div>
</body>

</html>