<?php

namespace Tests\Feature\Core\Notification;

use App\Models\Asset\AssetService;
use App\Models\User\User;
use App\Services\Core\Mention\MentionAudienceResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Support\GrantsDocumentAccess;
use Tests\TestCase;

class MentionAudienceTest extends TestCase {
    use GrantsDocumentAccess;
    use RefreshDatabase;

    private User $actor;

    protected function setUp(): void {
        parent::setUp();

        $this->prepareDocumentPermission();
        $this->actor = User::factory()->create(['name' => 'Aktor Utama']);
    }

    private function asActor(): static {
        return $this
            ->withSession($this->actorSession())
            ->withCookie('lang', 'en')
            ->actingAs($this->actor);
    }

    /**
     * Meniru panggilan axios dari Comments.jsx (XHR + JSON). Sengaja bukan getJson():
     * helper itu mengirim cookie `lang` tanpa dienkripsi sehingga LanguageMiddleware
     * mengalihkan ke /lang.
     *
     * @param  array<string, mixed>  $query
     */
    private function getAutocomplete(array $query): TestResponse {
        return $this->asActor()->get(route('users.index', $query), [
            'Accept'           => 'application/json',
            'X-Requested-With' => 'XMLHttpRequest',
        ]);
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<int, string>
     */
    private function candidateIds(array $query): array {
        $response = $this->getAutocomplete($query)->assertOk();

        return collect($response->json())->pluck('id')->sort()->values()->all();
    }

    public function test_resolver_filters_candidates_with_single_bulk_query(): void {
        $reader     = User::factory()->create();
        $ownerOnly  = User::factory()->create();
        $noAccess   = User::factory()->create();
        $wrongLevel = User::factory()->create();
        $this->grantDocumentAccess($reader);
        $this->grantDocumentAccess($ownerOnly, onlyCreator: true);
        $this->grantDocumentAccess($wrongLevel, level: 1);

        $candidates = [$reader->id, $ownerOnly->id, $noAccess->id, $wrongLevel->id];

        DB::enableQueryLog();
        $allowed = app(MentionAudienceResolver::class)->readableBy(AssetService::class, null, $candidates);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([$reader->id], $allowed);
        $this->assertCount(1, $queries);

        $this->assertEqualsCanonicalizing(
            [$reader->id, $ownerOnly->id],
            app(MentionAudienceResolver::class)->readableBy(AssetService::class, $ownerOnly->id, $candidates),
        );
    }

    public function test_resolve_model_class_rejects_unsafe_input(): void {
        $resolver = app(MentionAudienceResolver::class);

        $this->assertSame(AssetService::class, $resolver->resolveModelClass(AssetService::class));
        $this->assertNull($resolver->resolveModelClass(null));
        $this->assertNull($resolver->resolveModelClass(''));
        $this->assertNull($resolver->resolveModelClass('Not\\A\\Real\\Class'));
        // Class nyata tapi bukan model Eloquent.
        $this->assertNull($resolver->resolveModelClass(\stdClass::class));
        // Model Eloquent nyata tapi tidak terdaftar di tabel permissions.
        $this->assertNull($resolver->resolveModelClass(User::class));
    }

    public function test_users_index_without_document_context_is_unchanged(): void {
        $reader   = User::factory()->create();
        $noAccess = User::factory()->create();
        $this->grantDocumentAccess($reader);

        $ids = $this->candidateIds([]);

        $this->assertContains($reader->id, $ids);
        $this->assertContains($noAccess->id, $ids);
        $this->assertContains($this->actor->id, $ids);
    }

    public function test_users_index_restricts_candidates_to_document_readers(): void {
        $reader   = User::factory()->create(['name' => 'Pembaca Satu']);
        $noAccess = User::factory()->create(['name' => 'Pembaca Dua']);
        $this->grantDocumentAccess($reader);
        $order = $this->makeDocument();

        $ids = $this->candidateIds([
            'search'         => 'Pembaca',
            'document_model' => AssetService::class,
            'document_id'    => $order->id,
        ]);

        $this->assertSame([$reader->id], $ids);
        $this->assertNotContains($noAccess->id, $ids);
    }

    public function test_users_index_only_creator_candidate_appears_only_for_own_document(): void {
        $ownerOnly = User::factory()->create(['name' => 'Pemilik Saja']);
        $this->grantDocumentAccess($ownerOnly, onlyCreator: true);

        $othersOrder = $this->makeDocument();
        $ownOrder    = $this->makeDocument($ownerOnly->id);

        $this->assertSame([], $this->candidateIds([
            'search'         => 'Pemilik Saja',
            'document_model' => AssetService::class,
            'document_id'    => $othersOrder->id,
        ]));
        $this->assertSame([$ownerOnly->id], $this->candidateIds([
            'search'         => 'Pemilik Saja',
            'document_model' => AssetService::class,
            'document_id'    => $ownOrder->id,
        ]));
    }

    public function test_users_index_rejects_invalid_document_model(): void {
        foreach ([\stdClass::class, 'Not\\A\\Real\\Class', User::class] as $badModel) {
            $this->getAutocomplete(['document_model' => $badModel, 'document_id' => 'x'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('document_model');
        }
    }
}
