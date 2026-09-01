<?php

namespace App\Enums;

enum Domain: string {
    case Core      = 'core';
    case Sales     = 'sales';
    case Purchase  = 'purchase';
    case Inventory = 'inventory';
    case Asset     = 'asset';
    case Finances  = 'finances';
    case Service   = 'service';
    case Helpdesk  = 'helpdesk';
    case User      = 'user';
    case Migration = 'migration';
}
