<?php

return [
    'not_a_return'               => 'A return source row can only be set on a return document.',
    'source_required'            => 'A return row must reference its source row on the returned invoice.',
    'item_not_in_invoice'        => 'The return source row does not belong to the invoice being returned.',
    'row_mismatch'               => 'The return row does not match its source row (different item, unit, or source).',
    'invoice_not_returnable'     => 'The returned invoice must be approved, not canceled, and not itself a return.',
    'quantity_exceeds_remaining' => 'Return quantity exceeds the remaining returnable quantity (:max).',
];
