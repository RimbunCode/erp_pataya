<?php

namespace App;

enum FormStatus: string
{
  case DRAFT = 'draft';
  case SUBMITTED = 'submitted';
  case CANCELED = 'canceled';
  case APPROVED = 'approved';
  case REJECTED = 'rejected';

  case PENDING = 'pending';

  case CLOSED = 'closed';

  case IN_PROGRESS = 'in_progress';

  case DELETED = 'deleted';

  case ACTIVE = 'active';

  case INACTIVE = 'inactive';

  case RESERVED = 'reserved';

  case COMPLETED = 'completed';

  case PARTIALLY_PAID = 'partially_paid';
  case TO_BILL = 'to_bill';


  public function label()
  {
    return __("status." . $this->value);
  }
}
