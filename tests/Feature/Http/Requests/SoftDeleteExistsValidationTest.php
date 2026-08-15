<?php

namespace Tests\Feature\Http\Requests;

use App\Http\Requests\Finances\AccountRequest;
use App\Http\Requests\Inventory\ItemRequest;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Inventory\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Property 3 (Task 9.5): validasi menolak submit ke record trashed, konsisten
 * di FormRequest yang memakai ExistsExcludingTrashed. Representatif dari 3
 * modul berbeda (Finances, Inventory, Purchase) — bukan seluruh 94 baris,
 * cukup buktikan pola penerapannya bekerja benar di beberapa FormRequest nyata.
 */
class SoftDeleteExistsValidationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function rulesFor(string $requestClass, array $input = []): array {
        $request = new $requestClass;
        $request->merge($input);

        return $request->rules();
    }

    /**
     * Insert langsung ke tabel `accounts` (bypass Eloquent/nested-set) — yang
     * diuji di sini adalah rule ExistsExcludingTrashed pada AccountRequest,
     * bukan perilaku model Account itu sendiri.
     */
    private function insertAccount(string $number, ?string $deletedAt = null): string {
        $id = (string) Str::ulid();
        DB::table('accounts')->insert([
            'id'             => $id,
            'account_name'   => "Account {$number}",
            'account_number' => $number,
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
            'deleted_at'     => $deletedAt,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $id;
    }

    public function test_account_request_rejects_soft_deleted_parent_account(): void {
        $parentId = $this->insertAccount('PA-001', deletedAt: now());

        $validator = Validator::make(
            ['parent_account' => ['id' => $parentId], 'account_name' => 'Child', 'account_number' => 'CA-001'],
            $this->rulesFor(AccountRequest::class),
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('parent_account.id', $validator->errors()->toArray());
    }

    public function test_account_request_passes_for_active_parent_account(): void {
        $parentId = $this->insertAccount('PA-002');

        $validator = Validator::make(
            ['parent_account' => ['id' => $parentId], 'account_name' => 'Child', 'account_number' => 'CA-002'],
            $this->rulesFor(AccountRequest::class),
        );

        $this->assertFalse($validator->errors()->has('parent_account.id'));
    }

    public function test_item_request_rejects_soft_deleted_category(): void {
        $category = Category::create(['name' => 'Deleted Category For Item', 'type' => 'inventory']);
        $category->delete();

        $rules     = $this->rulesFor(ItemRequest::class);
        $validator = Validator::make(
            ['category' => ['id' => $category->id]],
            ['category.id' => $rules['category.id']],
        );

        $this->assertTrue($validator->fails());
    }

    public function test_purchase_order_request_rejects_soft_deleted_supplier(): void {
        // Insert langsung (bypass Eloquent/nested-set) — sama alasan seperti insertAccount().
        $supplierId = (string) Str::ulid();
        DB::table('suppliers')->insert([
            'id'         => $supplierId,
            'name'       => 'Deleted Supplier For PO',
            'deleted_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $rules     = $this->rulesFor(PurchaseOrderRequest::class, ['date' => now()->toDateString()]);
        $validator = Validator::make(
            ['supplier' => ['id' => $supplierId]],
            ['supplier.id' => $rules['supplier.id']],
        );

        $this->assertTrue($validator->fails());
    }
}
