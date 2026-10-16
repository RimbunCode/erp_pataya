<?php

namespace Database\Seeders\PrintTemplates\Finances;

use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Finances: Sales Invoice, Purchase Invoice,
 * dan Payment Entry.
 */
final class FinancesTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::salesInvoice(),
            self::purchaseInvoice(),
            self::paymentEntry(),
        ];
    }

    /**
     * Sales Invoice: header 3 kolom (perusahaan, Tagih Ke, meta kanan),
     * tabel item dengan relasi barang terpadu dan baris ringkasan menyatu, kotak
     * rekening pembayaran, dan tanda tangan.
     */
    private static function salesInvoice(): array {
        return [
            'model'     => SalesInvoice::class,
            'label'     => 'Sales Invoice',
            'relations' => [
                'branch',
                'currency',
                'customer',
                'customerBranch',
                'salesOrder',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Invoice Penjualan'),
                P::headerColumns([
                    P::companyBlock(),
                    P::billToBlock('doc.customer', 'doc.customer_branch', 'Tagih Ke'),
                    P::metaRight([
                        ['Nomor Faktur', '{{doc.code}}'],
                        ['Tanggal Faktur', '{{doc.date}}'],
                        ['Nomor SO', '{{doc.sales_order.code}}', 'doc.sales_order'],
                        ['Lokasi', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Item', 'value' => '{{relation this.item}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Kuantitas', 'value' => '{{this.quantity}} {{this.unit.name}}', 'class' => 'col-qty'],
                    ['label' => 'Harga Satuan', 'value' => '{{this.price}}', 'class' => 'col-number'],
                    ['label' => 'Total Harga', 'value' => '{{this.basic_amount}}', 'class' => 'col-number'],
                ], [
                    ['Potongan', '{{doc.discount_amount}}'],
                    ['DPP', '{{doc.dpp_amount}}'],
                    ['Grand Total', '{{doc.amount}}'],
                    ['Terbayar', '{{doc.paid_amount}}'],
                    ['Sisa Tagihan', '{{doc.outstanding_amount}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::framedBox(
                    '{{#if company.bank_account_number}}'
                    . '<div>Pembayaran untuk invoice ini mohon ditransfer ke rekening :</div>'
                    . '<div><strong>{{company.bank_name}} A/N {{company.bank_account_name}}</strong></div>'
                    . '<div><strong>No. Rekening : {{company.bank_account_number}}</strong></div>'
                    . '{{/if}}'
                    . '<div style="margin-top:6px;">Catatan : Pembayaran dengan cek / giro dianggap sah apabila telah dicairkan.</div>',
                ),
                P::mixedSignatures([
                    ['caption' => 'Dibuat Oleh', 'type' => 'creator'],
                    ['caption' => 'Disetujui Oleh', 'type' => 'approver'],
                ]),
            ]),
        ];
    }

    /**
     * Purchase Invoice: header 3 kolom (perusahaan, Tagih Dari, meta kanan),
     * tabel item mulai dari Part No dengan baris ringkasan menyatu, dan
     * tanda tangan.
     */
    private static function purchaseInvoice(): array {
        return [
            'model'     => PurchaseInvoice::class,
            'label'     => 'Purchase Invoice',
            'relations' => [
                'branch',
                'currency',
                'supplier',
                'purchaseOrder',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Invoice Pembelian'),
                P::headerColumns([
                    P::companyBlock(),
                    P::partyBlock('doc.supplier', 'Tagih Dari'),
                    P::metaRight([
                        ['Nomor Faktur', '{{doc.code}}'],
                        ['Tanggal Faktur', '{{formatDate doc.date "DD-MM-YYYY"}}'],
                        ['Nomor PO', '{{doc.purchase_order.code}}', 'doc.purchase_order'],
                        ['Lokasi', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.name}}'],
                    ['label' => 'Harga Barang', 'value' => '{{formatCurrency this.rate doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Discount', 'value' => '{{formatCurrency this.discount_amount doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Pajak', 'value' => '{{formatCurrency this.tax_amount doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Jumlah', 'value' => '{{formatCurrency this.amount doc.currency.code}}', 'class' => 'col-number'],
                ], [
                    ['Potongan', '{{formatCurrency doc.discount_amount doc.currency.code}}'],
                    ['Grand Total', '{{formatCurrency doc.amount doc.currency.code}}'],
                    ['Terbayar', '{{formatCurrency doc.paid_amount doc.currency.code}}'],
                    ['Sisa Tagihan', '{{formatCurrency doc.outstanding_amount doc.currency.code}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::mixedSignatures([
                    ['caption' => 'Dibuat Oleh', 'type' => 'creator'],
                    ['caption' => 'Disetujui Oleh', 'type' => 'approver'],
                ]),
            ]),
        ];
    }

    /**
     * Payment Entry: bukti pembayaran. Tidak ada tabel barang; yang dicetak
     * arah pembayaran, rekening asal dan tujuan, metode bayar, dan nominal.
     */
    private static function paymentEntry(): array {
        return [
            'model'     => PaymentEntry::class,
            'label'     => 'Payment Entry',
            'relations' => [
                'paymentMethod',
                'accountPaidFrom',
                'accountPaidTo',
            ],
            'html' => P::document([
                P::title('Bukti Pembayaran'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tanggal', '{{doc.date}}'],
                    ['Jenis Pembayaran', '{{doc.payment_type}}'],
                    ['Metode Bayar', '{{doc.payment_method.name}}'],
                    ['Dibayar Dari', '{{doc.account_paid_from.account_name}}'],
                    ['Dibayar Ke', '{{doc.account_paid_to.account_name}}'],
                    ['Mata Uang', '{{doc.currency_code}}', 'doc.currency_code'],
                    ['Kurs', '{{doc.exchange_rate}}', 'doc.exchange_rate'],
                ]),
                P::totals([
                    ['Nominal Dibayar', '{{doc.paid_amount}}'],
                ]),
                P::note('Catatan', 'doc.notes'),
                P::signatures(),
            ]),
        ];
    }
}
