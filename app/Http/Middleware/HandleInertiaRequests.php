<?php

namespace App\Http\Middleware;

use App\Models\Core\Country;
use App\Models\Core\Preference;
use App\Models\User\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware {
    private const SESSION_PREFERENCES_KEY         = 'preferences';
    private const SESSION_PREFERENCES_VERSION_KEY = 'preferences_version';
    private const SESSION_USER_ROLE_IDS_KEY       = 'shared_user_role_ids';
    private const SESSION_USER_ROLE_VERSION_KEY   = 'shared_user_role_ids_version';
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array {
        $isDebug    = config('app.debug');
        $flashKeys  = $request->session()->has('_flash') ? $request->session()->get('_flash')['old'] : [];
        $user       = $request->user();
        $sharedUser = null;

        if ($user) {
            $roleIds = $this->resolveSharedUserRoleIds($request, $user);
            $user->setAttribute('id_roles', $roleIds);
            $user->syncOriginalAttribute('id_roles');
            $sharedUser = $user->toArray();
        }

        return [
            ...parent::share($request),
            'auth'        => [
                'user' => $sharedUser,
            ],
            'lang'        => $request->cookie('lang') ?? 'en',
            'ziggy'       => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
                'query'    => \count($request->query()) > 0 ? $request->query() : null,
            ],
            'flash'       => \array_filter(
                $request->session()->all(),
                fn ($key) => \in_array($key, $flashKeys),
                \ARRAY_FILTER_USE_KEY,
            ),
            ...($isDebug ? ['debug' => $isDebug] : []),
            'preferences' => fn () => $this->resolveSharedPreferences($request),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveSharedPreferences(Request $request): array {
        $latestVersion = $this->resolvePreferencesVersion();
        $cachedVersion = $request->session()->get(self::SESSION_PREFERENCES_VERSION_KEY);
        $cachedPayload = $request->session()->get(self::SESSION_PREFERENCES_KEY);

        if (\is_array($cachedPayload) && $cachedVersion === $latestVersion) {
            return $cachedPayload;
        }

        $preferences = Preference::select('key', 'value', 'updated_at')->get();
        $payload     = $this->buildPreferencesPayload($preferences);

        $request->session()->put(self::SESSION_PREFERENCES_KEY, $payload);
        $request->session()->put(self::SESSION_PREFERENCES_VERSION_KEY, $latestVersion);

        return $payload;
    }

    private function resolvePreferencesVersion(): string {
        $version = Preference::query()
            ->selectRaw('COUNT(`key`) as preference_count')
            ->selectRaw('MAX(updated_at) as max_updated_at')
            ->first();

        return implode('|', [
            (string) ($version?->preference_count ?? 0),
            (string) ($version?->max_updated_at ?? '0'),
        ]);
    }

    /**
     * @return string[]
     */
    private function resolveSharedUserRoleIds(Request $request, User $user): array {
        $latestVersion = $this->resolveUserRoleVersion($user);
        $cachedVersion = $request->session()->get(self::SESSION_USER_ROLE_VERSION_KEY);
        $cachedRoleIds = $request->session()->get(self::SESSION_USER_ROLE_IDS_KEY);

        if (\is_array($cachedRoleIds) && $cachedVersion === $latestVersion) {
            return $cachedRoleIds;
        }

        $roleIds = $user->idRoles()->pluck('roles.id')->all();

        $request->session()->put(self::SESSION_USER_ROLE_IDS_KEY, $roleIds);
        $request->session()->put(self::SESSION_USER_ROLE_VERSION_KEY, $latestVersion);

        return $roleIds;
    }

    private function resolveUserRoleVersion(User $user): string {
        $version = DB::table('user_role')
            ->join('roles', 'roles.id', '=', 'user_role.role_id')
            ->where('user_role.user_id', $user->getKey())
            ->whereNull('roles.deleted_at')
            ->selectRaw('COUNT(roles.id) as role_count')
            ->selectRaw('MAX(user_role.updated_at) as max_pivot_updated_at')
            ->selectRaw('MAX(roles.updated_at) as max_role_updated_at')
            ->first();

        return implode('|', [
            (string) ($version?->role_count ?? 0),
            (string) ($version?->max_pivot_updated_at ?? '0'),
            (string) ($version?->max_role_updated_at ?? '0'),
        ]);
    }

    /**
     * @param  Collection<int, Preference>  $preferences
     * @return array<string, mixed>
     */
    private function buildPreferencesPayload(Collection $preferences): array {
        $lastUpdatedAt = $preferences->pluck('updated_at')->max();
        $preferences   = $preferences->pluck('value', 'key');
        $countryId     = $preferences->get('country_id');
        $countryName   = $countryId !== null
            ? Country::query()->whereKey($countryId)->value('name')
            : null;

        return [
            ...$preferences->all(),
            'country_name' => $countryName,
            'updated_at'   => $lastUpdatedAt,
        ];
    }
}
