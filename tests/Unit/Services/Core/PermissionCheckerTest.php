<?php

namespace Tests\Unit\Services\Core;

use App\Enums\Permission;
use App\Services\Core\PermissionChecker;
use PHPUnit\Framework\TestCase;

class PermissionCheckerTest extends TestCase {
    /**
     * Bangun map permissions seperti AppMiddleware::resolvePermissionsFor:
     * model => level => list of { permissions: { action: bool } }.
     *
     * @param  array<string,list<string>>  $modelActions  model => [aksi yang true]
     */
    private function checker(array $modelActions, int $level = 0): PermissionChecker {
        $permissions = [];
        foreach ($modelActions as $model => $actions) {
            $permissions[$model][$level][] = [
                'permissions' => array_fill_keys($actions, true),
            ];
        }

        return new PermissionChecker($permissions);
    }

    public function test_can_true_when_action_present(): void {
        $c = $this->checker(['Invoice' => ['write', 'read']]);
        $this->assertTrue($c->can('Invoice', Permission::Write));
        $this->assertTrue($c->can('Invoice', Permission::Read));
        $this->assertFalse($c->can('Invoice', Permission::Delete));
        $this->assertFalse($c->can('Other', Permission::Write));
    }

    public function test_leaf_single_action(): void {
        $c = $this->checker(['Invoice' => ['write']]);
        $this->assertTrue($c->satisfies([['Invoice', Permission::Write]]));   // list datar = any
        $this->assertFalse($c->satisfies([['Invoice', Permission::Delete]]));
    }

    public function test_leaf_or_actions(): void {
        // [Model, [Write, Create]] = OR antar-aksi
        $c = $this->checker(['Invoice' => ['create']]);
        $this->assertTrue($c->satisfies([['Invoice', [Permission::Write, Permission::Create]]]));

        $c2 = $this->checker(['Invoice' => ['read']]);
        $this->assertFalse($c2->satisfies([['Invoice', [Permission::Write, Permission::Create]]]));
    }

    public function test_leaf_all_actions(): void {
        // [Model, {all: [Write, Read]}] = AND antar-aksi
        $node = [['Invoice', ['all' => [Permission::Write, Permission::Read]]]];
        $this->assertTrue($this->checker(['Invoice' => ['write', 'read']])->satisfies($node));
        $this->assertFalse($this->checker(['Invoice' => ['write']])->satisfies($node));
    }

    public function test_node_any(): void {
        $node = ['any' => [['Invoice', Permission::Write], ['Order', Permission::Write]]];
        $this->assertTrue($this->checker(['Order' => ['write']])->satisfies($node));
        $this->assertFalse($this->checker(['Other' => ['write']])->satisfies($node));
    }

    public function test_node_all(): void {
        $node = ['all' => [['Invoice', Permission::Write], ['Finance', Permission::Read]]];
        $this->assertTrue($this->checker(['Invoice' => ['write'], 'Finance' => ['read']])->satisfies($node));
        $this->assertFalse($this->checker(['Invoice' => ['write']])->satisfies($node));
    }

    public function test_nested_all_of_any_and_leaf(): void {
        // (Invoice:write OR Order:write) AND Finance:read
        $node = ['all' => [
            ['any' => [['Invoice', Permission::Write], ['Order', Permission::Write]]],
            ['Finance', Permission::Read],
        ]];
        $this->assertTrue($this->checker(['Order' => ['write'], 'Finance' => ['read']])->satisfies($node));
        $this->assertFalse($this->checker(['Order' => ['write']])->satisfies($node));  // Finance:read kurang
        $this->assertFalse($this->checker(['Finance' => ['read']])->satisfies($node)); // any kurang
    }

    public function test_nested_action_inside_node(): void {
        // all: [ Invoice:(write AND read) ]
        $node = ['all' => [['Invoice', ['all' => [Permission::Write, Permission::Read]]]]];
        $this->assertTrue($this->checker(['Invoice' => ['write', 'read']])->satisfies($node));
        $this->assertFalse($this->checker(['Invoice' => ['read']])->satisfies($node));
    }

    public function test_flat_list_is_any(): void {
        // [leaf, leaf] = any
        $node = [['Invoice', Permission::Write], ['Order', Permission::Write]];
        $this->assertTrue($this->checker(['Order' => ['write']])->satisfies($node));
        $this->assertFalse($this->checker(['X' => ['write']])->satisfies($node));
    }

    public function test_empty_permissions_denies(): void {
        $c = new PermissionChecker([]);
        $this->assertFalse($c->can('Invoice', Permission::Write));
        $this->assertFalse($c->satisfies([['Invoice', Permission::Write]]));
    }
}
