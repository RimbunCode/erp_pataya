<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            margin: 0;
            padding: 0;
        }
        .page {
            page-break-after: always;
            padding: 60px;
            box-sizing: border-box;
            height: 100%;
            text-align: center;
        }
        .page:last-child { page-break-after: auto; }
        .logo { max-height: 80px; margin-bottom: 20px; }
        .organizer { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 30px; }
        .title { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .student-name { font-size: 24px; font-weight: bold; margin: 20px 0; text-decoration: underline; }
        .course-title { font-size: 18px; margin-bottom: 10px; }
        .period { font-size: 14px; color: #444; margin-bottom: 30px; }
        .score-block { font-size: 14px; margin: 15px 0; }
        .credential-id { font-size: 12px; color: #666; margin-top: 30px; }
        .signature-block { margin-top: 60px; }
        .signature-image { max-height: 60px; }
        .signer-name { font-weight: bold; margin-top: 10px; }
        .signer-title { font-size: 12px; color: #444; }
        .back-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; }
        .back-meta { font-size: 13px; text-align: left; margin-bottom: 20px; }
        .materials { text-align: left; font-size: 13px; }
        .materials ol { padding-left: 20px; }
        .materials li { margin-bottom: 6px; }
    </style>
</head>
<body>
    <div class="page">
        @if($logoPath)
            <img src="{{ $logoPath }}" class="logo">
        @endif
        <div class="organizer">{{ $organizerName }}</div>
        <div class="title">SERTIFIKAT</div>
        <div>diberikan kepada</div>
        <div class="student-name">{{ $studentName }}</div>
        <div>atas partisipasinya dalam pelatihan</div>
        <div class="course-title">{{ $courseTitle }}</div>
        <div class="period">{{ $period }}</div>

        @if($finalScore !== null)
            <div class="score-block">
                Nilai Akhir: {{ $finalScore }} &mdash; Grade: {{ $grade }}
            </div>
        @endif

        <div class="signature-block">
            @if($signatureImagePath)
                <img src="{{ $signatureImagePath }}" class="signature-image">
            @endif
            <div class="signer-name">{{ $signerName }}</div>
            <div class="signer-title">{{ $signerTitle }}</div>
        </div>

        <div class="credential-id">No. Sertifikat: {{ $credentialId }}</div>
    </div>

    <div class="page">
        <div class="back-title">Rincian Pelatihan</div>
        <div class="back-meta">
            <div><strong>Judul Pelatihan:</strong> {{ $courseTitle }}</div>
            <div><strong>Periode:</strong> {{ $period }}</div>
            <div><strong>Instruktur:</strong> {{ $instructorName }}</div>
            <div><strong>No. Sertifikat:</strong> {{ $credentialId }}</div>
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
</body>
</html>
