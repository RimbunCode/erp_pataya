<?php

namespace Tests\Unit\Services\Handlebar;

use App\Services\Handlebar\LabelHelperService;
use PHPUnit\Framework\TestCase;

class LabelHelperServiceTest extends TestCase {
    private LabelHelperService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new LabelHelperService;
    }

    /**
     * Test getting label for a simple field with titleTrans
     * Note: In unit tests, trans() may not work, so it should fall back to title
     */
    public function test_get_label_with_title_trans(): void {
        $columns = [
            [
                'name'       => 'customer_name',
                'titleTrans' => 'sales.customer.columns.customer_name',
                'title'      => 'Customer Name',
                'type'       => 'string',
            ],
        ];

        $label = $this->service->getLabel('customer_name', $columns, 'en');

        // In unit tests, trans() may not work, so it should fall back to title
        $this->assertEquals('Customer Name', $label);
    }

    /**
     * Test getting label for a simple field with title
     */
    public function test_get_label_with_title(): void {
        $columns = [
            [
                'name'  => 'customer_name',
                'title' => 'Customer Name',
                'type'  => 'string',
            ],
        ];

        $label = $this->service->getLabel('customer_name', $columns, 'en');

        $this->assertEquals('Customer Name', $label);
    }

    /**
     * Test getting label for a field with only name (should format it)
     */
    public function test_get_label_with_only_name(): void {
        $columns = [
            [
                'name' => 'customer_name',
                'type' => 'string',
            ],
        ];

        $label = $this->service->getLabel('customer_name', $columns, 'en');

        $this->assertEquals('Customer Name', $label);
    }

    /**
     * Test getting label for a nested relation field
     */
    public function test_get_label_for_nested_relation(): void {
        $columns = [
            [
                'name'           => 'customer',
                'type'           => 'relation',
                'nameOfFunction' => 'customer',
                'columns'        => [
                    [
                        'name'  => 'name',
                        'title' => 'Customer Name',
                        'type'  => 'string',
                    ],
                    [
                        'name'  => 'email',
                        'title' => 'Email Address',
                        'type'  => 'string',
                    ],
                ],
            ],
        ];

        $label = $this->service->getLabel('customer.name', $columns, 'en');

        $this->assertEquals('Customer Name', $label);
    }

    /**
     * Test getting label for deeply nested field
     */
    public function test_get_label_for_deeply_nested_field(): void {
        $columns = [
            [
                'name'           => 'order',
                'type'           => 'relation',
                'nameOfFunction' => 'order',
                'columns'        => [
                    [
                        'name'           => 'customer',
                        'type'           => 'relation',
                        'nameOfFunction' => 'customer',
                        'columns'        => [
                            [
                                'name'  => 'address',
                                'title' => 'Customer Address',
                                'type'  => 'string',
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $label = $this->service->getLabel('order.customer.address', $columns, 'en');

        $this->assertEquals('Customer Address', $label);
    }

    /**
     * Test getting label for non-existent field (should return field path)
     */
    public function test_get_label_for_non_existent_field(): void {
        $columns = [
            [
                'name'  => 'customer_name',
                'title' => 'Customer Name',
                'type'  => 'string',
            ],
        ];

        $label = $this->service->getLabel('non_existent_field', $columns, 'en');

        $this->assertEquals('non_existent_field', $label);
    }

    /**
     * Test getting label for invalid nested path (should return field path)
     */
    public function test_get_label_for_invalid_nested_path(): void {
        $columns = [
            [
                'name'    => 'customer',
                'type'    => 'relation',
                'columns' => [
                    [
                        'name'  => 'name',
                        'title' => 'Customer Name',
                        'type'  => 'string',
                    ],
                ],
            ],
        ];

        $label = $this->service->getLabel('customer.invalid.path', $columns, 'en');

        $this->assertEquals('customer.invalid.path', $label);
    }

    /**
     * Test getting labels for multiple fields
     */
    public function test_get_labels_for_multiple_fields(): void {
        $columns = [
            [
                'name'  => 'customer_name',
                'title' => 'Customer Name',
                'type'  => 'string',
            ],
            [
                'name'  => 'order_date',
                'title' => 'Order Date',
                'type'  => 'date',
            ],
            [
                'name'  => 'total_amount',
                'title' => 'Total Amount',
                'type'  => 'currency',
            ],
        ];

        $labels = $this->service->getLabels(
            ['customer_name', 'order_date', 'total_amount'],
            $columns,
            'en',
        );

        $this->assertEquals([
            'customer_name' => 'Customer Name',
            'order_date'    => 'Order Date',
            'total_amount'  => 'Total Amount',
        ], $labels);
    }

    /**
     * Test getting labels with mixed valid and invalid fields
     */
    public function test_get_labels_with_mixed_fields(): void {
        $columns = [
            [
                'name'  => 'customer_name',
                'title' => 'Customer Name',
                'type'  => 'string',
            ],
        ];

        $labels = $this->service->getLabels(
            ['customer_name', 'non_existent'],
            $columns,
            'en',
        );

        $this->assertEquals([
            'customer_name' => 'Customer Name',
            'non_existent'  => 'non_existent',
        ], $labels);
    }

    /**
     * Test resolving field path with nameOfFunction (relation)
     */
    public function test_resolve_field_path_with_name_of_function(): void {
        $columns = [
            [
                'name'           => 'customer',
                'type'           => 'relation',
                'nameOfFunction' => 'customer',
                'title'          => 'Customer',
                'columns'        => [
                    [
                        'name'  => 'name',
                        'title' => 'Name',
                        'type'  => 'string',
                    ],
                ],
            ],
        ];

        // Should match by nameOfFunction
        $label = $this->service->getLabel('customer.name', $columns, 'en');

        $this->assertEquals('Name', $label);
    }

    /**
     * Test empty columns array
     */
    public function test_get_label_with_empty_columns(): void {
        $label = $this->service->getLabel('any_field', [], 'en');

        $this->assertEquals('any_field', $label);
    }

    /**
     * Test empty field path
     */
    public function test_get_label_with_empty_field_path(): void {
        $columns = [
            [
                'name'  => 'customer_name',
                'title' => 'Customer Name',
                'type'  => 'string',
            ],
        ];

        $label = $this->service->getLabel('', $columns, 'en');

        $this->assertEquals('', $label);
    }

    /**
     * Test field with underscores and hyphens formatting
     */
    public function test_get_label_formats_underscores_and_hyphens(): void {
        $columns = [
            [
                'name' => 'customer_full-name',
                'type' => 'string',
            ],
        ];

        $label = $this->service->getLabel('customer_full-name', $columns, 'en');

        $this->assertEquals('Customer Full Name', $label);
    }
}
