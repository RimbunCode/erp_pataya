<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $subject ?? config('app.name') }}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .header { background: #1a56db; padding: 28px 32px; }
  .header-title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; }
  .body { padding: 32px; }
  .greeting { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px; }
  .intro-line { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 12px; }
  .note-box { background: #f9fafb; border-left: 3px solid #1a56db; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #374151; line-height: 1.6; }
  .btn-wrap { text-align: center; margin: 24px 0; }
  .btn { display: inline-block; background: #1a56db; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; }
  .btn-note { text-align: center; font-size: 12px; color: #6b7280; margin-top: 8px; }
  .outro-line { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 12px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .footer { padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
  .regards { font-size: 13px; color: #6b7280; margin: 0; }
  .notice-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400e; }
  strong { font-weight: 600; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 12px; color: #374151; border-bottom: 1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <p class="header-title">{{ config('app.name') }}</p>
    </div>
    <div class="body">

      @if(!empty($greeting))
        <p class="greeting">{{ $greeting }}</p>
      @endif

      @foreach($introLines ?? [] as $line)
        <p class="intro-line">{!! nl2br(e($line)) !!}</p>
      @endforeach

      @if(!empty($note))
        <div class="note-box">{!! \Illuminate\Support\Str::markdown($note) !!}</div>
      @endif

      @if(!empty($editorjs))
        <div class="note-box">{!! $editorjs !!}</div>
      @endif

      @if(!empty($notice))
        <div class="notice-box">{!! \Illuminate\Support\Str::markdown($notice['content'] ?? '') !!}</div>
      @endif

      @if(!empty($table))
        <div>
          @if(!empty($tableTitle))
            <p style="font-weight:600;color:#111827;margin:0 0 8px;">{{ $tableTitle }}</p>
          @endif
          {!! \Illuminate\Support\Str::markdown($table) !!}
        </div>
      @endif

      @if(!empty($buttons))
        @foreach($buttons as $btn)
          <div class="btn-wrap">
            <a href="{{ $btn['url'] }}" class="btn">{{ $btn['text'] }}</a>
          </div>
        @endforeach
      @elseif(!empty($actionText) && !empty($actionUrl))
        <div class="btn-wrap">
          <a href="{{ $actionUrl }}" class="btn">{{ $actionText }}</a>
        </div>
      @endif

      @if(!empty($buttonNote))
        <p class="btn-note">{{ $buttonNote }}</p>
      @endif

      @foreach($outroLines ?? [] as $line)
        <p class="outro-line">{!! nl2br(e($line)) !!}</p>
      @endforeach

    </div>
    <div class="footer">
      <p class="regards">
        @if(!empty($regardsFrom))
          Salam, <strong>{{ $regardsFrom }}</strong>
        @else
          Salam, <strong>{{ config('app.name') }}</strong>
        @endif
      </p>
    </div>
  </div>
</div>
</body>
</html>
