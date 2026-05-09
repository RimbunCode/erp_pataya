<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class CartController extends Controller {
    public function store(Request $request) {
        $request->validate([
            'course_id' => ['required', 'exists:courses,id'],
        ]);

        $user = Auth::user();

        Cart::firstOrCreate([
            'user_id'   => $user->id,
            'course_id' => $request->course_id,
        ], [
            'id' => Str::ulid(),
        ]);

        return back();
    }

    public function destroy(string $courseId) {
        Cart::where('user_id', Auth::id())
            ->where('course_id', $courseId)
            ->delete();

        return back();
    }
}