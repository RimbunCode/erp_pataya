<?php

namespace App;

enum FormStatus: string {
  case DRAFT = 'draft';
  case SUBMITTED = 'submitted';
  case CANCELED = 'canceled';
  case APPROVED = 'approved';
  case REJECTED = 'rejected';

  case RESERVED = 'reserved';

  case COMPLATED = 'complated';

  public function label() {
    return __("status.". $this->value);
  }
}
