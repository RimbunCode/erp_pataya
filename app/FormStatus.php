<?php

namespace App;

enum FormStatus: string {
  case DRAFT               = 'draft';
  case SUBMITTED           = 'submitted';
  case CANCELED            = 'canceled';
  case APPROVED            = 'approved';
  case REJECTED            = 'rejected';
  case PENDING             = 'pending';
  case SKIPPED             = 'skipped';
  case CLOSED              = 'closed';
  case WAITING             = 'waiting';
  case IN_PROGRESS         = 'in_progress';
  case DELETED             = 'deleted';
  case ACTIVE              = 'active';
  case INACTIVE            = 'inactive';
  case RESERVED            = 'reserved';
  case COMPLETED           = 'completed';
  case UNPAID              = 'unpaid';
  case PARTIALLY_PAID      = 'partially_paid';
  case PAID                = 'paid';
  case TO_BILL             = 'to_bill';
  case BILLED              = 'billed';
  case TO_DELIVER          = 'to_deliver';
  case PARTIALLY_DELIVERED = 'partially_delivered';
  case DELIVERED           = 'delivered';
  case RETURNED            = 'returned';
  case IN_RENT             = 'in_rent';
  case OVERDUE             = 'overdue';
  case NEED_APPROVAL       = 'need_approval';

  public function label() {
    return __("status.{$this->value}");
  }
}
