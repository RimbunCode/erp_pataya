<?php

use App\Services\Finances\Ledger\Iso4217;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Daftar ISO 4217 lengkap (kode numerik dan minor unit) ada di `Iso4217` (statis). Mata uang yang tidak ada di
     * daftar itu tetap memakai default `minor_unit` = 2 dan `numeric_code` null (Requirement 7.2; keputusan Q-P1-4,
     * 2026-11-04). `CountrySeeder` memakai daftar yang sama untuk mata uang yang di-seed setelah migration ini.
     */
    public function up(): void {
        if (! Schema::hasColumn('currencies', 'minor_unit')) {
            Schema::table('currencies', function (Blueprint $table) {
                $table->unsignedSmallInteger('minor_unit')->default(2);
            });
        }
        if (! Schema::hasColumn('currencies', 'numeric_code')) {
            Schema::table('currencies', function (Blueprint $table) {
                $table->string('numeric_code', 3)->nullable();
            });
        }

        // Idempoten: hanya menulis ulang nilai yang sama untuk kode yang sudah ada.
        foreach (Iso4217::all() as $code => [$numericCode, $minorUnit]) {
            DB::table('currencies')->where('code', $code)->update([
                'numeric_code' => $numericCode,
                'minor_unit'   => $minorUnit,
            ]);
        }
    }

    public function down(): void {
        Schema::table('currencies', function (Blueprint $table) {
            $table->dropColumn(['minor_unit', 'numeric_code']);
        });
    }
};
