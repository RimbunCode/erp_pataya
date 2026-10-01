<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use LightnCandy\LightnCandy;
use Tests\TestCase;

/**
 * Menjaga agar setiap helper Handlebars sisi server tetap dapat dikompilasi
 * lightncandy.
 *
 * lightncandy tidak memanggil closure helper secara langsung: ia menyalin KODE
 * SUMBER closure itu ke dalam PHP yang ia hasilkan, lalu kode gabungan tersebut
 * di-eval. Closure berbentuk `fn () => ...` tidak terbaca utuh oleh pembacanya,
 * menyisakan `=>` menggantung sehingga eval gagal dengan
 * "ParseError: syntax error, unexpected token \"=>\"". Closure berbentuk
 * `function () { ... }` terbaca.
 *
 * Keduanya callable yang setara bagi PHP, jadi tidak ada analisis statis yang
 * dapat menangkap perbedaan ini — hanya menjalankan kompilasi yang membuktikan.
 * Itulah sebabnya cacat ini sempat lolos: test render yang ada hanya menguji
 * formatData(), bukan jalur kompilasi.
 */
class PrintTemplateRenderServiceHelpersTest extends TestCase {
    protected PrintTemplateRenderService $service;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('currencies')) {
            Schema::create('currencies', function (Blueprint $table): void {
                $table->string('code', 10)->primary();
                $table->string('name');
                $table->string('symbol')->nullable();
                $table->string('number_format')->nullable();
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('preferences')) {
            Schema::create('preferences', function (Blueprint $table): void {
                $table->string('key')->primary();
                $table->text('value');
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        if (DB::table('currencies')->where('code', 'IDR')->doesntExist()) {
            DB::table('currencies')->insert([
                'code'       => 'IDR',
                'name'       => 'Indonesian Rupiah',
                'symbol'     => 'Rp',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->service = app(PrintTemplateRenderService::class);
    }

    /**
     * @return array<string, callable>
     */
    protected function helpers(): array {
        $method = new \ReflectionMethod($this->service, 'helpers');

        return $method->invoke($this->service);
    }

    /**
     * Mengompilasi template yang memanggil satu helper, lalu meng-eval hasilnya
     * persis seperti renderTemplate() melakukannya.
     *
     * @param  array<string, callable>  $helpers
     */
    protected function compileAndEval(string $templateSource, array $helpers): callable {
        $phpCode = LightnCandy::compile($templateSource, [
            'flags'   => LightnCandy::FLAG_HANDLEBARSJS | LightnCandy::FLAG_ERROR_LOG,
            'helpers' => $helpers,
        ]);

        $this->assertNotFalse($phpCode, 'lightncandy gagal mengompilasi template.');

        $renderer = eval($phpCode);

        $this->assertIsCallable($renderer, 'Hasil eval bukan callable.');

        return $renderer;
    }

    /**
     * @return array<int, array{0: string}>
     */
    public static function helperNameProvider(): array {
        return [
            'relation'       => ['relation'],
            'label'          => ['label'],
            'trans'          => ['trans'],
            'companyDetail'  => ['companyDetail'],
            'infoColumns'    => ['infoColumns'],
            'formatDate'     => ['formatDate'],
            'formatCurrency' => ['formatCurrency'],
            'formatNumber'   => ['formatNumber'],
            'uppercase'      => ['uppercase'],
            'multiply'       => ['multiply'],
            'subtract'       => ['subtract'],
            'add'            => ['add'],
            'divide'         => ['divide'],
        ];
    }

    /**
     * Tiap helper diuji sendiri-sendiri supaya kegagalan menyebut helper mana
     * yang bermasalah, bukan sekadar "kompilasi gagal".
     *
     * `infoColumns` adalah block helper, jadi dipanggil dengan `{{#...}}`;
     * memanggilnya sebagai helper biasa membuatnya mengeluh soal `$options['fn']`
     * yang tidak ada.
     *
     * @dataProvider helperNameProvider
     */
    public function test_each_registered_helper_compiles(string $name): void {
        $helpers = $this->helpers();

        $this->assertArrayHasKey($name, $helpers, "Helper '{$name}' tidak terdaftar lagi.");

        $template = $name === 'infoColumns'
            ? '{{#infoColumns value}}x{{/infoColumns}}'
            : '{{' . $name . ' "x"}}';

        $renderer = $this->compileAndEval($template, [$name => $helpers[$name]]);

        $this->assertIsString($renderer([]));
    }

    public function test_all_helpers_compile_together(): void {
        $renderer = $this->compileAndEval('{{uppercase "x"}}', $this->helpers());

        $this->assertSame('X', $renderer([]));
    }

    /**
     * companyDetail dipakai kop surat, sehingga kegagalannya berdampak pada
     * hampir seluruh template cetak. Diuji dengan data sungguhan, bukan hanya
     * kompilasinya.
     */
    public function test_company_detail_helper_reads_root_company(): void {
        $renderer = $this->compileAndEval('{{companyDetail "name"}}', $this->helpers());

        $this->assertSame('PATAYA', $renderer(['company' => ['name' => 'PATAYA']]));
    }

    public function test_uppercase_helper_returns_uppercased_value(): void {
        $renderer = $this->compileAndEval('{{uppercase value}}', $this->helpers());

        $this->assertSame('QUOTATION', $renderer(['value' => 'quotation']));
    }

    /**
     * Helper yang memanggil service lain hanya dapat meresolusinya lewat `app()`
     * dengan nama kelas lengkap, karena konteks namespace tidak ikut tersalin.
     * Nama pendek menghasilkan "Target class [X] does not exist", dan
     * lightncandy MENELAN kegagalan itu menjadi string kosong alih-alih
     * melempar — sehingga test yang hanya memeriksa "hasilnya string" tetap
     * lolos. Karena itu hasilnya harus diperiksa nilainya.
     *
     * @return array<string, array{0: string, 1: array<string, mixed>, 2: string}>
     */
    public static function serviceBackedHelperProvider(): array {
        return [
            'multiply' => ['{{multiply a b}}', ['a' => 6, 'b' => 7], '42'],
            'add'      => ['{{add a b}}', ['a' => 20, 'b' => 22], '42'],
            'subtract' => ['{{subtract a b}}', ['a' => 50, 'b' => 8], '42'],
            'divide'   => ['{{divide a b}}', ['a' => 84, 'b' => 2], '42'],
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     *
     * @dataProvider serviceBackedHelperProvider
     */
    public function test_service_backed_helper_resolves_its_dependency(
        string $template,
        array $context,
        string $expected,
    ): void {
        $renderer = $this->compileAndEval($template, $this->helpers());
        $result   = $renderer($context);

        $this->assertNotSame(
            '',
            $result,
            'Helper mengembalikan string kosong: kebergantungannya kemungkinan gagal diresolusi '
            . '(nama kelas harus lengkap, mis. \\App\\Services\\Handlebar\\ArithmeticHelperService).',
        );
        $this->assertSame($expected, $result);
    }

    /**
     * Penjaga langsung terhadap penyebabnya: closure arrow tidak boleh dipakai
     * sebagai helper, berapa pun jumlah helper yang ada. Tanpa test ini, helper
     * baru yang ditulis dengan `fn () =>` akan lolos review dan baru ketahuan
     * saat lampiran PDF gagal di produksi.
     */
    public function test_no_helper_is_defined_as_arrow_function(): void {
        $offenders = [];

        foreach ($this->helpers() as $name => $helper) {
            $reflection = new \ReflectionFunction($helper);
            $file       = $reflection->getFileName();
            $start      = $reflection->getStartLine();

            if ($file === false || $start === false) {
                continue;
            }

            $line = file($file)[$start - 1] ?? '';

            if (preg_match('/\bfn\s*\(/', $line)) {
                $offenders[] = "{$name} (baris {$start})";
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "Helper berikut memakai arrow function dan akan menggagalkan eval lightncandy: \n- "
            . implode("\n- ", $offenders)
            . "\nGunakan function () { return ...; } sebagai gantinya.",
        );
    }

    /**
     * Penjaga terhadap penyebab kedua: closure helper tersalin tanpa konteks
     * asalnya, sehingga variabel `use` tidak ikut terbawa dan pemanggilannya
     * gagal dengan "Undefined variable". Kebergantungan diambil lewat `app()`
     * di dalam badan closure.
     *
     * Yang diperiksa adalah variabel `use` dan PEMAKAIAN `$this` di dalam badan,
     * bukan keterikatan `$this` itu sendiri: closure yang ditulis di dalam
     * sebuah method selalu terikat otomatis, dan ikatan yang tidak dipakai
     * tidak menimbulkan masalah apa pun saat kodenya disalin.
     */
    public function test_no_helper_closure_captures_outer_context(): void {
        $offenders = [];

        foreach ($this->helpers() as $name => $helper) {
            $reflection = new \ReflectionFunction($helper);
            $captured   = $reflection->getStaticVariables();

            if ($captured !== []) {
                $offenders[] = $name . ' (use: ' . implode(', ', array_keys($captured)) . ')';
            }

            $file  = $reflection->getFileName();
            $start = $reflection->getStartLine();
            $end   = $reflection->getEndLine();

            if ($file === false || $start === false || $end === false) {
                continue;
            }

            $body = implode('', array_slice(file($file), $start - 1, $end - $start + 1));

            if (preg_match('/\$this\s*->/', $body)) {
                $offenders[] = $name . ' (memakai $this)';
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "Helper berikut membawa konteks dari luar dan akan gagal saat dieval lightncandy: \n- "
            . implode("\n- ", $offenders)
            . "\nAmbil kebergantungan lewat app(\\Nama\\Kelas\\Lengkap::class) di dalam closure.",
        );
    }
}
