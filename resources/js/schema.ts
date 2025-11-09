import { z } from "zod";
export const ProfileUpdateRequest = z.object({
    name: z.string().max(255),
    email: z.string().email().max(255)
});
export const UserRequest = z.object({
    name: z.string().min(3).max(255),
    email: z.string().email(),
    username: z.string(),
    gender: z.string().nullable().optional(),
    birthdate: z.date().nullable().optional(),
    phone: z.string().nullable().optional(),
    roles: z.array(z.string()),
    branches: z.array(z.string()),
    default_branch_id: z.string()
});
export const RoleRequest = z.object({
    name: z.string().min(3).max(255),
    description: z.string().nullable().optional(),
    is_disabled: z.boolean().nullable().optional(),
    rules: z.array(z.object({
        permission_id: z.string(),
        level: z.number().int(),
        only_creator: z.boolean(),
        permissions: z.string()
    }))
});
export const WorkOrderRequest = z.object({
    date: z.date(),
    for_internal: z.boolean().nullable().optional(),
    customer: z.object({
        id: z.string().optional(),
        *: z.string().nullable().optional()
    }),
    customer_branch: z.object({
        id: z.string(),
        *: z.string().nullable().optional()
    }),
    item_service: z.object({
        id: z.string(),
        *: z.string().nullable().optional()
    }),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        description: z.string().nullable().optional(),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        })
    })),
    external_note: z.string().nullable().optional()
});
export const SalesOrderRequest = z.object({
    date: z.date(),
    start_date: z.date().nullable().optional(),
    end_date: z.date().nullable().optional(),
    is_rent: z.boolean().nullable().optional(),
    customer: z.object({
        id: z.string().optional(),
        *: z.string().nullable().optional()
    }),
    customer_branch: z.object({
        id: z.string(),
        *: z.string().nullable().optional()
    }),
    reference_so: z.object({
        id: z.string().nullable().optional(),
        *: z.string().nullable().optional()
    }),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        description: z.string().nullable().optional(),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        tax: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        price: z.string().numeric().nullable().optional(),
        source_warehouse: z.object({
            id: z.string().nullable().optional()
        })
    })),
    currency: z.object({
        code: z.string().nullable().optional()
    }),
    exchange_rate: z.string().numeric().optional(),
    external_note: z.string().nullable().optional(),
    payment_schedules: z.array(z.object({
        id: z.string(),
        payment_term: z.object({
            id: z.string().nullable().optional(),
            *: z.string().nullable().optional()
        }),
        payment_method: z.object({
            id: z.string().nullable().optional(),
            *: z.string().nullable().optional()
        }),
        due_date: z.date(),
        payment_amount: z.string().numeric(),
        discount: z.string().numeric().nullable().optional(),
        discount_type: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        invoice_portion: z.string().numeric()
    }))
});
export const InternalOrderRequest = z.object({
    date: z.date(),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        description: z.string().nullable().optional(),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        source_warehouse: z.object({
            id: z.string().nullable().optional()
        })
    })),
    external_note: z.string().nullable().optional()
});
export const CustomerRequest = z.object({
    name: z.string().min(3).max(255),
    phone: z.string().min(3).max(255),
    email: z.string().min(3).max(255).email(),
    vat: z.string().min(3).max(255),
    street: z.string().min(3).max(255),
    city: z.string().min(3).max(255),
    province: z.string().min(3).max(255),
    zip_code: z.string().min(3).max(255),
    country: z.object({
        code: z.string()
    }),
    is_disabled: z.boolean().nullable().optional(),
    branches: z.array(z.object({
        id: z.string().nullable().optional(),
        code: z.string().max(255),
        name: z.string().max(255),
        is_disabled: z.boolean().nullable().optional(),
        billing_address: z.string(),
        billing_street: z.string().max(255).nullable().optional(),
        billing_city: z.string().max(255).nullable().optional(),
        billing_state: z.string().max(255).nullable().optional(),
        billing_zip_code: z.string().max(255).nullable().optional(),
        billing_country: z.object({
            code: z.string().nullable().optional()
        }),
        shipping_street: z.string().max(255),
        shipping_city: z.string().max(255),
        shipping_state: z.string().max(255),
        shipping_zip_code: z.string().max(255),
        shipping_country: z.object({
            code: z.string()
        })
    }))
});
export const SupplierRequest = z.object({
    branch_of: z.object({
        id: z.string().nullable().optional()
    }),
    name: z.string().min(3).max(255),
    phone: z.string().min(3).max(255),
    email: z.string().min(3).max(255).email(),
    banks: z.array(z.object({
        bank: z.string().min(3),
        no_acc: z.string().numeric().min(5),
        account: z.string().min(3)
    })),
    street: z.string().min(3).max(255),
    city: z.string().min(3).max(255),
    province: z.string().min(3).max(255),
    zip_code: z.string().min(3).max(255),
    country: z.object({
        code: z.string()
    }),
    is_disabled: z.boolean().nullable().optional()
});
export const PurchaseRequestRequest = z.object({
    date: z.date(),
    required_date: z.date(),
    external_note: z.string().nullable().optional(),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        description: z.string().nullable().optional(),
        referenceable_type: z.string().nullable().optional(),
        referenceable_id: z.string().nullable().optional(),
        required_date: z.date(),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        })
    }))
});
export const PurchaseOrderRequest = z.object({
    date: z.date(),
    required_date: z.date(),
    external_note: z.string().nullable().optional(),
    supplier: z.object({
        id: z.string(),
        *: z.string().nullable().optional()
    }),
    currency: z.object({
        code: z.string(),
        *: z.string().nullable().optional()
    }),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        description: z.string().nullable().optional(),
        referenceable_type: z.string().nullable().optional(),
        referenceable_id: z.string().nullable().optional(),
        required_date: z.date(),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        target_warehouse: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        })
    }))
});
export const WarehouseRequest = z.object({
    branch: z.object({
        id: z.string().nullable().optional()
    }),
    code: z.string().min(2).max(20),
    name: z.string().min(3).max(255),
    pic: z.object({
        id: z.string().nullable().optional()
    })
});
export const UnitRequest = z.object({
    group: z.string().min(2).max(255),
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(255),
    customable: z.boolean().nullable().optional(),
    conversion_factor: z.string().numeric().min().optional()
});
export const StockEntryRequest = z.object({
    date: z.date(),
    type: z.string(),
    in_transit: z.boolean().nullable().optional(),
    received_date: z.date().nullable().optional(),
    notes: z.string().nullable().optional(),
    items: z.array(z.object({
        id: z.string(),
        item: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        quantity: z.string().numeric().min(1),
        unit: z.object({
            id: z.string(),
            *: z.string().nullable().optional()
        }),
        source_warehouse: z.object({
            id: z.string().nullable().optional(),
            *: z.string().nullable().optional()
        }),
        target_warehouse: z.object({
            id: z.string().nullable().optional(),
            *: z.string().nullable().optional()
        }),
        basic_rate: z.string().numeric().min().nullable().optional(),
        conversion_factor: z.string().numeric().min().nullable().optional()
    })),
    additional_costs: z.array(z.object({
        id: z.string(),
        purpose: z.string(),
        amount: z.string().numeric()
    }))
});
export const ItemVariantRequest = z.object({
    is_disabled: z.boolean().nullable().optional(),
    allow_alternative_item: z.boolean().nullable().optional(),
    description: z.string().nullable().optional(),
    barcodes: z.array(z.object({
        barcode: z.string().min(3).max(255),
        unit: z.object({
            id: z.string()
        })
    }))
});
export const ItemRequest = z.object({
    code: z.string().min(3).max(255),
    name: z.string().min(3).max(255),
    description: z.string().nullable().optional(),
    category: z.object({
        id: z.string()
    }),
    default_unit: z.object({
        id: z.string()
    }),
    is_disabled: z.boolean().nullable().optional(),
    allow_alternative_item: z.boolean().nullable().optional(),
    uoms: z.array(z.object({
        id: z.string(),
        conversion_factor: z.string().numeric(),
        isCustom: z.boolean().nullable().optional()
    })),
    attributes: z.array(z.object({
        attribute: z.object({
            id: z.string(),
            name: z.string().min(3).max(255)
        }),
        values: z.string().min(1)
    })),
    barcodes: z.array(z.object({
        barcode: z.string().min(3).max(255),
        unit: z.object({
            id: z.string()
        })
    }))
});
export const ItemAlternativeRequest = z.object({
    two_way: z.boolean().nullable().optional(),
    item: z.object({
        id: z.string()
    }),
    alternative: z.object({
        id: z.string()
    })
});
export const CategoryRequest = z.object({
    name: z.string().min(3).max(255),
    type: z.string().min(3).max(255)
});
export const AttributeRequest = z.object({
    name: z.string().min(3).max(255),
    description: z.string().nullable().optional(),
    is_numeric: z.boolean().nullable().optional()
});
export const TaxRequest = z.object({
    name: z.string().min(3).max(255),
    rate: z.string().numeric().min().max(100)
});
export const PaymentTermRequest = z.object({
    name: z.string().min(3).max(255),
    due_date_based_on: z.string(),
    credit_period: z.string().numeric().min(),
    invoice_portion: z.string().numeric().min().max(100),
    discount_type: z.string().nullable().optional(),
    discount: z.string().numeric().nullable().optional(),
    description: z.string().nullable().optional(),
    payment_method: z.object({
        id: z.string().nullable().optional()
    })
});
export const PaymentMethodRequest = z.object({
    name: z.string().min(3).max(255),
    description: z.string().nullable().optional()
});
export const PaymentEntryRequest = z.object({
    date: z.date(),
    paid_amount: z.string().numeric().min(),
    payment_method: z.object({
        id: z.string()
    }),
    payment_type: z.string(),
    partyable: z.object({
        id: z.string(),
        *: z.string().nullable().optional()
    }),
    partyable_type: z.string(),
    currency: z.object({
        code: z.string(),
        *: z.string().nullable().optional()
    }),
    exchange_rate: z.string().numeric().min(),
    description: z.string().nullable().optional(),
    paymentable_id: z.string(),
    paymentable_type: z.string()
});
export const TagRequest = z.object({
    name: z.string().max(255).min(3),
    isNew: z.boolean().nullable().optional()
});
export const PrintTemplateRequest = z.object({
    name: z.string().min(3).max(255),
    model: z.object({
        model: z.string()
    })
});
export const FormatingSeriesRequest = z.object({
    format: z.string()
});
export const CommentRequest = z.object({
    comment: z.string().min(3)
});
export const BranchRequest = z.object({
    code: z.string().max(255),
    name: z.string().max(255),
    branchable_type: z.string().max(255).nullable().optional(),
    branchable_id: z.string().max(255).nullable().optional(),
    is_disabled: z.boolean().nullable().optional(),
    billing_address: z.string(),
    billing_street: z.string().max(255).nullable().optional(),
    billing_city: z.string().max(255).nullable().optional(),
    billing_state: z.string().max(255).nullable().optional(),
    billing_zip_code: z.string().max(255).nullable().optional(),
    billing_country: z.object({
        code: z.string().nullable().optional()
    }),
    shipping_street: z.string().max(255),
    shipping_city: z.string().max(255),
    shipping_state: z.string().max(255),
    shipping_zip_code: z.string().max(255),
    shipping_country: z.object({
        code: z.string()
    })
});
export const LoginRequest = z.object({
    usernameOrEmail: z.string(),
    password: z.string()
});
