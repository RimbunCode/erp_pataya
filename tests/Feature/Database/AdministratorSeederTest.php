<?php

namespace Tests\Feature\Database;

use Database\Seeders\AdministratorSeeder;
use ReflectionClass;
use Tests\TestCase;

class AdministratorSeederTest extends TestCase {
    public function test_default_roles_are_relevant_for_erp_users(): void {
        $roles             = $this->invokeSeederMethod('defaultRoles');
        $expectedRoleNames = [
            'System Manager',
            'User & Access Administrator',
            'Master Data Administrator',
            'Sales Officer',
            'Purchasing Officer',
            'Warehouse Officer',
            'Finance Officer',
            'Approver',
            'Auditor',
        ];

        $this->assertCount(9, $roles);
        $this->assertEqualsCanonicalizing($expectedRoleNames, array_column($roles, 'name'));

        $rolesByName = collect($roles)->keyBy('name');

        $this->assertEquals(['*'], $rolesByName['System Manager']['modules']);
        $this->assertEquals(['User'], $rolesByName['User & Access Administrator']['modules']);
        $this->assertEquals(['Core'], $rolesByName['Master Data Administrator']['modules']);
        $this->assertEquals(['Sales'], $rolesByName['Sales Officer']['modules']);
        $this->assertEquals(['Purchase'], $rolesByName['Purchasing Officer']['modules']);
        $this->assertEquals(['Inventory', 'Service'], $rolesByName['Warehouse Officer']['modules']);
        $this->assertEquals(['Finances'], $rolesByName['Finance Officer']['modules']);
        $this->assertEquals(['*'], $rolesByName['Auditor']['modules']);
        $this->assertEquals(
            ['Core', 'Sales', 'Purchase', 'Inventory', 'Service', 'Finances'],
            $rolesByName['Approver']['modules'],
        );
    }

    public function test_permission_profiles_map_expected_actions(): void {
        $permissionKeys = ['select', 'read', 'write', 'create', 'delete', 'submit', 'cancel', 'amend', 'print', 'import', 'export', 'share'];

        $full = $this->invokeSeederMethod('resolvePermissionFlags', $permissionKeys, 'full');
        $this->assertTrue(collect($full)->every(fn ($isAllowed) => $isAllowed === true));

        $operator = $this->invokeSeederMethod('resolvePermissionFlags', $permissionKeys, 'operator');
        $this->assertTrue($operator['create']);
        $this->assertTrue($operator['write']);
        $this->assertTrue($operator['submit']);
        $this->assertFalse($operator['delete']);

        $approval = $this->invokeSeederMethod('resolvePermissionFlags', $permissionKeys, 'approval');
        $this->assertTrue($approval['read']);
        $this->assertTrue($approval['submit']);
        $this->assertTrue($approval['cancel']);
        $this->assertFalse($approval['create']);
        $this->assertFalse($approval['write']);

        $readOnly = $this->invokeSeederMethod('resolvePermissionFlags', $permissionKeys, 'read_only');
        $this->assertTrue($readOnly['select']);
        $this->assertTrue($readOnly['read']);
        $this->assertTrue($readOnly['print']);
        $this->assertTrue($readOnly['export']);
        $this->assertFalse($readOnly['create']);
        $this->assertFalse($readOnly['write']);
        $this->assertFalse($readOnly['submit']);
    }

    /**
     * @param  array<int, mixed>  $arguments
     */
    private function invokeSeederMethod(string $methodName, mixed ...$arguments): mixed {
        $reflection = new ReflectionClass(AdministratorSeeder::class);
        $method     = $reflection->getMethod($methodName);
        $method->setAccessible(true);

        return $method->invoke(new AdministratorSeeder, ...$arguments);
    }
}
