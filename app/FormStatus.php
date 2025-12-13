<?php

namespace App;

enum FormStatus: string {
  case DRAFT                           = 'draft';
  case SUBMITTED                       = 'submitted';
  case CANCELED                        = 'canceled';
  case APPROVED                        = 'approved';
  case REJECTED                        = 'rejected';
  case PENDING                         = 'pending';
  case SKIPPED                         = 'skipped';
  case DELIVERED                       = 'delivered';
  case CLOSED                          = 'closed';
  case WAITING                         = 'waiting';
  case IN_PROGRESS                     = 'in_progress';
  case DELETED                         = 'deleted';
  case ACTIVE                          = 'active';
  case INACTIVE                        = 'inactive';
  case RESERVED                        = 'reserved';
  case COMPLETED                       = 'completed';
  case PARTIALLY_PAID                  = 'partially_paid';
  case PARTIALLY_DELIVERED             = 'partially_delivered';
  case PARTIALLY_DELIVERED_AND_TO_BILL = 'partially_delivered_and_to_bill';
  case TO_BILL                         = 'to_bill';
  case TO_DELIVER                      = 'to_deliver';
  case TO_DELIVER_AND_BILL             = 'to_deliver_and_bill';
  case OVERDUE                         = 'overdue';
  case NEED_APPROVAL                   = 'need_approval';

  public function label() {
    return __("status." . $this->value);
  }
}
