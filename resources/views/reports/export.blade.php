<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111; }
        h1 { font-size: 14px; margin: 0 0 4px 0; }
        p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #999; padding: 3px 4px; text-align: left; vertical-align: top; }
        th { background: #eee; }
        .kpi td { border: none; padding: 2px 6px 2px 0; }
        .kpi .value { font-weight: bold; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p>{{ __('report.export.generated_at') }}: {{ $generatedAt }}</p>
    <p>{{ __('report.export.filter') }}: {{ $filter }}</p>

    @if (count($kpi) > 0)
        <table class="kpi">
            @foreach ($kpi as $label => $value)
                <tr>
                    <td>{{ $label }}</td>
                    <td class="value">{{ $value }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    <table>
        <thead>
            <tr>
                @foreach ($columns as $column)
                    <th>{{ $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>{{ $cell }}</td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
