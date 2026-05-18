<?php

namespace Tests\Feature\Migration;

use App\Console\Commands\RunLegacyMigrationCommand;
use ReflectionClass;
use Tests\TestCase;

class MigratorNamespaceGroupingTest extends TestCase {
    public function test_legacy_migrators_are_grouped_by_module_and_feature_namespace(): void {
        $command    = app(RunLegacyMigrationCommand::class);
        $reflection = new ReflectionClass($command);
        $property   = $reflection->getProperty('migrators');

        $migrators = $property->getValue($command);

        $this->assertIsArray($migrators);
        $this->assertNotEmpty($migrators);

        foreach ($migrators as $migratorClass) {
            $this->assertIsString($migratorClass);
            $this->assertStringContainsString('App\\Services\\Migration\\Migrators\\', $migratorClass);
            $this->assertStringNotContainsString('\\MasterData\\', $migratorClass);
            $this->assertMatchesRegularExpression('/App\\\\Services\\\\Migration\\\\Migrators\\\\[A-Z][A-Za-z0-9]*\\\\[A-Z][A-Za-z0-9]*\\\\/', $migratorClass);
            $this->assertTrue(class_exists($migratorClass), "Migrator class not found: {$migratorClass}");
        }
    }
}
