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
    ];
    protected $appends                = ['fullname'];
    public $translateKey              = 'core.file';
    public static $allow_only_creator = true;
    protected $configColumns          = [
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
    public static function uploadFile(Request $request, string $folderName, callable $onUploadedFile, array $defaultValue = []) {
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
            $folder = File::firstOrCreate([
                'name'      => $folderName,
                'mime_type' => 'folder',
            ]);
            foreach ($validatedData['files'] as $key => $file) {
                $extension = $file->getClientOriginalExtension();
                $file      = File::create([
                    'name'      => \strlen(trim($validatedData['name'][$key])) > 0 ? $validatedData['name'][$key] : str_replace(".$extension", '', $file->getClientOriginalName()),
                    'path'      => $file->store('files'),
                    'is_public' => $validatedData['isPublic'][$key] == 'true',
                    'extension' => $extension,
                    'mime_type' => $file->getMimeType(),
                    'user_id'   => $request->user()->id,
                    'parent_id' => $folder->id,
                    ...$defaultValue,
                ]);
                $onUploadedFile($file);
            }
        }
    }
}
