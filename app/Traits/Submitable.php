<?php

namespace App\Traits;

use App\Casts\FormStatusesCast;
use App\Casts\Json;
use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\AuditableModelSaved;
use App\Events\Core\DocumentCanceled;
use App\Events\Core\DocumentStatusChanged;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\User\User;
use App\Services\Core\Approval\ApprovalService;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

trait Submitable {
    use DataTable, HasBranch;

    protected static bool $is_submitable = true;

    /**
     * Role-based document notification config: status value (string) =>
     * daftar nama role yang dinotifikasi saat dokumen transisi ke status
     * itu. Kosong secara default — model submitable override method ini
     * kalau perlu notifikasi role-based (mis. Warehouse dinotifikasi saat
     * SalesOrder disubmit). Method (bukan property) dipakai karena PHP
     * tidak mengizinkan override langsung static property trait di class
     * yang memakainya (fatal error "definition differs").
     *
     * @return array<string, array<int, string>>
     */
    protected static function notifyRolesOnStatus(): array {
        return [];
    }

    public function initializeSubmitable() {
        $this->mergeCasts([
            'status'          => FormStatusesCast::class,
            'additional_data' => Json::class,
            'submitted_at'    => 'datetime',
            'canceled_at'     => 'datetime',
            'amended_from_id' => 'string',
        ]);
        $this->with = [
            ...$this->with ?? [],
            'createdBy',
        ];
    }

