<?php

namespace Tests\Feature\User;

use App\Models\Core\File;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class UserSignatureTest extends TestCase {
    use RefreshDatabase;

    private User $authUser;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // `files` dibuat oleh migration nyata, tetapi kolom nested-set
        // (TreeView) dan is_example ditambahkan dinamis di produksi lewat
        // DataTable::initPermissions(). Ditambahkan di sini dengan cara yang
        // sama seperti ApprovalPdfAutoAttachTest.
        if (Schema::hasTable('files')) {
            Schema::table('files', function ($t) {
                foreach (['lft', 'rgt', 'depth'] as $column) {
                    if (! Schema::hasColumn('files', $column)) {
                        $t->integer($column)->nullable();
                    }
                }
                if (! Schema::hasColumn('files', 'parent_id')) {
                    $t->char('parent_id', 26)->nullable();
                }
            });
        }

        Storage::fake('local');

        $this->authUser = User::factory()->create();

        // Permission PENUH pada model User, termasuk `write`. Sengaja
        // begitu: test otorisasi di bawah harus membuktikan bahwa bahkan
        // permission selengkap ini TIDAK membuka jalan mengubah tanda
        // tangan orang lain.
        $this->sessionData = [
            'permissions' => [
                User::class => [
                    0 => [
                        [
                            'model'        => User::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function acting() {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser);
    }

    /**
     * Gambar tanda tangan sederhana: goresan gelap di atas kertas putih.
     */
    private function signatureUpload(string $name = 'ttd.png'): UploadedFile {
        $image = imagecreatetruecolor(200, 200);
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        $ink = imagecolorallocate($image, 0, 0, 0);
        imagesetthickness($image, 6);
        imageline($image, 40, 40, 160, 160, $ink);
        imageline($image, 160, 40, 40, 160, $ink);

        ob_start();
        imagepng($image);
        $bytes = (string) ob_get_clean();

        $path = tempnam(sys_get_temp_dir(), 'sig') . '.png';
        file_put_contents($path, $bytes);

        return new UploadedFile($path, $name, 'image/png', null, true);
    }

    #[Test]
    public function owner_can_upload_signature(): void {
        $response = $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $response->assertRedirect();

        $this->authUser->refresh();
        $this->assertNotNull($this->authUser->signature_file_id);

        $file = $this->authUser->signatureFile;
        $this->assertSame('png', $file->extension);
        $this->assertSame('image/png', $file->mime_type);
        $this->assertTrue(Storage::exists($file->path));
    }

    #[Test]
    public function owner_can_remove_signature(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->authUser->refresh();
        $path = $this->authUser->signatureFile->path;

        $this->acting()
            ->delete(route('users.removeSignature', $this->authUser))
            ->assertRedirect();

        $this->authUser->refresh();
        $this->assertNull($this->authUser->signature_file_id);
        $this->assertFalse(Storage::exists($path));
    }

    /**
     * Test TERPENTING di berkas ini.
     *
     * Titik tempat fitur ini sengaja menyimpang dari pola `image` (foto
     * profil), yang membolehkan pemegang permission write mengubah milik
     * user lain. Tanda tangan ikut tercetak di dokumen resmi, jadi
     * memasangnya atas nama orang lain harus mustahil lewat jalur apa pun,
     * termasuk permission selengkap apa pun.
     */
    #[Test]
    public function user_with_write_permission_cannot_upload_signature_for_another_user(): void {
        $otherUser = User::factory()->create();

        $this->acting()
            ->post(route('users.signature', $otherUser), [
                'signature' => $this->signatureUpload(),
                'source'    => 'upload',
            ])
            ->assertForbidden();

        $otherUser->refresh();
        $this->assertNull($otherUser->signature_file_id);
    }

    #[Test]
    public function user_with_write_permission_cannot_remove_another_users_signature(): void {
        $otherUser = User::factory()->create();

        $file = File::create([
            'name'      => 'signature-other',
            'path'      => 'files/other.png',
            'extension' => 'png',
            'mime_type' => 'image/png',
            'is_public' => false,
        ]);
        $otherUser->update(['signature_file_id' => $file->id]);

        $this->acting()
            ->delete(route('users.removeSignature', $otherUser))
            ->assertForbidden();

        $otherUser->refresh();
        $this->assertSame($file->id, $otherUser->signature_file_id);
    }

    #[Test]
    public function is_public_is_forced_false_even_when_request_asks_otherwise(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
            'isPublic'  => true,
        ]);

        $this->authUser->refresh();
        $this->assertFalse((bool) $this->authUser->signatureFile->is_public);
    }

    #[Test]
    public function original_upload_is_not_kept_in_storage(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload('rahasia.png'),
            'source'    => 'upload',
        ]);

        // Tepat satu berkas tersimpan: PNG hasil proses. Foto mentah tanda
        // tangan tidak boleh tertinggal di server (FR6).
        $this->assertCount(1, Storage::allFiles());
    }

    #[Test]
    public function replacing_signature_deletes_the_previous_file(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->authUser->refresh();
        $firstFile = $this->authUser->signatureFile;
        $firstPath = $firstFile->path;

        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->authUser->refresh();
        $this->assertNotSame($firstFile->id, $this->authUser->signature_file_id);
        $this->assertFalse(Storage::exists($firstPath));
        $this->assertCount(1, Storage::allFiles());
    }

    #[Test]
    public function signature_file_id_is_hidden_from_serialization(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->authUser->refresh();
        $serialized = $this->authUser->toArray();

        $this->assertArrayNotHasKey('signature_file_id', $serialized);
        // Keberadaannya tetap bisa diketahui, tanpa membocorkan id berkas.
        $this->assertTrue($serialized['has_signature']);
    }

    #[Test]
    public function guest_cannot_fetch_a_signature_file(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->post(route('logout'));

        $this->get(route('users.showSignature', $this->authUser))
            ->assertRedirect(route('login'));
    }

    #[Test]
    public function owner_can_fetch_own_signature_file(): void {
        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        $this->acting()
            ->get(route('users.showSignature', $this->authUser))
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');
    }

    #[Test]
    public function unrelated_user_cannot_fetch_another_users_signature(): void {
        $otherUser = User::factory()->create();

        $this->acting()->post(route('users.signature', $this->authUser), [
            'signature' => $this->signatureUpload(),
            'source'    => 'upload',
        ]);

        // $otherUser tidak berbagi approval instance apa pun dengan pemilik,
        // jadi tidak ada alasan ia boleh melihat tanda tangannya.
        $this->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($otherUser)
            ->get(route('users.showSignature', $this->authUser))
            ->assertForbidden();
    }

    #[Test]
    public function oversized_file_is_rejected(): void {
        $this->acting()
            ->post(route('users.signature', $this->authUser), [
                'signature' => UploadedFile::fake()->create('besar.png', 6000, 'image/png'),
                'source'    => 'upload',
            ])
            ->assertSessionHasErrors('signature');

        $this->authUser->refresh();
        $this->assertNull($this->authUser->signature_file_id);
    }

    #[Test]
    public function non_image_file_is_rejected(): void {
        $this->acting()
            ->post(route('users.signature', $this->authUser), [
                'signature' => UploadedFile::fake()->create('dokumen.pdf', 10, 'application/pdf'),
                'source'    => 'upload',
            ])
            ->assertSessionHasErrors('signature');
    }

    #[Test]
    public function blank_paper_is_rejected_with_translated_message(): void {
        $blank = imagecreatetruecolor(120, 80);
        imagefill($blank, 0, 0, imagecolorallocate($blank, 255, 255, 255));
        ob_start();
        imagepng($blank);
        $bytes = (string) ob_get_clean();

        $path = tempnam(sys_get_temp_dir(), 'blank') . '.png';
        file_put_contents($path, $bytes);

        $this->acting()
            ->post(route('users.signature', $this->authUser), [
                'signature' => new UploadedFile($path, 'kosong.png', 'image/png', null, true),
                'source'    => 'upload',
            ])
            ->assertSessionHasErrors('signature');

        $this->authUser->refresh();
        $this->assertNull($this->authUser->signature_file_id);
    }

    /**
     * Hasil canvas sudah transparan sejak lahir, jadi jalur simpannya
     * melewati pipeline threshold (FR3). Kalau tidak dilewati, area
     * transparan terbaca hitam pekat dan hasilnya jadi blok tinta.
     */
    #[Test]
    public function canvas_source_skips_threshold_pipeline(): void {
        $canvas = imagecreatetruecolor(160, 80);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        imagefilledrectangle($canvas, 0, 0, 159, 79, 0x7F000000);
        imagefilledrectangle($canvas, 20, 30, 140, 45, 0x00000000);

        ob_start();
        imagepng($canvas);
        $bytes = (string) ob_get_clean();

        $path = tempnam(sys_get_temp_dir(), 'canvas') . '.png';
        file_put_contents($path, $bytes);

        $this->acting()
            ->post(route('users.signature', $this->authUser), [
                'signature' => new UploadedFile($path, 'canvas.png', 'image/png', null, true),
                'source'    => 'canvas',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->authUser->refresh();
        $this->assertNotNull($this->authUser->signature_file_id);
    }
}
