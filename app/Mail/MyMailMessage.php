<?php

namespace App\Mail;

use App\Utilities\EditorJsParser;
use Illuminate\Container\Container;
use Illuminate\Mail\Markdown;
use Illuminate\Notifications\Action;
use Illuminate\Notifications\Messages\MailMessage;

class MyMailMessage extends MailMessage {
    public $markdown       = 'mail.base-mail';
    public $view           = null;
    private $editorjs      = null;
    private $note          = null;
    private $table         = null;
    private $tableTitle    = null;
    private $title         = null;
    private $url           = null;
    private $logoUrl       = 'https://laravel.com/img/notification-logo.png';
    private ?array $notice = null;
    private array $buttons = [];
    private $buttonNote;
    private $regardsFrom;

    public function regards(string $name) {
        $this->regardsFrom = $name;

        return $this;
    }

    /**
     * Summary of button
     *
     * @param  string  $level  // 'primary', 'success', 'error', 'warning', 'info', 'danger', 'secondary'
     * @return static
     */
    public function button(string $text, string $url, $level = 'primary') {
        $this->buttons[] = [
            'text'           => $text,
            'url'            => $url,
            'level'          => $level,
            'displayableUrl' => str_replace(['mailto:', 'tel:'], '', $url ?? ''),
        ];

        return $this;
    }

    public function buttonNote(string $note) {
        $this->buttonNote = $note;

        return $this;
    }

    public function notice(string $notice, array $params = []) {
        $this->notice = [
            'content' => $notice,
            'params'  => $params,
        ];

        return $this;
    }

    public function header($title, $url, $logoUrl = null) {
        $this->title   = $title;
        $this->url     = $url;
        $this->logoUrl = $logoUrl;

        return $this;
    }

    public function note(string $note) {
        $this->note     = $note;
        $this->editorjs = null;

        return $this;
    }

    /**
     * Summary of editorJs
     *
     * @param  array|string  $editorJs
     * @return static
     */
    public function editorJs($editorJs) {
        if (! isset($editorJs) || $editorJs == null) {
            return $this;
        }
        $this->note = null;

        if (is_array($editorJs)) {
            $editorJs = json_encode($editorJs);
        }
        $parser = new EditorJsParser($editorJs);
        if ($parser->hasBlocks()) {
            $this->editorjs = $parser->toHtml();
        }

        return $this;
    }

    /**
     * Summary of table
     *
     * @return static
     */
    public function table(TableMarkdownBuilder $table, $title = null) {
        $this->tableTitle = $title;
        $this->table      = $table->render();

        return $this;
    }

    public function with($line) {
        if ($line instanceof Action) {
            $this->action($line->text, $line->url);
        } elseif (! ($this->actionText || count($this->buttons) > 0)) {
            $this->introLines[] = $this->formatLine($line);
        } else {
            $this->outroLines[] = $this->formatLine($line);
        }

        return $this;
    }

    public function toArray() {
        return [
            'title'                => $this->title,
            'buttons'              => $this->buttons,
            'buttonNote'           => $this->buttonNote,
            'url'                  => $this->url,
            'logourl'              => $this->logoUrl,
            'level'                => $this->level,
            'subject'              => $this->subject,
            'greeting'             => $this->greeting,
            'salutation'           => $this->salutation,
            'introLines'           => $this->introLines,
            'tableTitle'           => $this->tableTitle,
            'table'                => $this->table,
            'editorjs'             => $this->editorjs,
            'note'                 => $this->note,
            'outroLines'           => $this->outroLines,
            'actionText'           => $this->actionText,
            'actionUrl'            => $this->actionUrl,
            'regardsFrom'          => $this->regardsFrom,
            'notice'               => $this->notice,
            'displayableActionUrl' => str_replace(['mailto:', 'tel:'], '', $this->actionUrl ?? ''),
        ];
    }

    public function render() {
        $markdown = Container::getInstance()->make(Markdown::class);

        return $markdown->theme($this->theme ?: $markdown->getTheme())
            ->render($this->markdown, $this->data());
    }
}
