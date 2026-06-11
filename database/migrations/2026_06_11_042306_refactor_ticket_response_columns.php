<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('tickets', function (Blueprint $table) {
            if (Schema::hasColumn('tickets', 'content')) {
                $table->dropColumn('content');
            }
            if (Schema::hasColumn('tickets', 'content_json')) {
                $table->dropColumn('content_json');
            }
        });

        Schema::table('ticket_responses', function (Blueprint $table) {
            if (! Schema::hasColumn('ticket_responses', 'type')) {
                $table->string('type')->after('assign_to_id');
            }
            if (! Schema::hasColumn('ticket_responses', 'priority')) {
                $table->string('priority')->default('medium')->after('type');
            }
            if (! Schema::hasColumn('ticket_responses', 'subject')) {
                $table->string('subject')->after('priority');
            }
            if (! Schema::hasColumn('ticket_responses', 'start_date')) {
                $table->datetime('start_date')->nullable()->after('progress');
            }
            if (! Schema::hasColumn('ticket_responses', 'due_date')) {
                $table->datetime('due_date')->nullable()->after('start_date');
            }
        });
    }

    public function down(): void {
        Schema::table('tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('tickets', 'content')) {
                $table->longText('content')->nullable()->after('subject');
            }
            if (! Schema::hasColumn('tickets', 'content_json')) {
                $table->longText('content_json')->nullable()->after('content');
            }
        });

        Schema::table('ticket_responses', function (Blueprint $table) {
            $cols = array_filter([
                Schema::hasColumn('ticket_responses', 'type') ? 'type' : null,
                Schema::hasColumn('ticket_responses', 'priority') ? 'priority' : null,
                Schema::hasColumn('ticket_responses', 'subject') ? 'subject' : null,
                Schema::hasColumn('ticket_responses', 'start_date') ? 'start_date' : null,
                Schema::hasColumn('ticket_responses', 'due_date') ? 'due_date' : null,
            ]);
            if (! empty($cols)) {
                $table->dropColumn(array_values($cols));
            }
        });
    }
};
