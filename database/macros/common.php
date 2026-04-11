<?php
use Illuminate\Database\Schema\Blueprint;

Blueprint::macro('generalFields', function ($isUser = false) {
    $this->ulid('id')->primary();
    $this->timestamps();
    $this->softDeletes();
    if ($isUser) {
        $this->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->cascadeOnDelete();
    }
});
