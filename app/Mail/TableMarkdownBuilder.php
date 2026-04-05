<?php

namespace App\Mail;

use Illuminate\Contracts\Support\Renderable;

class TableMarkdownBuilder implements Renderable {
    protected $headers    = [];
    protected $alignments = [];
    protected $rows       = [];

    /**
     * Set column headers
     *
     * @param  array  $headers
     * @return $this
     */
    public function headers($headers) {
        $this->headers = $headers;

        return $this;
    }

    /**
     * Set column alignment (L, C, R)
     *
     * @param  array|string  $alignments
     * @return $this
     */
    public function align($alignments = null) {
        $this->alignments = $alignments;

        return $this;
    }

    /**
     * Add one row to the table
     *
     * @return $this
     */
    public function row($row) {
        $this->rows[] = $row;

        return $this;
    }

    /**
     * Add multiple rows
     *
     * @return $this
     */
    public function rows($rows) {
        foreach ($rows as $row) {
            $this->row($row);
        }

        return $this;
    }

    /**
     * Get the evaluated contents of the object.
     *
     * @return string
     */
    public function render() {
        $widths = $this->calculateWidths();

        $table = $this->renderHeaders($widths);
        $table .= $this->renderRows($widths);

        return $table;
    }

    protected function renderHeaders($widths) {
        $countMax = max(count($this->headers), array_map(function ($row) {
            return count($row);
        }, $this->rows));
        if (count($this->headers) == 0) {
            $result = '| ';
            for ($i = 0; $i < count($this->rows[0]); $i++) {
                $result .= $this->renderCell('<!-- -->', $this->columnAlign($i), $widths[$i]) . ' | ';
            }

            $result = rtrim($result, ' ') . PHP_EOL . $this->renderAlignments($widths) . PHP_EOL;

            return $result;
        }
        $result = '| ';
        for ($i = 0; $i < $countMax; $i++) {
            $result .= $this->renderCell($this->headers[$i], $this->columnAlign($i), $widths[$i]) . ' | ';
        }

        $result = rtrim($result, ' ') . PHP_EOL . $this->renderAlignments($widths) . PHP_EOL;

        return $result;
    }

    protected function renderRows($widths) {
        $result = '';
        foreach ($this->rows as $row) {
            $result .= '| ';
            for ($i = 0; $i < count($row); $i++) {
                $result .= $this->renderCell($row[$i], $this->columnAlign($i), $widths[$i]) . ' | ';
            }
            $result = rtrim($result, ' ') . PHP_EOL;
        }

        return $result;
    }

    protected function renderCell($contents, $alignment, $width) {
        switch ($alignment) {
            case 'L':
                $type = STR_PAD_RIGHT;
                break;
            case 'C':
                $type = STR_PAD_BOTH;
                break;
            case 'R':
                $type = STR_PAD_LEFT;
                break;
        }

        return str_pad($contents, $width, ' ', $type);
    }

    protected function calculateWidths() {
        $widths = [];

        foreach (array_merge([$this->headers], $this->rows) as $row) {
            for ($i = 0; $i < count($row); $i++) {
                $widths[$i] = 3;
                // $iWidth = strlen((string)$row[$i]);
                // if ((! array_key_exists($i, $widths)) || $iWidth > $widths[$i]) {
                //   $widths[$i] = $iWidth;
                // }
            }
        }

        // all columns must be at least 3 wide for the markdown to work
        $widths = array_map(function ($width) {
            return $width >= 3 ? $width : 3;
        }, $widths);

        return $widths;
    }

    protected function renderAlignments($widths) {
        $row = '|';
        for ($i = 0; $i < count($widths); $i++) {
            $cell  = str_repeat('-', $widths[$i] + 2);
            $align = $this->columnAlign($i);

            if ($align == 'C') {
                $cell = ':' . substr($cell, 2) . ':';
            }

            if ($align == 'R') {
                $cell = substr($cell, 1) . ':';
            }

            $row .= $cell . '|';
        }

        return $row;
    }

    protected function columnAlign($columnNumber) {
        $valid = ['L', 'C', 'R'];

        if (! is_array($this->alignments)) {
            return $this->alignments;
        }
        if (array_key_exists($columnNumber, $this->alignments) && in_array($this->alignments[$columnNumber], $valid)) {
            return $this->alignments[$columnNumber];
        }

        return 'L';
    }
}
