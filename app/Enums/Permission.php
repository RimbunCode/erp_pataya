<?php

namespace App\Enums;

/**
 * Aksi permission per-model. String-backed agar dapat dibandingkan langsung
 * dengan key map `permissions` (RolePermission). Selaras `PermissionSeeder::$defaultPermissions`.
 */
enum Permission: string {
    case Select = 'select';
    case Read   = 'read';
    case Write  = 'write';
    case Create = 'create';
    case Delete = 'delete';
    case Submit = 'submit';
    case Cancel = 'cancel';
    case Amend  = 'amend';
    case Print  = 'print';
    case Import = 'import';
    case Export = 'export';
    case Share  = 'share';
}