    public static function bootSubmitable() {
        self::creating(function ($model) {
            if (! ($model->isSubmitable() ?? false)) {
                return;
            }
            if ($model->status == null) {
                $model->status = FormStatus::DRAFT;
            }
            if ($model->created_by_id == null) {
                $model->created_by_id = Auth::id();
            }
        });
        self::saving(function ($model) {
            if (! ($model->isSubmitable() ?? false)) {
                return;
            }

            if ($model->status == null) {
                $model->status = FormStatus::DRAFT;
            }

            static $submittedFormatColumnCache = [];
            $tableName                         = $model->getTable();
            $hasSubmittedFormatColumn          = $submittedFormatColumnCache[$tableName] ??= Schema::hasColumn($tableName, 'submitted_format');
            if ($hasSubmittedFormatColumn && $model->isDirty('code')) {
                $latestFormat = FormatingSeries::where('model', $model::class)->value('format');
                if (is_string($latestFormat) && trim($latestFormat) !== '') {
                    $model->submitted_format = $latestFormat;
                }
            }

            if (! \in_array(FormStatus::DRAFT, $model->status)) {
                $model->submitted_at = now();
            }
            if (\in_array(FormStatus::CANCELED, $model->status) && $model->isDirty('status')) {
                $model->canceled_at = now();
                GeneralLedger::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
                StockLedgerEntry::where('referenceable_type', get_class($model))->where('referenceable_id', $model->id)->update([
                    'deleted_at' => now(),
                ]);
            }
        });

        // Cascade update status step ke CANCELED + notifikasi ApprovalCanceledNotification
        // ke approver kandidat ditangani lewat event DocumentCanceled + listener
        // CancelPendingApprovalSteps (ShouldQueue). Dispatch di sini, setelah save()
        // sukses — supaya tidak terkirim untuk save yang gagal.
        self::saved(function ($model) {
            if (! ($model->isSubmitable() ?? false) || ! $model->wasChanged('status')) {
                return;
            }
            if (! \in_array(FormStatus::CANCELED, $model->status)) {
                return;
            }

            $approval = $model->approvalable;
            if (! $approval) {
                return;
            }

            event(new DocumentCanceled($model, $approval));
        });

        // Role-based document notification: model submitable meng-override
        // notifyRolesOnStatus() untuk menentukan role mana yang dinotifikasi
        // saat dokumen transisi ke status tertentu. Notifikasi dikirim lewat
        // event DocumentStatusChanged + listener NotifyRoleOnStatusChange (ShouldQueue).
        self::saved(function ($model) {
            if (! ($model->isSubmitable() ?? false) || ! $model->wasChanged('status')) {
                return;
            }

            $config = static::notifyRolesOnStatus();
            $roles  = [];
            foreach ($model->status as $statusValue) {
                $roles = [...$roles, ...($config[$statusValue->value] ?? [])];
            }
            $roles = array_unique($roles);

            if ($roles === []) {
                return;
            }

            event(new DocumentStatusChanged($model, $roles));
        });
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function approvalable() {
        return $this->morphOne(ApprovalInstance::class, 'document', 'document_type', 'document_id');
    }

    protected function getCanCancelAttribute(): bool {
        $condition = ! \in_array(FormStatus::DRAFT, (array) $this->status)
            && ! \in_array(FormStatus::CANCELED, (array) $this->status);
        if (! \method_exists(static::class, 'canCancel')) {
            return $condition;
        }

        return $condition && $this->canCancel();
    }

    public function amendedFrom() {
        return $this->belongsTo(\get_class($this), 'amended_from_id');
    }

    public function checkApproval(array $options = [], string $triggerOn = 'submit') {
        if (! \property_exists(static::class, 'service')) {
            throw new \LogicException(
                static::class . ' harus mendeklarasikan property $service untuk memakai checkApproval().',
            );
        }

        if (! \is_subclass_of(static::$service, SubmitableService::class)) {
            throw new \LogicException(
                static::$service . ' harus implement ' . SubmitableService::class . '.',
            );
        }

        return DB::transaction(function () use ($options, $triggerOn) {
            $result = app(ApprovalService::class)->check($this, static::$service, $options, $triggerOn);
            event(new AuditableModelSaved($this, 'submitted'));
            DB::commit();

            return $result;
        });
    }

    /**
     * Nama kolom generated/computed (storedAs/virtualAs) milik tabel, di-cache
     * per-request karena Schema::getColumns() query ke information_schema/
     * pragma_table_xinfo tiap dipanggil. Kolom ini wajib di-exclude dari
     * replicate() — DB (MySQL STORED maupun SQLite) menolak INSERT eksplisit
     * ke kolom generated.
     *
     * @return array<int, string>
     */
    protected static function generatedColumnsOf(string $table): array {
        static $cache = [];

        return $cache[$table] ??= collect(Schema::getColumns($table))
            ->filter(fn (array $column) => $column['generation'] !== null)
            ->pluck('name')
            ->all();
    }

    /**
     * Nama kolom foreign key pada tabel yang menunjuk ke tabel itu sendiri
     * (self-reference, mis. `parent_item_id` pada tabel split-item). Kolom
     * ini butuh remapping id lama -> id baru saat amend, bukan sekadar
     * di-copy mentah — lihat blok two-pass replicate item di amend().
     *
     * @return array<int, string>
     */
    protected static function selfReferencingColumnsOf(string $table): array {
        static $cache = [];

        return $cache[$table] ??= collect(Schema::getForeignKeys($table))
            ->filter(fn (array $foreignKey) => $foreignKey['foreign_table'] === $table)
            ->flatMap(fn (array $foreignKey) => $foreignKey['columns'])
            ->all();
    }

    /**
     * Nama kolom generated/computed (storedAs/virtualAs) milik tabel, di-cache
     * per-request karena Schema::getColumns() query ke information_schema/
     * pragma_table_xinfo tiap dipanggil. Kolom ini wajib di-exclude dari
     * replicate() — DB (MySQL STORED maupun SQLite) menolak INSERT eksplisit
     * ke kolom generated.
     *
     * @return array<int, string>
     */
    protected static function generatedColumnsOf(string $table): array {
        static $cache = [];

        return $cache[$table] ??= collect(Schema::getColumns($table))
            ->filter(fn (array $column) => $column['generation'] !== null)
            ->pluck('name')
            ->all();
    }

    /**
     * Nama kolom foreign key pada tabel yang menunjuk ke tabel itu sendiri
     * (self-reference, mis. `parent_item_id` pada tabel split-item). Kolom
     * ini butuh remapping id lama -> id baru saat amend, bukan sekadar
     * di-copy mentah — lihat blok two-pass replicate item di amend().
     *
     * @return array<int, string>
     */
    protected static function selfReferencingColumnsOf(string $table): array {
        static $cache = [];

        return $cache[$table] ??= collect(Schema::getForeignKeys($table))
            ->filter(fn (array $foreignKey) => $foreignKey['foreign_table'] === $table)
            ->flatMap(fn (array $foreignKey) => $foreignKey['columns'])
            ->all();
    }

    public function amend($withRelations = true) {
        DB::beginTransaction();
        $this->loadAllRelations(HasMany::class, MorphMany::class);
        if ($this->amended_from_id == null) {
            $root = static::query()->whereKey($this->id)->lockForUpdate()->firstOrFail();
            $root->increment('revision_number');
            $newCode       = $root->code . "-{$root->revision_number}";
            $amendedFromId = $root->id;
        } else {
            $dataOri = static::query()->whereKey($this->amended_from_id)->lockForUpdate()->firstOrFail();
            $dataOri->increment('revision_number');
            $newCode       = $dataOri->code . "-{$dataOri->revision_number}";
            $amendedFromId = $dataOri->id;
        }
        $newData = $this->replicate([
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'canceled_at',
            'submitted_at',
            'status',
            'revision_number',
            'created_by_id',
            'code',
            'submitted_format',
            ...static::generatedColumnsOf($this->getTable()),
        ]);
        $newData->code            = $newCode;
        $newData->amended_from_id = $amendedFromId;

        try {
            if ($withRelations) {
                $newData->push();
                foreach ($this->getRelations() as $key => $value) {
                    if ($value instanceof Collection) {
                        $foreignKey = $newData->$key()->getForeignKeyName();

                        // Pass 1: replicate tiap item, simpan mapping id lama -> item
                        // baru. Urutan collection tidak menjamin item parent selesai
                        // duluan, jadi remapping kolom self-reference (mis.
                        // parent_item_id) tidak bisa dilakukan dalam loop yang sama.
                        $idMap = [];
                        foreach ($value as $item) {
                            $oldId   = $item->id;
                            $newItem = $item->replicate([
                                'id',
                                'created_at',
                                'updated_at',
                                'deleted_at',
                                ...$item->getGuarded(),
                                ...static::generatedColumnsOf($item->getTable()),
                                $foreignKey,
                            ]);
                            $newItem->$foreignKey = $newData->id;
                            $newItem->save();
                            $idMap[$oldId] = $newItem;
                        }

                        // Pass 2: remap kolom self-reference (mis. parent_item_id)
                        // dari id lama ke id baru sesuai mapping Pass 1. Item yang
                        // acuannya di luar batch (tidak ada di $idMap) dibiarkan
                        // apa adanya.
                        if ($idMap !== []) {
                            $table                  = reset($idMap)->getTable();
                            $selfReferencingColumns = static::selfReferencingColumnsOf($table);
                            foreach ($idMap as $newItem) {
                                $updates = [];
                                foreach ($selfReferencingColumns as $column) {
                                    $oldReference = $newItem->$column;
                                    if ($oldReference !== null && isset($idMap[$oldReference])) {
                                        $updates[$column] = $idMap[$oldReference]->id;
                                    }
                                }
                                if ($updates !== []) {
                                    $newItem::query()->whereKey($newItem->id)->update($updates);
                                    $newItem->forceFill($updates)->syncOriginalAttributes(array_keys($updates));
                                }
                            }
                        }
                    }
                }
            } else {
                $newData->save();
            }
        } catch (QueryException $e) {
            DB::rollBack();

            if (($e->errorInfo[0] ?? null) === '23000') {
                throw ValidationException::withMessages([
                    'code' => 'Amend gagal, ada proses amend lain yang bersamaan — coba lagi.',
                ]);
            }

            throw $e;
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        event(new AuditableModelSaved($this, 'amended'));
        // logForCreated() untuk $newData sekarang ditangani lewat hook
        // static::created() di DataTable::bootDataTable().
        DB::commit();

        return $newData;
    }

    public function attachConnections(Model $item, ?array $data, ?int $depth = null) {
        if ($depth !== null && $depth < 0) {
            return;
        }
        if ($item && ($item->referenceable_type == null || $item->referenceable_id == null)) {
            return;
        }

        $sourceItem = $item->referenceable;

        ModelConnection::createConnection([
            'model'     => $sourceItem,
            'reference' => $item,
            'data'      => $data,
        ]);

        $parentRelation = $sourceItem->parentRelation;
        if ($parentRelation) {
            ModelConnection::createConnection([
                'model'     => $parentRelation,
                'reference' => $this,
            ]);
        }
        $nextDepth = $depth === null ? null : $depth - 1;
        $this->attachConnections($sourceItem, $data, $nextDepth);
    }
}
