<?php

namespace Tests\Feature\Core;

use App\Models\Core\NumberCard;
use App\Models\Core\NumberCardAssignable;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * `Shareable::scopeVisibleByShare()` — jalur TAMBAHAN visibility (OR gate),
 * bukan pengganti permission model. Test ini murni scope share-nya sendiri
 * (gate permission dicek terpisah di controller, lihat NumberCardControllerTest).
 */
class ShareableVisibilityTest extends TestCase {
    use RefreshDatabase;

    public function test_shared_all_card_is_visible(): void {
        $user = User::factory()->create();
        $card = NumberCard::create(['label' => 'Shared All', 'is_shared_all' => true]);

        $visible = NumberCard::query()->visibleByShare($user, [])->pluck('id');

        $this->assertTrue($visible->contains($card->id));
    }

    public function test_card_assigned_to_users_role_is_visible(): void {
        $user   = User::factory()->create();
        $roleId = (string) Str::ulid();
        $card   = NumberCard::create(['label' => 'Role Shared']);
        NumberCardAssignable::create([
            'number_card_id'  => $card->id,
            'assignable_type' => 'role',
            'assignable_id'   => $roleId,
        ]);

        $visible = NumberCard::query()->visibleByShare($user, [$roleId])->pluck('id');

        $this->assertTrue($visible->contains($card->id));
    }

    public function test_card_assigned_directly_to_user_is_visible(): void {
        $user = User::factory()->create();
        $card = NumberCard::create(['label' => 'User Shared']);
        NumberCardAssignable::create([
            'number_card_id'  => $card->id,
            'assignable_type' => 'user',
            'assignable_id'   => $user->id,
        ]);

        $visible = NumberCard::query()->visibleByShare($user, [])->pluck('id');

        $this->assertTrue($visible->contains($card->id));
    }

    public function test_card_assigned_to_another_user_is_not_visible(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();
        $card      = NumberCard::create(['label' => 'Other User Shared']);
        NumberCardAssignable::create([
            'number_card_id'  => $card->id,
            'assignable_type' => 'user',
            'assignable_id'   => $otherUser->id,
        ]);

        $visible = NumberCard::query()->visibleByShare($user, [])->pluck('id');

        $this->assertFalse($visible->contains($card->id));
    }

    public function test_private_unshared_card_is_not_visible_by_share(): void {
        $user = User::factory()->create();
        $card = NumberCard::create(['label' => 'Private']);

        $visible = NumberCard::query()->visibleByShare($user, [])->pluck('id');

        $this->assertFalse($visible->contains($card->id));
    }
}
