<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetCategoryAccount;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetCategoryTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function default_values_are_false(): void {
        $category = AssetCategory::factory()->create();

        $this->assertFalse($category->non_depreciable_category);
        $this->assertFalse($category->enable_cwip_accounting);
    }

    #[Test]
    public function accounts_returns_has_many_relation(): void {
        $category = new AssetCategory;

        $this->assertInstanceOf(HasMany::class, $category->accounts());
        $this->assertInstanceOf(AssetCategoryAccount::class, $category->accounts()->getRelated());
    }

    #[Test]
    public function category_name_must_be_unique(): void {
        AssetCategory::factory()->create(['category_name' => 'Unique Category']);

        $this->expectException(UniqueConstraintViolationException::class);

        AssetCategory::factory()->create(['category_name' => 'Unique Category']);
    }

    #[Test]
    public function has_form_component_property(): void {
        $category = new AssetCategory;

        $this->assertSame('Asset/Categories/Form', $category->formComponent);
    }

    #[Test]
    public function has_translate_key_property(): void {
        $category = new AssetCategory;

        $this->assertSame('asset.category', $category->translateKey);
    }

    #[Test]
    public function template_link_method_exists_and_returns_string(): void {
        $this->assertTrue(method_exists(AssetCategory::class, 'templateLink'));
        $this->assertIsString(AssetCategory::templateLink());
    }
}
