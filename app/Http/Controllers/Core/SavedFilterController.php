<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\StoreSavedFilterRequest;
use App\Http\Requests\Core\UpdateSavedFilterRequest;
use App\Models\Core\SavedFilter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedFilterController extends Controller {
    /**
     * Listing private: named filter milik user untuk sebuah model.
     */
    public function index(Request $request): JsonResponse {
        $request->validate(['model' => ['required', 'string']]);

        $filters = SavedFilter::ownedListing($request->user()->id, $request->input('model'))
            ->latest()
            ->get(['id', 'name', 'filter', 'created_at']);

        return response()->json($filters);
    }

    /**
     * Ambil sebuah saved filter berdasarkan id (termasuk ephemeral) untuk
     * men-seed builder. Akses by-id terbuka — SELARAS dengan ?fid= pada
     * DataTableScope yang sudah membolehkan share-link lintas user: user lain
     * boleh memakai tree sebagai titik awal lalu Apply/Save → store membuat row
     * BARU milik mereka (user_id requester), filter asal tak tersentuh.
     *
     * Mitigasi IDOR: `name` (label pribadi yang diberi pemilik) hanya
     * dikembalikan ke owner; non-owner hanya menerima `filter` (tree) & `model`
     * yang efeknya memang sudah terekspos via ?fid=. Id berupa ULID (128-bit)
     * sehingga enumerasi tidak praktis.
     */
    public function show(Request $request, SavedFilter $savedFilter): JsonResponse {
        $isOwner = $savedFilter->user_id === $request->user()->id;

        return response()->json([
            'id'     => $savedFilter->id,
            'model'  => $savedFilter->model,
            'name'   => $isOwner ? $savedFilter->name : null,
            'filter' => $savedFilter->filter,
        ]);
    }

    /**
     * Buat filter ad-hoc (ephemeral). URL halaman akan memakai ?fid=<id>.
     */
    public function store(StoreSavedFilterRequest $request): JsonResponse {
        $saved = SavedFilter::create([
            'user_id'  => $request->user()->id,
            'model'    => $request->input('model'),
            'filter'   => $request->input('filter'),
            'name'     => $request->input('name'),
            'is_saved' => false,
        ]);

        return response()->json(['id' => $saved->id]);
    }

    /**
     * Promosikan filter ephemeral menjadi named (permanen). Owner-only.
     */
    public function update(UpdateSavedFilterRequest $request, SavedFilter $savedFilter): JsonResponse {
        abort_if($savedFilter->user_id !== $request->user()->id, 403);

        $savedFilter->update([
            'name'     => $request->input('name'),
            'is_saved' => true,
        ]);

        return response()->json(['id' => $savedFilter->id]);
    }

    /**
     * Hapus named filter milik user. Owner-only.
     */
    public function destroy(Request $request, SavedFilter $savedFilter): JsonResponse {
        abort_if($savedFilter->user_id !== $request->user()->id, 403);

        $savedFilter->delete();

        return response()->json(['ok' => true]);
    }
}
