<?php

namespace App\Traits;

use App\Models\User\User;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;

trait BackupDatabase {
    protected function performBackup(User $user) {
        try {
            $connection = config('database.default');
            $appName    = config('app.name');
            $database   = config("database.connections.$connection.database");
            $username   = config("database.connections.$connection.username");
            $password   = config("database.connections.$connection.password");
            $host       = config("database.connections.$connection.host");
            $port       = config("database.connections.$connection.port");

            // Backup filename
            $filename = "{$appName}_backup_" . Carbon::now()->format('ymd_His') . '.sql';
            $filepath = storage_path("app/private/backups/$filename");

            $command = "mysqldump --user=$username --password=$password --host=$host --port=$port --single-transaction --quick --lock-tables=false $database | gzip > $filepath";

            exec($command, $output, $resultCode);

            if ($resultCode) {
                Log::error("Backup database failed for {$user->id}: " . implode("\n", $output));
                throw new Exception('Backup database failed');
            }

            return $filename;
        } catch (Exception $e) {
            Log::error("Backup database failed for {$user->id}: " . implode("\n", $output));
            throw $e;
        }
    }
}
