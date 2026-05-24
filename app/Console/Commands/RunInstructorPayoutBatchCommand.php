<?php

namespace App\Console\Commands;

use App\Models\User\User;
use App\Services\Finance\InstructorPayoutService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RunInstructorPayoutBatchCommand extends Command {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'finance:payouts:run-batch
                            {--actor-email= : Email admin actor untuk audit requested_by}
                            {--dry-run : Simulasikan batch tanpa membuat draft payout}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate draft instructor payout requests from eligible balances.';

    public function __construct(private InstructorPayoutService $instructorPayoutService) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int {
        $actor = $this->resolveActor();
        if (! $actor) {
            $this->error('Tidak ada admin dengan permission finance_admin/super_admin untuk menjalankan payout batch.');

            return self::FAILURE;
        }

        if ((bool) $this->option('dry-run')) {
            $preview = $this->instructorPayoutService->previewBatchDraftPayouts();

            $this->info('Payout batch dry run selesai.');
            $this->line("Actor: {$actor->email}");
            $this->line("Draft akan dibuat: {$preview['creatable']}");
            $this->line("Instructor dilewati: {$preview['skipped']}");
            $this->line('Total draft amount: ' . number_format((float) $preview['totalAmount'], 2, '.', ''));

            return self::SUCCESS;
        }

        $result = $this->instructorPayoutService->runBatchDraftPayouts($actor);

        $this->info('Payout batch selesai.');
        $this->line("Actor: {$actor->email}");
        $this->line("Draft dibuat: {$result['created']}");
        $this->line("Instructor dilewati: {$result['skipped']}");

        return self::SUCCESS;
    }

    private function resolveActor(): ?User {
        $actorEmail = trim((string) $this->option('actor-email'));
        if ($actorEmail !== '') {
            return $this->resolveActorByEmail($actorEmail);
        }

        return $this->resolveDefaultActor();
    }

    private function resolveActorByEmail(string $email): ?User {
        $user = User::query()
            ->where('email', $email)
            ->whereNull('deleted_at')
            ->first();

        if (! $user) {
            return null;
        }

        return $this->isEligibleFinanceActor($user) ? $user : null;
    }

    private function resolveDefaultActor(): ?User {
        $superAdmin = $this->queryEligibleActorByPermission('super_admin');
        if ($superAdmin) {
            return $superAdmin;
        }

        return $this->queryEligibleActorByPermission('finance_admin');
    }

    private function queryEligibleActorByPermission(string $permissionName): ?User {
        $userId = DB::table('users')
            ->join('user_role', 'user_role.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'user_role.role_id')
            ->join('admin_user_permissions', 'admin_user_permissions.user_id', '=', 'users.id')
            ->join('permissions', 'permissions.id', '=', 'admin_user_permissions.permission_id')
            ->where('roles.name', 'admin')
            ->whereNull('roles.deleted_at')
            ->whereNull('users.deleted_at')
            ->whereNull('admin_user_permissions.deleted_at')
            ->whereNull('permissions.deleted_at')
            ->where('permissions.name', $permissionName)
            ->orderBy('users.created_at')
            ->value('users.id');

        if (! is_string($userId) || $userId === '') {
            return null;
        }

        return User::query()->where('id', $userId)->first();
    }

    private function isEligibleFinanceActor(User $user): bool {
        $roles = $user->roles()->pluck('name')->map(fn ($name) => strtolower((string) $name))->all();
        if (! \in_array('admin', $roles, true)) {
            return false;
        }

        $permissions = $user->adminPermissions()->pluck('name')->map(fn ($name) => strtolower((string) $name))->all();

        return \in_array('super_admin', $permissions, true) || \in_array('finance_admin', $permissions, true);
    }
}
