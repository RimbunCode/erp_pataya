<?php

namespace App\Http\Controllers\Core;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\DashboardRequest;
use App\Models\Core\Dashboard;
use App\Models\Model;
use App\Services\Core\PermissionChecker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

class DashboardController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Dashboard::class);
    }

    protected function exceptPermission(string $method) {
        if ($method == 'quickList') {
            return true;
        }
    }

    /**
     * number-card-chart-redesign: `widget_id` (Widget lama) sudah tidak
     * ada. Form legacy ini (Settings/Dashboard/Form.jsx) tidak punya
     * selector type per baris (peninggalan sebelum entity Chart/NumberCard
     * dipisah) — picker-nya sudah diarahkan ke NumberCardLinkModel, jadi
     * di sini konsisten diarahkan ke `number_card_id` saja. TIDAK
     * dimodernisasi lebih lanjut (halaman ini sudah stale sejak
     * desk-dashboard-builder — width string vs kolom integer sekarang,
     * di luar scope spec ini).
     */
    private function fillWidgetRelation(array $data, Dashboard $dashboard) {
        $data['number_card_id'] = $data['widget']['id'];

        return $data;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Dashboard::dataTable($request);

        return Inertia::render(
            'Settings/Dashboard/Index',
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Dashboard/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(DashboardRequest $request) {
        $data                  = $request->validated();
        $data['created_by_id'] = $request->user()->id;
        DB::beginTransaction();
        $dashboard = Dashboard::create($data);

        foreach ($data['widgets'] as $idx => $widget) {
            $widget['order'] = $idx;
            $widget          = $this->fillWidgetRelation($widget, $dashboard);
            $widget          = $dashboard->widgets()->create($widget);

            $widget->refresh();

        }
        DB::commit();

        return redirect()->back()->with('id', $dashboard->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Dashboard $dashboard) {
        $this->setBreadcrumbs($dashboard);
        $dashboard->showDetail();

        return Inertia::render('Settings/Dashboard/Show', [
            'dashboard' => function () use ($dashboard) {
                $dashboard->loadRelations();

                return $dashboard;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Dashboard $dashboard) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(DashboardRequest $request, Dashboard $dashboard) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['created_by_id'] = $request->user()->id;
        $dashboard->widgets()
            ->whereNotIn('id', array_column($data['widgets'], 'id'))
            ->delete();
        $widgetIds = collect($data['widgets'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingWidgets = $dashboard->widgets()
            ->whereIn('id', $widgetIds)
            ->get()
            ->keyBy('id');
        foreach ($data['widgets'] as $idx => $widget) {
            $widget['order'] = $idx;
            $widget          = $this->fillWidgetRelation($widget, $dashboard);
            $dashboardWidget = null;
            if (Ulid::isValid($widget['id'])) {
                $dashboardWidget = $existingWidgets->get($widget['id']);
                if ($dashboardWidget) {
                    $dashboardWidget->fill($widget);
                    $dashboardWidget->save();
                }
            } else {
                $dashboardWidget = $dashboard->widgets()->create($widget);
            }

            $dashboardWidget?->refresh();
        }
        $dashboard->fillForUpdate($data);
        DB::commit();

        return redirect()->back();
    }

    /**
     * Operator yang diterima dari FilterTable2 (flattenFilters) dan cara
     * menerapkannya ke query builder — whitelist eksplisit, BUKAN
     * interpolasi operator bebas (cegah SQL injection via operator field).
     */
    private const FILTER_OPERATORS = [
        '='      => 'where',
        '!='     => 'where',
        '>'      => 'where',
        '>='     => 'where',
        '<'      => 'where',
        '<='     => 'where',
        'like'   => 'where',
        'in'     => 'whereIn',
        'not_in' => 'whereNotIn',
    ];

    /**
     * Feedback user: Quick List — filter mirip FilterTable2 (DataTable2),
     * kolom yang ditampilkan bisa dipilih (termasuk kolom relasi singular,
     * mis. `customer`), resize half/full (murni FE, tidak mempengaruhi
     * endpoint ini), pagination server-side (`limit` = ukuran per halaman).
     * `filters` array of triples [field, operator, value] (hasil
     * flattenFilters di FE, AND semua kondisi — Quick List sengaja tidak
     * dukung nested group/OR kompleks, widget kecil bukan listing DataTable
     * penuh — filter & sort HANYA berlaku ke kolom fisik, relasi tidak
     * bisa difilter/diurutkan dari sini).
     */
    public function quickList(Request $request) {
        // Feedback user: model class di BODY (bukan URL segment) — pola
        // umum REST utk data request, dan tak perlu whitelist regex `.*`
        // route hanya utk menampung backslash namespace PHP.
        $config = $request->validate([
            'model'          => ['required', 'string'],
            'filters'        => ['nullable', 'array'],
            'filters.*'      => ['array', 'size:3'],
            'columns'        => ['nullable', 'array'],
            'columns.*'      => ['string'],
            'sort_by'        => ['nullable', 'string'],
            'sort_direction' => ['nullable', 'in:asc,desc'],
            'limit'          => ['nullable', 'integer', 'min:1', 'max:20'],
            'page'           => ['nullable', 'integer', 'min:1'],
        ]);

        $modelClass = str_replace('/', '\\', $config['model']);

        if (! class_exists($modelClass) || ! is_subclass_of($modelClass, Model::class)) {
            abort(404);
        }

        $checker = PermissionChecker::forUser($request);
        if (! $checker->can($modelClass, Permission::Select)) {
            return response()->json($this->emptyQuickListPage());
        }

        $instance = new $modelClass;
        $table    = $instance->getTable();
        // Primary key TIDAK selalu 'id' di codebase ini (mis. countries
        // pakai kolom lain) — bug nyata: hardcode 'id' bikin query 500
        // "Unknown column 'id'". Ambil dari model, dan kalau kolomnya
        // memang tidak ada di tabel, jangan paksa disertakan.
        $keyName     = $instance->getKeyName();
        $hasKeyCol   = $keyName && Schema::hasColumn($table, $keyName);
        $defaultSort = Schema::hasColumn($table, 'created_at')
            ? 'created_at'
            : ($hasKeyCol ? $keyName : null);

        $sortBy = ($config['sort_by'] ?? null) && Schema::hasColumn($table, $config['sort_by'])
            ? $config['sort_by']
            : $defaultSort;

        // Kolom yang boleh muncul di response DIBATASI whitelist: kolom fisik
        // tabel asli (Schema::hasColumn) ATAU kolom relasi singular yang
        // dikenal metadata model (getColumns) DAN user punya izin Select ke
        // model relasi-nya — cegah widget membocorkan model yang tidak
        // seharusnya bisa dilihat pembuatnya.
        // maxDepth=1 (BUKAN default/0): docblock getColumns() menyatakan
        // "0 = unlimited" — bug nyata ditemukan saat verifikasi manual:
        // dipanggil tanpa argumen bikin request macet 30 detik lalu 500
        // pada model dgn graf relasi besar (mis. SalesOrder), krn rekursi
        // relasi-dari-relasi tanpa batas. maxDepth=1 (satu level saja,
        // cukup utk quickList) SAMA PERSIS dgn yang dipakai
        // ModelController::columns() — endpoint model.columns yang sudah
        // terbukti aman & dipakai frontend utk sumber metadata yang sama.
        $columnMeta = collect($modelClass::getColumns(1))->keyBy('name');
        $requested  = collect($config['columns'] ?? []);

        $physicalColumns = $requested
            ->filter(fn ($col) => Schema::hasColumn($table, $col))
            ->values();

        $relationColumns = $requested
            ->map(fn ($col) => $columnMeta->get($col))
            ->filter(fn ($meta) => ($meta['type'] ?? null) === 'relation')
            ->filter(fn ($meta) => $checker->can($meta['related'], Permission::Select))
            ->values();

        if ($physicalColumns->isEmpty() && $hasKeyCol) {
            $physicalColumns = collect([$keyName]);
        }
        if ($hasKeyCol && ! $physicalColumns->contains($keyName)) {
            $physicalColumns->prepend($keyName);
        }
        if ($physicalColumns->isEmpty() && $relationColumns->isEmpty()) {
            return response()->json($this->emptyQuickListPage());
        }

        $query = $modelClass::query();
        if ($relationColumns->isNotEmpty()) {
            $query->with($relationColumns->pluck('nameOfFunction')->all());
        }

        foreach ($config['filters'] ?? [] as [$field, $operator, $value]) {
            if (! Schema::hasColumn($table, $field)) {
                continue;
            }
            $method = self::FILTER_OPERATORS[$operator] ?? null;
            if ($method === null) {
                continue;
            }
            if ($method === 'where' && in_array($operator, ['=', '!=', '>', '>=', '<', '<='], true)) {
                $query->where($field, $operator, $value);
            } elseif ($method === 'where' && $operator === 'like') {
                $query->where($field, 'like', "%{$value}%");
            } else {
                $query->{$method}($field, (array) $value);
            }
        }

        if ($sortBy !== null) {
            $query->orderBy($sortBy, $config['sort_direction'] ?? 'desc');
        }

        // Bug KEAMANAN ditemukan (feedback user): quickList() dibangun query
        // manual sendiri, TIDAK lewat macro DataTable::dataTable() — dua
        // aturan visibility yang WAJIB berlaku di listing manapun jadi
        // terlewat sama sekali:
        // 1) Submitable: dokumen draft (belum disubmit) HANYA boleh
        //    terlihat oleh pembuatnya sendiri — draft user lain harus
        //    tersembunyi walau user punya izin Select model tsb.
        // 2) onlyCreator: bila SATU-SATUNYA izin Select user berasal dari
        //    role yang only_creator-scoped, listing wajib terbatas ke
        //    baris miliknya sendiri (parity dgn Controller::guard() yang
        //    otomatis jalan di listing biasa lewat constructor-middleware
        //    — TIDAK berlaku di sini krn quickList() dikecualikan dari
        //    guard itu, model-nya dinamis per-request, bukan $this->model
        //    tetap satu per-controller).
        // Scope SAMA seperti DataTableScope::addDataTable(): hanya query
        // ROOT model, TIDAK direkursi ke kolom relasi (DataTableScope
        // sendiri juga tidak melakukan itu di with()-nya).
        if ($instance->isSubmitable()) {
            $query->where(function ($q) use ($request) {
                $q->whereNotNull('submitted_at');
                $q->orWhere('created_by_id', $request->user()->id);
            });
        }
        if (Schema::hasColumn($table, 'created_by_id') && $checker->isOnlyCreator($modelClass, Permission::Select)) {
            $query->where('created_by_id', $request->user()->id);
        }

        // Tidak lagi membatasi SELECT ke kolom fisik terpilih: begitu kolom
        // relasi ikut di-with(), Eloquent butuh FK-nya ikut ke-select juga —
        // widget dashboard maksimal 20 baris/halaman, jadi ambil baris utuh
        // lalu susun response secara eksplisit (lihat mapWithKeys di bawah)
        // jauh lebih sederhana drpd menghitung FK per tipe relasi manual.
        $perPage   = $config['limit'] ?? 5;
        $paginator = $query->paginate($perPage, ['*'], 'page', $config['page'] ?? 1);

        $needsTemplateLink = method_exists($modelClass, 'templateLink')
            && $requested->contains(fn ($col) => ($columnMeta->get($col)['type'] ?? null) === 'image');

        // Kolom `isLink` (mis. 'code') butuh created_by_id row utk cek izin
        // "read" onlyCreator-scoped di FE (Cell Table2: can("read", {user_id:
        // row?.created_by_id})) — sama seperti templateLink, hanya
        // disertakan BILA benar-benar dibutuhkan (ada kolom isLink diminta),
        // bukan whitelist kolom melebar diam-diam.
        $needsCreatedById = Schema::hasColumn($table, 'created_by_id')
            && $requested->contains(fn ($col) => ($columnMeta->get($col)['isLink'] ?? false) === true);

        // Kolom bertipe formStatus/formStatuses (mis. 'status') di Cell
        // Table2 TIDAK baca kolom aslinya — dia baca accessor `appendStatus`
        // (gabungan status dasar + status tambahan per model). Tanpa ini,
        // FE crash ("Cannot read properties of undefined (reading 'length')")
        // krn Cell langsung panggil `.length` pada `row.appendStatus` yang
        // tak pernah ada di response.
        $needsAppendStatus = $requested->contains(
            fn ($col) => in_array($columnMeta->get($col)['type'] ?? null, ['formStatus', 'formStatuses'], true),
        );

        // Model di codebase ini punya $appends (accessor: canDelete, route,
        // thisModel, dst) yang IKUT ter-serialize secara default — buang di
        // baris ROOT supaya response terkunci ke kolom yang eksplisit
        // dipilih widget (dibangun manual di bawah, bukan dari toArray()).
        // Object RELASI child SENGAJA TIDAK ikut di-strip: appends bawaannya
        // (a.l. templateLink, thisModel) dipakai convertTemplateLink() &
        // navigasi Link di frontend utk merender/mengarahkan relasi.
        $paginator->getCollection()->each(fn ($row) => $row->setAppends([]));

        $data = $paginator->getCollection()->map(function ($row) use ($physicalColumns, $relationColumns, $needsTemplateLink, $needsCreatedById, $needsAppendStatus) {
            $out = $physicalColumns->mapWithKeys(fn (string $col) => [$col => $row->{$col}])->all();
            foreach ($relationColumns as $meta) {
                $out[$meta['name']] = $row->{$meta['nameOfFunction']};
            }
            if ($needsTemplateLink) {
                $out['templateLink'] = $row->templateLink;
            }
            if ($needsCreatedById) {
                $out['created_by_id'] = $row->created_by_id;
            }
            if ($needsAppendStatus) {
                $out['appendStatus'] = $row->appendStatus;
            }

            return $out;
        });

        return response()->json([
            'data'         => $data,
            'total'        => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ]);
    }

    /**
     * @return array{data: array, total: int, current_page: int, last_page: int}
     */
    private function emptyQuickListPage(): array {
        return ['data' => [], 'total' => 0, 'current_page' => 1, 'last_page' => 1];
    }
}
