<?php

namespace Tests\Feature;

use App\Services\Core\PrintTemplate\RelationTrackerService;
use Tests\TestCase;

class RelationTrackerServiceTest extends TestCase {
    private RelationTrackerService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new RelationTrackerService;
    }

    public function test_relation_doc_category(): void {
        // {{relation doc.category}} -> "category"
        $html      = '{{relation doc.category}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('category', $relations);
    }

    public function test_doc_relation_property(): void {
        // {{doc.category.name}} -> "category" (first segment = relation, last = property)
        $html      = '{{doc.category.name}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('category', $relations);
        $this->assertNotContains('category.name', $relations);
    }

    public function test_doc_deep_relation_property(): void {
        // {{doc.purchase_request.created_by.name}} -> "purchase_request", "purchase_request.created_by"
        // (all except last segment are relations, built incrementally)
        $html      = '{{doc.purchase_request.created_by.name}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('purchase_request', $relations);
        $this->assertContains('purchase_request.created_by', $relations);
        $this->assertNotContains('purchase_request.created_by.name', $relations);
    }

    public function test_relation_doc_deep_path(): void {
        // {{relation doc.purchase_request.created_by.role}} -> "purchase_request", "purchase_request.created_by", "purchase_request.created_by.role"
        // (ALL segments are relations when using relation keyword)
        $html      = '{{relation doc.purchase_request.created_by.role}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('purchase_request', $relations);
        $this->assertContains('purchase_request.created_by', $relations);
        $this->assertContains('purchase_request.created_by.role', $relations);
    }

    public function test_doc_single_segment_is_not_relation(): void {
        // {{doc.note}} -> no relation (single segment = direct property)
        $html      = '{{doc.note}}';
        $relations = $this->service->extractRelations($html);

        $this->assertEmpty($relations);
    }

    public function test_each_with_this_relations(): void {
        // {{#each doc.items}} {{relation this.item}} {{this.note}} {{this.item.warehouse.name}} {{relation this.item.default_unit}} {{this.category.name}} {{/each}}
        // -> "items", "items.item", "items.item.warehouse", "items.item.default_unit", "items.category"
        $html = '{{#each doc.items}} {{relation this.item}} {{this.note}} {{this.item.warehouse.name}} {{relation this.item.default_unit}} {{this.category.name}} {{/each}}';

        $relations = $this->service->extractRelations($html);

        $this->assertContains('items', $relations);
        $this->assertContains('items.item', $relations);
        $this->assertContains('items.item.warehouse', $relations);
        $this->assertContains('items.item.default_unit', $relations);
        $this->assertContains('items.category', $relations);
        // {{this.note}} is single segment = property, not relation
        $this->assertNotContains('items.note', $relations);
        // "name" is property, not relation
        $this->assertNotContains('items.item.warehouse.name', $relations);
    }

    public function test_nested_each_with_relations(): void {
        // {{#each doc.purchase_request.items}} {{this.note}} {{relation this.item}} {{relation this.item.default_unit}} {{this.category.name}} {{/each}}
        // -> "purchase_request", "purchase_request.items", "purchase_request.items.item", "purchase_request.items.item.default_unit", "purchase_request.items.category"
        $html = '{{#each doc.purchase_request.items}} {{this.note}} {{relation this.item}} {{relation this.item.default_unit}} {{this.category.name}} {{/each}}';

        $relations = $this->service->extractRelations($html);

        $this->assertContains('purchase_request', $relations);
        $this->assertContains('purchase_request.items', $relations);
        $this->assertContains('purchase_request.items.item', $relations);
        $this->assertContains('purchase_request.items.item.default_unit', $relations);
        $this->assertContains('purchase_request.items.category', $relations);
        // {{this.note}} is single segment = property, not relation
        $this->assertNotContains('purchase_request.items.note', $relations);
    }

    public function test_doc_info_prefix(): void {
        // docInfo prefix should also be recognized
        $html      = '{{docInfo.owner.name}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('owner', $relations);
    }

    public function test_company_prefix(): void {
        // company prefix should also be recognized
        $html      = '{{company.address.city}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('address', $relations);
    }

    public function test_relation_with_doc_info_prefix(): void {
        $html      = '{{relation docInfo.created_by}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('created_by', $relations);
    }

    public function test_simple_this_property_inside_each_is_not_relation(): void {
        // {{this.name}} inside #each is just a property access, not a relation
        $html      = '{{#each doc.items}} {{this.name}} {{/each}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('items', $relations);
        $this->assertNotContains('items.name', $relations);
    }

    public function test_multiple_each_blocks(): void {
        $html = '{{#each doc.items}} {{relation this.product}} {{/each}} {{#each doc.taxes}} {{relation this.account}} {{/each}}';

        $relations = $this->service->extractRelations($html);

        $this->assertContains('items', $relations);
        $this->assertContains('items.product', $relations);
        $this->assertContains('taxes', $relations);
        $this->assertContains('taxes.account', $relations);
    }

    public function test_this_note_inside_each_is_not_relation(): void {
        // {{this.note}} is a single segment property, NOT a relation
        $html      = '{{#each doc.items}} {{this.note}} {{/each}}';
        $relations = $this->service->extractRelations($html);

        $this->assertContains('items', $relations);
        $this->assertNotContains('items.note', $relations);
        $this->assertCount(1, $relations);
    }
}
