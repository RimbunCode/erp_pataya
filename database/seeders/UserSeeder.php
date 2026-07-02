<?php

namespace Database\Seeders;

use App\FormStatus;
use App\Models\InstructorProfile;
use App\Models\StudentProfile;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserSeeder extends Seeder {
    public function run(): void {
        $roleIdsByName = Role::query()
            ->whereIn('name', ['student', 'instructor', 'organization', 'admin'])
            ->pluck('id', 'name');

        if ($roleIdsByName->count() < 4) {
            $this->command?->error('Required roles are missing. Run RoleSeeder first.');

            return;
        }

        $students = collect([
            [
                'name'     => 'Ahmad Faisal',
                'username' => 'faisal',
                'email'    => 'student@inkindo.test',
                'profile'  => [
                    'institution'       => 'Universitas Indonesia',
                    'student_id_number' => '2021420001',
                    'bio'               => 'Mahasiswa Teknik Sipil yang sedang memperdalam ilmu manajemen proyek konstruksi.',
                ],
            ],
            [
                'name'     => 'Dewi Lestari',
                'username' => 'dewi',
                'email'    => 'dewi.lestari@gmail.com',
                'profile'  => [
                    'institution'       => 'Institut Teknologi Bandung',
                    'student_id_number' => '15021045',
                    'bio'               => 'Arsitek muda yang tertarik pada desain bangunan hijau dan berkelanjutan.',
                ],
            ],
            [
                'name'     => 'Rizky Pratama',
                'username' => 'rizky',
                'email'    => 'rizky.pratama89@yahoo.com',
                'profile'  => [
                    'institution'       => 'Universitas Gadjah Mada',
                    'student_id_number' => '18/425331/TK/47882',
                    'bio'               => 'Engineer struktur yang ingin menambah sertifikasi profesional di bidang konstruksi.',
                ],
            ],
            [
                'name'     => 'Siti Nur Aisyah',
                'username' => 'siti',
                'email'    => 'siti.nuraisyah@outlook.com',
                'profile'  => [
                    'institution'       => 'Universitas Diponegoro',
                    'student_id_number' => '21010119130112',
                    'bio'               => 'Staf perencanaan proyek yang sedang belajar manajemen dan legal compliance konstruksi.',
                ],
            ],
        ]);

        $instructors = collect([
            [
                'name'     => 'Ir. Ahmad Sudirman',
                'username' => 'sudirman',
                'email'    => 'instructor@inkindo.test',
                'profile'  => [
                    'bank_name'           => 'Bank Mandiri',
                    'bank_account_number' => '1370012345678',
                    'professional_title'  => 'Senior Structural Engineer',
                    'expertise'           => 'Rekayasa Struktur, Manajemen Proyek Konstruksi',
                    'bio'                 => 'Berpengalaman lebih dari 15 tahun dalam perencanaan struktur gedung bertingkat tinggi.',
                ],
            ],
            [
                'name'     => 'Ir. Hendra Wijaya, M.T.',
                'username' => 'hendra',
                'email'    => 'hendra.wijaya.eng@gmail.com',
                'profile'  => [
                    'bank_name'           => 'Bank BCA',
                    'bank_account_number' => '4560098765432',
                    'professional_title'  => 'Project Management Consultant',
                    'expertise'           => 'Manajemen Proyek, Legal & Compliance',
                    'bio'                 => 'Konsultan manajemen proyek untuk berbagai proyek infrastruktur pemerintah dan swasta.',
                ],
            ],
            [
                'name'     => 'Ratna Kusuma, S.T., M.Ars.',
                'username' => 'ratna',
                'email'    => 'ratna.kusuma.arch@gmail.com',
                'profile'  => [
                    'bank_name'           => 'Bank BNI',
                    'bank_account_number' => '0221876543210',
                    'professional_title'  => 'Lead Architect',
                    'expertise'           => 'Arsitektur, BIM & Digital Twin, Green Building',
                    'bio'                 => 'Arsitek dengan spesialisasi desain bangunan hemat energi dan pemodelan BIM.',
                ],
            ],
            [
                'name'     => 'Bambang Setiawan, S.T.',
                'username' => 'bambang',
                'email'    => 'bambang.setiawan.k3@yahoo.com',
                'profile'  => [
                    'bank_name'           => 'Bank BRI',
                    'bank_account_number' => '0098123456789',
                    'professional_title'  => 'Safety & Compliance Trainer',
                    'expertise'           => 'Safety Engineering, K3 Konstruksi',
                    'bio'                 => 'Trainer bersertifikat K3 konstruksi dengan pengalaman audit keselamatan proyek nasional.',
                ],
            ],
        ]);

        $studentUsers    = $students->map(fn (array $data) => $this->seedUser($data));
        $instructorUsers = $instructors->map(fn (array $data) => $this->seedUser($data));

        $superAdmin = $this->seedUser([
            'name'     => 'Administrator',
            'username' => 'admin',
            'email'    => 'admin@inkindo.test',
        ]);

        $financeAdmin = $this->seedUser([
            'name'     => 'Finance Admin',
            'username' => 'finance',
            'email'    => 'finance.admin@inkindo.test',
        ]);

        $courseAdmin = $this->seedUser([
            'name'     => 'Course Admin',
            'username' => 'course',
            'email'    => 'course.admin@inkindo.test',
        ]);

        $userAdmin = $this->seedUser([
            'name'     => 'User Admin',
            'username' => 'admin.user',
            'email'    => 'user.admin@inkindo.test',
        ]);

        $contentAdmin = $this->seedUser([
            'name'     => 'Content Admin',
            'username' => 'content',
            'email'    => 'content.admin@inkindo.test',
        ]);

        foreach ($studentUsers as $index => $studentUser) {
            $this->attachRole($studentUser, (string) $roleIdsByName['student']);
            $this->seedStudentProfile($studentUser, $students[$index]['profile']);
        }

        foreach ($instructorUsers as $index => $instructorUser) {
            $this->attachRole($instructorUser, (string) $roleIdsByName['instructor']);
            $this->seedInstructorProfile($instructorUser, $instructors[$index]['profile']);
        }

        foreach ([$superAdmin, $financeAdmin, $courseAdmin, $userAdmin, $contentAdmin] as $adminUser) {
            $this->attachRole($adminUser, (string) $roleIdsByName['admin']);
        }

        $this->assignAdminPermission($superAdmin, 'super_admin');
        $this->assignAdminPermission($financeAdmin, 'finance_admin');
        $this->assignAdminPermission($courseAdmin, 'course_admin');
        $this->assignAdminPermission($userAdmin, 'user_admin');
        $this->assignAdminPermission($contentAdmin, 'content_admin');
    }

    /**
     * @param  array{name: string, username: string, email: string, profile?: array}  $attributes
     */
    private function seedUser(array $attributes): User {
        return User::query()->updateOrCreate(
            ['email' => $attributes['email']],
            [
                'name'              => $attributes['name'],
                'username'          => $attributes['username'],
                'password'          => Hash::make('password'),
                'status'            => FormStatus::ACTIVE,
                'email_verified_at' => now(),
            ],
        );
    }

    /**
     * @param  array{institution: string, student_id_number: string, bio: string}  $profile
     */
    private function seedStudentProfile(User $user, array $profile): void {
        StudentProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            $profile,
        );
    }

    /**
     * @param  array{bank_name: string, bank_account_number: string, professional_title: string, expertise: string, bio: string}  $profile
     */
    private function seedInstructorProfile(User $user, array $profile): void {
        InstructorProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            $profile,
        );
    }

    private function attachRole(User $user, string $roleId): void {
        $user->roles()->syncWithoutDetaching([$roleId]);
    }

    private function assignAdminPermission(User $user, string $permissionName): void {
        if (! Schema::hasTable('admin_user_permissions') || ! Schema::hasTable('permissions')) {
            return;
        }

        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (! is_string($permissionId) || $permissionId === '') {
            $permissionId = (string) Str::ulid();

            DB::table('permissions')->insert([
                'id'          => $permissionId,
                'module'      => 'lms',
                'name'        => $permissionName,
                'model'       => User::class,
                'route'       => 'admin.*',
                'permissions' => json_encode(['view']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $exists = DB::table('admin_user_permissions')
            ->where('user_id', $user->id)
            ->where('permission_id', $permissionId)
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('admin_user_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'user_id'       => $user->id,
            'permission_id' => $permissionId,
            'created_at'    => now(),
            'updated_at'    => now(),
            'deleted_at'    => null,
        ]);
    }
}
