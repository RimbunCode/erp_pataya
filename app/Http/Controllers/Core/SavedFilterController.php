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
            ->get(['id', 'name', 'filter', 'is_saved', 'created_at']);

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
     * Simpan filter ad-hoc (ephemeral). URL halaman akan memakai ?fid=<id>.
     *
     * Update-or-create: bila `fid` menunjuk filter ephemeral milik user sendiri
     * untuk model yang sama, row itu di-UPDATE (memperbarui filter aktif, bukan
     * menumpuk row baru). Selain itu (fid kosong / milik user lain / sudah named
     * / model berbeda) → buat row ephemeral BARU milik requester.
     */
    public function store(StoreSavedFilterRequest $request): JsonResponse {
        $userId = $request->user()->id;
        $model  = $request->input('model');
        $filter = $request->input('filter');

        $existing = $this->reusableEphemeral($request->input('fid'), $userId, $model);
        if ($existing !== null) {
            $existing->update(['filter' => $filter]);

            return response()->json(['id' => $existing->id]);
        }

        $saved = SavedFilter::create([
            'user_id'  => $userId,
            'model'    => $model,
            'filter'   => $filter,
            'name'     => $request->input('name'),
            'is_saved' => false,
        ]);

        return response()->json(['id' => $saved->id]);
    }

    /**
     * Cari filter ephemeral yang boleh di-update in-place oleh requester:
     * milik user sendiri, belum named (is_saved=false), dan model cocok.
     * Mengembalikan null bila tidak memenuhi (→ caller membuat row baru).
     */
    private function reusableEphemeral(?string $fid, string $userId, string $model): ?SavedFilter {
        if ($fid === null || $fid === '') {
            return null;
        }

        $saved = SavedFilter::find($fid);
        if ($saved === null) {
            return null;
        }
        if ($saved->user_id !== $userId || $saved->is_saved || $saved->model !== $model) {
            return null;
        }

        return $saved;
    }

    /**
     * Perbarui named filter (owner-only). Mendukung:
     *  - promote ephemeral → named (kirim `name`),
     *  - rename (kirim `name`),
     *  - overwrite tree named existing (kirim `filter`).
     * Mengirim `name` selalu menjadikan `is_saved=true` (named/permanen).
     */
    public function update(UpdateSavedFilterRequest $request, SavedFilter $savedFilter): JsonResponse {
        abort_if($savedFilter->user_id !== $request->user()->id, 403);

        $attributes = [];
        if ($request->filled('name')) {
            $attributes['name']     = $request->input('name');
            $attributes['is_saved'] = true;
        }
        if ($request->has('filter')) {
            $attributes['filter'] = $request->input('filter');
        }

        if ($attributes !== []) {
            $savedFilter->update($attributes);
        }

        return response()->json([
            'id'     => $savedFilter->id,
            'name'   => $savedFilter->name,
            'filter' => $savedFilter->filter,
        ]);
    }

    /**
     * Hapus named filter milik user. Owner-only.
     */
    public function destroy(mixed $id): JsonResponse {
        $savedFilter = SavedFilter::findOrFail($id);
        abort_if($savedFilter->user_id !== request()->user()->id, 403);

        $savedFilter->delete();

        return response()->json(['ok' => true]);
    }
}
