<?php

namespace App\Support\Notifications;

class MenuNotificationMap {
    // Peta nama route -> menu_key notifikasi. Harus disinkronkan manual dengan
    // item.key di resources/js/Components/Navbar/NavConfig.jsx tiap kali ada
    // menu baru yang menjadi tujuan sebuah notifikasi (lihat menu_key di
    // app/Notifications/*.php).
    private const MAP = [
        'admin.approval'            => 'approval',
        'admin.finance'             => 'finance',
        'admin.user'                => 'user',
        'instructor.financial'      => 'financials',
        'instructor.students'       => 'student-management',
        'instructor.classes.index'  => 'manage-classes',
        'instructor.classes.show'   => 'manage-classes',
        'student.courses.index'     => 'my-courses',
    ];

    public static function menuKeyForRoute(?string $routeName): ?string {
        return self::MAP[$routeName] ?? null;
    }
}
