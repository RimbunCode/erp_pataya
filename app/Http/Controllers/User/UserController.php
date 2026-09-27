<?php

namespace App\Http\Controllers\User;

use App\Enums\FormStatus;
use App\Enums\Permission;
use App\Exceptions\User\SignatureProcessingException;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\SignatureUploadRequest;
use App\Http\Requests\User\UserRequest;
use App\Models\Core\Branch;
use App\Models\Core\File;
use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Core\Approval\ApprovalAccessService;
use App\Services\Core\PermissionChecker;
use App\Services\User\Signature\SignatureImageService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Socialite\Socialite;

class UserController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, User::class);
    }

    protected function exceptPermission(string $method) {
        $route   = Route::getCurrentRoute();
        $user_id = $route->originalParameter('user');

        // Mutasi tanda tangan DIKUNCI ke pemilik akun, dan sengaja TIDAK
        // mengikuti pola `image` di bawah.
        //
        // Untuk foto profil, pemegang permission write boleh mengubah milik
        // user lain dan itu wajar. Untuk tanda tangan tidak: gambarnya ikut
        // tercetak di dokumen resmi yang sudah di-approve, sehingga
        // memasangnya atas nama orang lain harus mustahil lewat jalur apa
        // pun. Karena itu `enforcePermission()` juga TIDAK diberi entri
        // untuk method ini -- tidak ada permission yang membukanya.
        if (\in_array($method, ['signature', 'removeSignature'], true)) {
            return $user_id === Auth::id();
        }

        // showSignature() memang harus bisa lintas-user: approver melihat
        // tanda tangan orang lain lewat dokumen. Kelayakannya diperiksa di
        // dalam method itu sendiri (ApprovalAccessService), bukan lewat
        // permission model User -- pemeriksaan di sini akan menolak justru
        // kasus normalnya.
        if ($method === 'showSignature') {
            return true;
        }

        if (
            \in_array($method, [
                'show',
                'update',
                'image',
                'removeImage',
                'connectToProvider',
                'addComment',
                'addTag',
                'addFile',
                'removeFile',
                'removeComment',
                'removeTag',
            ]) && $user_id == Auth::user()->id
        ) {
            return true;
        }
    }

    protected function enforcePermission($method) {
        if (\in_array($method, ['image', 'removeImage'])) {
            return ['write'];
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        if (! Utils::isInertiaRequest($request)) {
            $users = User::query();
            if ($request->has('search')) {
                $users->whereAny(['name', 'email', 'username'], 'like', "%{$request->search}%");
            }

            return response()->json($users->get());
        }
        $this->setBreadcrumbs();
        // dd(json_decode(stripslashes($_COOKIE['datatable_columns'])));
        User::dataTable($request);

        return Inertia::render('Users/ManageUsers/Index');
    }

    public function image(Request $request, User $user) {
        DB::beginTransaction();
        File::uploadFile($request, 'ImageProfile', function ($file) use ($user) {
            $user->update([
                'image' => $file->id,
            ]);
        });
        DB::commit();

        return back();
    }

    public function removeImage(User $user) {
        $user->update(['image' => null]);

        return back();
    }

    /**
     * Simpan tanda tangan user. Gambar hasil unggahan diproses menjadi PNG
     * transparan; hasil canvas sudah transparan sejak lahir sehingga
     * melewati pipeline threshold (FR3).
     */
    public function signature(SignatureUploadRequest $request, User $user) {
        $data = $request->validated();

        /** @var \Illuminate\Http\UploadedFile $upload */
        $upload = $request->file('signature');
        $bytes  = file_get_contents($upload->getRealPath());

        if ($bytes === false) {
            throw ValidationException::withMessages([
                'signature' => __('user.signature.errors.unreadable_image'),
            ]);
        }

        if ($data['source'] === 'upload') {
            try {
                $bytes = app(SignatureImageService::class)->process($bytes);
            } catch (SignatureProcessingException $e) {
                throw ValidationException::withMessages([
                    'signature' => $e->getMessage(),
                ]);
            }
        }

        DB::transaction(function () use ($user, $bytes) {
            $previous = $user->signatureFile;

            // Berkas ASLI hasil unggahan tidak pernah disimpan (FR6): yang
            // masuk storage hanya PNG hasil proses, sehingga foto mentah
            // tanda tangan tidak tertinggal di server.
            // Nama berkas dibuat sendiri, bukan mengandalkan nilai balik
            // Storage::put(): fungsi itu menerima path LENGKAP dan
            // mengembalikan bool, bukan path seperti putFile().
            $path = 'files/' . Str::ulid() . '.png';
            Storage::put($path, $bytes);

            $file = File::create([
                'name'      => "signature-{$user->id}",
                'path'      => $path,
                'extension' => 'png',
                'mime_type' => 'image/png',
                // Dipaksa di server, TIDAK diambil dari request: tanda tangan
                // tidak boleh bisa dijadikan publik oleh klien (FR6, NFR3).
                'is_public' => false,
                'user_id'   => $user->id,
            ]);

            $user->update(['signature_file_id' => $file->id]);

            $this->deleteSignatureFile($previous);
        });

        return back();
    }

    public function removeSignature(User $user) {
        DB::transaction(function () use ($user) {
            $previous = $user->signatureFile;
            $user->update(['signature_file_id' => null]);
            $this->deleteSignatureFile($previous);
        });

        return back();
    }

    /**
     * Sajikan berkas tanda tangan. Tidak dilayani lewat storage publik:
     * aksesnya dibatasi ke pemilik akun dan pihak yang berhak melihat
     * dokumen tempat tanda tangan itu muncul (FR7).
     */
    public function showSignature(Request $request, User $user) {
        $file = $user->signatureFile;

        abort_if($file === null, 404);
        abort_unless(
            app(ApprovalAccessService::class)->canViewSignatureOf($request->user(), $user),
            403,
        );

        abort_unless(Storage::exists($file->path), 404);

        // response()->make(), BUKAN Storage::response(): yang kedua
        // menghasilkan StreamedResponse, dan middleware aplikasi ini
        // memanggil withCookie() pada response yang keluar -- method yang
        // tidak dimiliki StreamedResponse. Berkas tanda tangan kecil
        // (maksimum setinggi 200 px), jadi memuatnya ke memori tidak jadi
        // soal.
        return response()->make(Storage::get($file->path), 200, [
            'Content-Type'        => 'image/png',
            'Content-Disposition' => 'inline; filename="signature.png"',
            // `private` mencegah proxy bersama menyimpan tanda tangan.
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    /**
     * Hapus record File tanda tangan lama beserta berkas fisiknya (FR6).
     */
    private function deleteSignatureFile(?File $file): void {
        if ($file === null) {
            return;
        }

        if ($file->path && Storage::exists($file->path)) {
            Storage::delete($file->path);
        }

        $file->forceDelete();
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Users/ManageUsers/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        try {
            $user = User::create([
                'name'              => $data['name'],
                'email'             => $data['email'],
                'status'            => FormStatus::INVITED,
                'default_branch_id' => $data['default_branch_id'] ?? null,
            ]);
            if (! empty($data['roles'])) {
                $user->roles()->sync($data['roles']);
            }
            if (! empty($data['branches'])) {
                $user->branches()->sync($data['branches']);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('users.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, User $user) {
        $permissionChecker = PermissionChecker::forUser($request);
        $canSelect         = $permissionChecker->can(User::class, Permission::Select);
        if ($canSelect) {
            $this->setBreadcrumbs($user);
        } else {
            Inertia::share(['breadcrumbs' => [['name' => 'user.user.my_profile']]]);
        }
        $user->showDetail();

        $canManageRoles    = $permissionChecker->canAction(User::class, 'manage_roles');
        $canManageBranches = $permissionChecker->canAction(User::class, 'manage_branches');

        return Inertia::render('Users/ManageUsers/Show', [
            'user' => function () use ($user, $canManageRoles, $canManageBranches) {
                if ($canManageRoles) {
                    $user->roles = $user->roles()->pluck('id');
                }
                if ($canManageBranches) {
                    $user->branches = $user->branches()->pluck('id');
                }

                return $user;
            },
            ...($canManageRoles ? [
                'roles' => Inertia::defer(Role::with(['rules', 'rules.permission'])->get(...)),
            ] : []),
            ...($canManageBranches ? [
                'branches' => Inertia::defer(Branch::whereNull('branchable_type')->whereNull('branchable_id')->get(...)),
            ] : []),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, User $user) {
        $data              = $request->validated();
        $permissionChecker = PermissionChecker::forUser($request);
        DB::beginTransaction();
        if ($user->id != $request->user()->id) {
            $data['status'] = \in_array($user->status, [FormStatus::ACTIVE, FormStatus::INACTIVE]) ? $user->status : FormStatus::ACTIVE;
        }
        if ($permissionChecker->canAction(User::class, 'manage_roles')) {
            $user->roles()->sync($data['roles'] ?? []);
        }
        if ($permissionChecker->canAction(User::class, 'manage_branches')) {
            $user->branches()->sync($data['branches'] ?? []);
        }
        $user->fillForUpdate($data);
        DB::commit();

        return back();
    }

    public function connectToProvider(User $user, string $driver) {
        return Socialite::driver($driver)
            ->redirect();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(mixed $id) {
        $user = User::findOrFail($id);
        request()->validate([
            'password' => ['required', 'current_password'],
        ]);
        DB::beginTransaction();
        try {
            $user->delete();
            $user->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        if (request()->user()->id == $user->id) {
            Auth::logout();

            request()->session()->invalidate();
            request()->session()->regenerateToken();

            return redirect()->to('/');
        } else {
            return redirect()->route('users.index');
        }
    }
}
