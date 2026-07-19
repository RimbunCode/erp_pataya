<?php

use Illuminate\Support\Facades\Broadcast;

// Nama channel mengikuti auto-derive default Laravel dari FQCN notifiable:
// str_replace('\\', '.', App\Models\User\User::class) = 'App.Models.User.User'
// — bukan 'App.Models.User' (lihat design.md soal keputusan ini).
Broadcast::channel('App.Models.User.User.{id}', function ($user, $id) {
    return (string) $user->id === (string) $id;
});
