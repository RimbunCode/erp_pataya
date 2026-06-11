<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use App\Traits\TreeView;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;

class File extends Model {
    use DataTable, HasUlids, SoftDeletes, TreeView;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_public' => 'boolean',
        'is_draft'  => 'boolean',
    ];
    protected $appends                = ['fullname'];
    public $translateKey              = 'core.file';
    public static $allow_only_creator = true;
    protected array $configColumns    = [
        'name' => [
            'show'  => true,
            'order' => 0,
        ],
        'mime_type' => [
            'show'  => true,
            'order' => 1,
        ],
        'folder',
        'user',
        'path' => [
            'ignore' => true,
        ],
    ];

    protected function getFullnameAttribute() {
        return "{$this->name}.{$this->extension}";
    }

    public static function templateLink() {
        return ':fullname';
    }

    protected static function loadRelationsOnShow() {
        return [
            'user',
            'folder',
        ];
    }

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function folder() {
        return $this->belongsTo(File::class, 'folder_id');
    }

    /**
     * Summary of uploadFile
     *
     * @param  callable(File)  $onUploadedFile
     * @return void
     */
    public static function uploadFile(Request $request, string $folderName, callable $onUploadedFile, array $defaultValue = [], bool $useFolder = true) {
        if ($request->has('filesId')) {
            $validatedData = $request->validate([
                'filesId'   => ['required', 'array'],
                'filesId.*' => ['required', 'string', 'exists:files,id'],
            ]);
            $files = File::whereIn('id', $validatedData['filesId'])->get();
            $files->each(function ($file) use ($onUploadedFile) {
                $onUploadedFile($file);
            });
        } elseif ($request->has('files')) {
            $validatedData = $request->validate([
                'files'      => ['required', 'array'],
                'files.*'    => ['required', 'file', 'max:10240'],
                'isPublic'   => ['required', 'array'],
                'isPublic.*' => ['required'],
                'name'       => ['required', 'array'],
                'name.*'     => ['required', 'string'],
            ]);
            // Folder = parent nested-set. Insert ke parent ber-rgt rendah
            // meng-shift seluruh subtree kanan (O(n) update) → lambat untuk
            // tabel besar. Draft upload pakai $useFolder=false agar file
            // ditambahkan sebagai root (append ujung, tanpa shift massal).
            $parentId = null;
            if ($useFolder) {
                $folder = File::firstOrCreate([
                    'name'      => $folderName,
                    'mime_type' => 'folder',
                ]);
                $parentId = $folder->id;
            }
            foreach ($validatedData['files'] as $key => $file) {
                $extension = $file->getClientOriginalExtension();
                $file      = File::create([
                    'name'      => \strlen(trim($validatedData['name'][$key])) > 0 ? $validatedData['name'][$key] : str_replace(".$extension", '', $file->getClientOriginalName()),
                    'path'      => $file->store('files'),
                    'is_public' => $validatedData['isPublic'][$key] == 'true',
                    'extension' => $extension,
                    'mime_type' => $file->getMimeType(),
                    'user_id'   => $request->user()->id,
                    'parent_id' => $parentId,
                    ...$defaultValue,
                ]);
                $onUploadedFile($file);
            }
        }
    }
}
