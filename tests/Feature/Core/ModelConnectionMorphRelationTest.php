<?php

namespace Tests\Feature\Core;

use App\Models\Core\ModelConnection;
use App\Models\User\User;
use Tests\TestCase;

class ModelConnectionMorphRelationTest extends TestCase {
    public function test_link_model_trait_connections_query_uses_model_and_reference_pairs(): void {
        $model     = new User;
        $model->id = '01K4AZ3RJ7AHWYY0FQH0VSM9TK';

        $query = $model->connections();

        $this->assertSame(ModelConnection::class, $query->getModel()::class);
        $this->assertCount(7, $query->getBindings());
        $this->assertStringContainsString('model_type', $query->toSql());
        $this->assertStringContainsString('model_id', $query->toSql());
        $this->assertStringContainsString('reference_type', $query->toSql());
        $this->assertStringContainsString('reference_id', $query->toSql());
    }

    public function test_model_connection_morph_relations_use_custom_columns(): void {
        $connection = new ModelConnection;

        $modelRelation     = $connection->model();
        $referenceRelation = $connection->reference();

        $this->assertSame('model_type', $modelRelation->getMorphType());
        $this->assertSame('model_id', $modelRelation->getForeignKeyName());
        $this->assertSame('reference_type', $referenceRelation->getMorphType());
        $this->assertSame('reference_id', $referenceRelation->getForeignKeyName());
    }
}
