'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

// Helper to convert number to Indian currency words
function numberToWordsINR(num: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  function convertGroup(n: number): string {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let result = '';
  if (crore > 0) result += convertGroup(crore) + 'Crore ';
  if (lakh > 0) result += convertGroup(lakh) + 'Lakh ';
  if (thousand > 0) result += convertGroup(thousand) + 'Thousand ';
  if (remainder > 0) result += convertGroup(remainder);

  const paise = Math.round((Math.abs(num) - n) * 100);
  let paiseStr = '';
  if (paise > 0) {
    paiseStr = ` and ${convertGroup(paise)}Paise`;
  }

  return `Rupees ${result.trim()}${paiseStr} Only`;
}

function fmt(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '0.00';
  return Number(n).toFixed(2);
}

export default function PrintInvoicePage() {
  const params = useParams();
  const saleId = params?.id as string;

  const [sale, setSale] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [printCopy, setPrintCopy] = useState<'ORIGINAL' | 'DUPLICATE' | 'TRIPLICATE'>('ORIGINAL');
  const [format, setFormat] = useState<'A4' | 'THERMAL'>('A4');

  useEffect(() => {
    async function load() {
      try {
        const [saleRes, bizRes] = await Promise.all([
          api.get(`/sales/${saleId}`),
          api.get('/business/profile'),
        ]);
        setSale(saleRes.data.data);
        setBusiness(bizRes.data.data);
        setSettings(bizRes.data.data?.settings || {});
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    if (saleId) load();
  }, [saleId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <p className="text-slate-600 font-medium">Preparing Tax Invoice…</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <p className="text-red-600 font-medium">Invoice not found or unauthorized.</p>
      </div>
    );
  }

  const isInterState = Boolean(sale.isInterState || Number(sale.igstAmount) > 0);
  const upiId = settings?.upiId || 'sharmaagro@sbi';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    `upi://pay?pa=${upiId}&pn=${encodeURIComponent(business?.name || 'RetailPro')}&am=${sale.grandTotal}&cu=INR&tn=${encodeURIComponent(sale.invoiceNumber)}`
  )}`;

  return (
    <div className="bg-slate-100 min-h-screen py-6 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Control Toolbar - Hidden on Print */}
      <div className="max-w-4xl mx-auto mb-6 px-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.close()}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 font-medium"
          >
            ← Close
          </button>
          <div className="flex bg-white rounded border border-slate-300 overflow-hidden text-xs shadow-sm">
            <button
              onClick={() => setFormat('A4')}
              className={`px-3 py-1.5 font-medium ${format === 'A4' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              📄 A4 Standard
            </button>
            <button
              onClick={() => setFormat('THERMAL')}
              className={`px-3 py-1.5 font-medium ${format === 'THERMAL' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              🧾 80mm Thermal
            </button>
          </div>
          {format === 'A4' && (
            <select
              value={printCopy}
              onChange={(e) => setPrintCopy(e.target.value as any)}
              className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 shadow-sm font-medium"
            >
              <option value="ORIGINAL">Original for Recipient</option>
              <option value="DUPLICATE">Duplicate for Transporter</option>
              <option value="TRIPLICATE">Triplicate for Supplier</option>
            </select>
          )}
        </div>

        <button
          onClick={() => window.print()}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-md flex items-center gap-1.5 transition-colors"
        >
          <span>🖨</span> Print Invoice
        </button>
      </div>

      {/* =========================================================================
          FORMAT 1: A4 GST TAX INVOICE
          ========================================================================= */}
      {format === 'A4' ? (
        <div className="max-w-4xl mx-auto bg-white p-8 shadow-md border border-slate-300 print:border-0 print:shadow-none print:p-0 print:max-w-none text-xs leading-relaxed">
          {/* Header Title Bar */}
          <div className="text-center pb-2 border-b-2 border-slate-800">
            <h1 className="text-xl font-bold tracking-wider uppercase text-slate-900">
              {sale.isGstInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
            </h1>
            <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
              ({printCopy === 'ORIGINAL' ? 'Original for Recipient' : printCopy === 'DUPLICATE' ? 'Duplicate for Transporter' : 'Triplicate for Supplier'})
            </p>
          </div>

          {/* Supplier Info & Meta Grid */}
          <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300">
            {/* Seller */}
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{business?.legalName || business?.name || 'Sharma Agro & Retail Enterprises'}</h2>
              {business?.tagline && <p className="text-[11px] text-slate-600 italic mb-1">{business.tagline}</p>}
              <p className="text-slate-700">{business?.addressLine1 || 'Shop #14, Kisan Mandi Complex, GT Karnal Road'}</p>
              <p className="text-slate-700">{business?.city || 'Delhi'} - {business?.pincode || '110036'}</p>
              <p className="text-slate-800 font-semibold mt-1">
                GSTIN: <span className="font-mono text-slate-900 font-bold">{business?.gstin || '07AAAAA0000A1Z5'}</span>
              </p>
              <p className="text-slate-700">State: <span className="font-semibold">{business?.state || 'Delhi'}</span> (State Code: {business?.stateCode || '07'})</p>
              <p className="text-slate-700">Phone: {business?.phone || '9876543210'} | Email: {business?.email || 'sales@retailpro.com'}</p>
            </div>

            {/* Invoice Meta */}
            <div className="text-right space-y-1">
              <div className="inline-block text-left bg-slate-50 p-2.5 rounded border border-slate-200">
                <p><span className="font-semibold text-slate-600">Invoice No:</span> <span className="font-mono font-bold text-slate-900">{sale.invoiceNumber}</span></p>
                <p><span className="font-semibold text-slate-600">Invoice Date:</span> <span className="font-medium text-slate-900">{new Date(sale.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                <p><span className="font-semibold text-slate-600">Place of Supply:</span> <span className="font-medium text-slate-900">{sale.placeOfSupply || business?.state || 'Delhi'} ({sale.placeOfSupply || business?.stateCode || '07'})</span></p>
                <p><span className="font-semibold text-slate-600">Reverse Charge:</span> <span className="font-medium text-slate-900">No</span></p>
                <p><span className="font-semibold text-slate-600">Payment Mode:</span> <span className="font-medium text-slate-900">{sale.paymentMethod || 'CASH'}</span></p>
              </div>
            </div>
          </div>

          {/* Bill To & Ship To Details */}
          <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300">
            <div>
              <p className="font-bold text-[11px] text-slate-800 uppercase tracking-wide mb-1">
                Details of Receiver (Billed To): {sale.supplier ? (
                  <span className="text-purple-700 font-bold ml-1">[SUPPLIER]</span>
                ) : (sale.saleType === 'WHOLESALE' || sale.customer?.customerType === 'WHOLESALE') ? (
                  <span className="text-amber-700 font-bold ml-1">[WHOLESALE]</span>
                ) : null}
              </p>
              {sale.supplier ? (
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-slate-900">
                    {sale.supplier.companyName || sale.supplier.name}
                    {sale.supplier.companyName && <span className="font-normal text-xs text-slate-600 block">Prop: {sale.supplier.name}</span>}
                  </p>
                  <p className="text-slate-700">{sale.supplier.address || sale.customer?.billingAddress || 'Address on record'}</p>
                  <p className="text-slate-700">Phone: {sale.supplier.phone}</p>
                  <p className="text-slate-800">
                    GSTIN: <span className="font-mono font-bold">{sale.supplier.gstin || sale.customer?.gstin || 'Unregistered'}</span>
                  </p>
                  <p className="text-slate-700">State: {sale.supplier.state || sale.customer?.state || 'Delhi'} ({sale.supplier.stateCode || sale.customer?.stateCode || '07'})</p>
                </div>
              ) : sale.customer ? (
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-slate-900">
                    {sale.customer.companyName || sale.customer.name}
                    {sale.customer.companyName && <span className="font-normal text-xs text-slate-600 block">Prop: {sale.customer.name}</span>}
                  </p>
                  <p className="text-slate-700">{sale.customer.billingAddress || sale.customer.address || 'Address on record'}</p>
                  <p className="text-slate-700">Phone: {sale.customer.phone}</p>
                  <p className="text-slate-800">
                    GSTIN: <span className="font-mono font-bold">{sale.customer.gstin || 'Unregistered'}</span>
                  </p>
                  <p className="text-slate-700">State: {sale.customer.state || 'Delhi'} ({sale.customer.stateCode || '07'})</p>
                </div>
              ) : (
                <p className="text-slate-600 italic">Walk-in Customer / Counter Sale</p>
              )}
            </div>

            <div>
              <p className="font-bold text-[11px] text-slate-800 uppercase tracking-wide mb-1">Details of Consignee (Shipped To):</p>
              {sale.supplier ? (
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900">{sale.supplier.companyName || sale.supplier.name}</p>
                  <p className="text-slate-700">{sale.supplier.address || 'Same as Billing Address'}</p>
                  <p className="text-slate-700">State: {sale.supplier.state || 'Delhi'} ({sale.supplier.stateCode || '07'})</p>
                </div>
              ) : sale.customer ? (
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900">{sale.customer.name}</p>
                  <p className="text-slate-700">{sale.customer.shippingAddress || sale.customer.billingAddress || sale.customer.address || 'Same as Billing Address'}</p>
                  <p className="text-slate-700">State: {sale.customer.state || 'Delhi'} ({sale.customer.stateCode || '07'})</p>
                </div>
              ) : (
                <p className="text-slate-600 italic">Direct Delivery at Store</p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full my-3 border border-collapse border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300 w-8 text-center">#</th>
                <th className="p-1.5 border-r border-slate-300 text-left">Description of Goods</th>
                <th className="p-1.5 border-r border-slate-300 text-center w-16">HSN/SAC</th>
                <th className="p-1.5 border-r border-slate-300 text-right w-12">Qty</th>
                <th className="p-1.5 border-r border-slate-300 text-center w-12">Unit</th>
                <th className="p-1.5 border-r border-slate-300 text-right w-16">Rate (₹)</th>
                <th className="p-1.5 border-r border-slate-300 text-right w-20">Taxable (₹)</th>
                {!isInterState ? (
                  <>
                    <th className="p-1.5 border-r border-slate-300 text-center w-12">CGST</th>
                    <th className="p-1.5 border-r border-slate-300 text-center w-12">SGST</th>
                  </>
                ) : (
                  <th className="p-1.5 border-r border-slate-300 text-center w-16">IGST</th>
                )}
                <th className="p-1.5 text-right w-24">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item: any, idx: number) => (
                <tr key={item.id || idx} className="border-b border-slate-200">
                  <td className="p-1.5 border-r border-slate-300 text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r border-slate-300 font-medium text-slate-900">
                    {item.productName || item.product?.name}
                  </td>
                  <td className="p-1.5 border-r border-slate-300 text-center font-mono text-[10px]">{item.hsnCode || '—'}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-semibold">{Number(item.quantity)}</td>
                  <td className="p-1.5 border-r border-slate-300 text-center text-slate-600">{item.unit || 'PCS'}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right">{fmt(item.unitPrice)}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-medium">{fmt(item.taxableAmount)}</td>
                  {!isInterState ? (
                    <>
                      <td className="p-1.5 border-r border-slate-300 text-right">
                        <div>{fmt(item.cgstAmount)}</div>
                        <div className="text-[9px] text-slate-400 font-mono">({(Number(item.gstRate)/2).toFixed(1)}%)</div>
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-right">
                        <div>{fmt(item.sgstAmount)}</div>
                        <div className="text-[9px] text-slate-400 font-mono">({(Number(item.gstRate)/2).toFixed(1)}%)</div>
                      </td>
                    </>
                  ) : (
                    <td className="p-1.5 border-r border-slate-300 text-right">
                      <div>{fmt(item.igstAmount)}</div>
                      <div className="text-[9px] text-slate-400 font-mono">({Number(item.gstRate).toFixed(1)}%)</div>
                    </td>
                  )}
                  <td className="p-1.5 text-right font-bold text-slate-900">{fmt(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                <td colSpan={3} className="p-1.5 border-r border-slate-300 text-left uppercase">Total</td>
                <td className="p-1.5 border-r border-slate-300 text-right font-mono">
                  {sale.items?.reduce((s: number, i: any) => s + Number(i.quantity), 0)}
                </td>
                <td className="p-1.5 border-r border-slate-300" />
                <td className="p-1.5 border-r border-slate-300" />
                <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(sale.taxableAmount)}</td>
                {!isInterState ? (
                  <>
                    <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(sale.cgstAmount)}</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(sale.sgstAmount)}</td>
                  </>
                ) : (
                  <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(sale.igstAmount)}</td>
                )}
                <td className="p-1.5 text-right font-mono font-extrabold text-slate-900">{fmt(sale.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Amount In Words & Financial Box */}
          <div className="grid grid-cols-12 gap-4 py-2 border-b border-slate-300">
            <div className="col-span-7 space-y-2">
              <div>
                <p className="font-bold text-slate-700">Total Amount in Words:</p>
                <p className="italic font-semibold text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
                  {numberToWordsINR(Number(sale.grandTotal))}
                </p>
              </div>

              {/* Bank Details & QR */}
              <div className="flex gap-4 p-2.5 bg-slate-50 rounded border border-slate-200 items-center">
                <div className="space-y-0.5 flex-1">
                  <p className="font-bold text-[11px] text-slate-800 uppercase">Bank Account Details for Payment:</p>
                  <p><span className="text-slate-500">Bank:</span> <span className="font-semibold">{settings?.bankName || 'State Bank of India'}</span></p>
                  <p><span className="text-slate-500">A/C No:</span> <span className="font-mono font-bold">{settings?.bankAccountNumber || '38192837461'}</span></p>
                  <p><span className="text-slate-500">IFSC:</span> <span className="font-mono font-bold">{settings?.bankIfsc || 'SBIN0001234'}</span></p>
                  <p><span className="text-slate-500">UPI ID:</span> <span className="font-mono font-semibold text-blue-700">{upiId}</span></p>
                </div>
                <div className="text-center flex-shrink-0">
                  <img src={qrUrl} alt="UPI QR" className="w-20 h-20 border border-slate-300 rounded bg-white p-1" />
                  <p className="text-[9px] text-slate-500 mt-0.5">Scan to Pay UPI</p>
                </div>
              </div>
            </div>

            <div className="col-span-5 space-y-1 text-right">
              <div className="space-y-1 p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Taxable Value:</span>
                  <span className="font-mono font-medium">₹{fmt(sale.taxableAmount)}</span>
                </div>
                {!isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total CGST:</span>
                      <span className="font-mono font-medium">₹{fmt(sale.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total SGST:</span>
                      <span className="font-mono font-medium">₹{fmt(sale.sgstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total IGST:</span>
                    <span className="font-mono font-medium">₹{fmt(sale.igstAmount)}</span>
                  </div>
                )}
                {Number(sale.roundOff) !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Round Off:</span>
                    <span className="font-mono font-medium">₹{fmt(sale.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-slate-300 text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base text-blue-800">₹{fmt(sale.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  <span>Paid Amount:</span>
                  <span className="font-mono">₹{fmt(sale.paidAmount)}</span>
                </div>
                {Number(sale.balanceAmount) > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Balance Due:</span>
                    <span className="font-mono">₹{fmt(sale.balanceAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Terms & Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-4 items-end">
            <div>
              <p className="font-bold text-[11px] text-slate-800 uppercase mb-1">Terms & Conditions:</p>
              <div className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed">
                {settings?.termsAndConditions ||
                  '1. Goods once sold will not be returned without bill.\n2. Subject to Delhi jurisdiction only.\n3. Check quantity and condition before leaving counter.'}
              </div>
            </div>

            <div className="text-right space-y-12">
              <p className="font-bold text-slate-900">
                For {business?.legalName || business?.name || 'Sharma Agro & Retail Enterprises'}
              </p>
              <div>
                <div className="border-t border-slate-400 w-48 ml-auto pt-1 text-center font-medium text-[11px] text-slate-700">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-6 pt-2 border-t border-slate-200">
            This is a computer generated invoice powered by RetailPro
          </p>
        </div>
      ) : (
        /* =========================================================================
           FORMAT 2: 80mm THERMAL RECEIPT FORMAT
           ========================================================================= */
        <div className="max-w-[320px] mx-auto bg-white p-4 shadow-md font-mono text-[11px] border border-slate-300 print:border-0 print:shadow-none print:p-0 print:max-w-none leading-tight">
          <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
            <h1 className="text-sm font-bold uppercase">{business?.name || 'Sharma Agro & Retail'}</h1>
            <p className="text-[10px]">{business?.addressLine1 || 'Kisan Mandi, Delhi'}</p>
            <p className="text-[10px]">Ph: {business?.phone || '9876543210'}</p>
            <p className="text-[10px] font-bold">GSTIN: {business?.gstin || '07AAAAA0000A1Z5'}</p>
            <div className="font-bold uppercase tracking-widest pt-1">
              *** {sale.isGstInvoice ? 'TAX INVOICE' : 'RECEIPT'} ***
            </div>
          </div>

          <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Inv: {sale.invoiceNumber}</span>
              <span>{new Date(sale.invoiceDate).toLocaleDateString('en-IN')}</span>
            </div>
            {sale.supplier ? (
              <div>Supplier: {sale.supplier.companyName || sale.supplier.name} ({sale.supplier.phone})</div>
            ) : sale.customer ? (
              <div>
                {(sale.saleType === 'WHOLESALE' || sale.customer?.customerType === 'WHOLESALE') ? 'Wholesale: ' : 'Cust: '}
                {sale.customer.companyName || sale.customer.name} ({sale.customer.phone})
              </div>
            ) : null}
            <div>Pay Mode: {sale.paymentMethod || 'CASH'}</div>
          </div>

          <div className="py-2 border-b border-dashed border-slate-400">
            <div className="flex justify-between font-bold border-b border-slate-300 pb-1 mb-1">
              <span>Item</span>
              <span>Qty x Rate</span>
              <span>Amt</span>
            </div>
            {sale.items?.map((item: any, idx: number) => (
              <div key={idx} className="mb-1.5">
                <div className="font-bold truncate">{item.productName || item.product?.name}</div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>{item.quantity} {item.unit} @ ₹{fmt(item.unitPrice)}</span>
                  <span className="font-bold text-slate-900">₹{fmt(item.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-right text-[11px]">
            <div className="flex justify-between">
              <span>Taxable Value:</span>
              <span>₹{fmt(sale.taxableAmount)}</span>
            </div>
            {!isInterState ? (
              <>
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>₹{fmt(sale.cgstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>₹{fmt(sale.sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>IGST:</span>
                <span>₹{fmt(sale.igstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
              <span>GRAND TOTAL:</span>
              <span>₹{fmt(sale.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Paid:</span>
              <span>₹{fmt(sale.paidAmount)}</span>
            </div>
            {Number(sale.balanceAmount) > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>Balance Due:</span>
                <span>₹{fmt(sale.balanceAmount)}</span>
              </div>
            )}
          </div>

          <div className="text-center py-3 space-y-2">
            <img src={qrUrl} alt="UPI QR" className="w-24 h-24 mx-auto border border-slate-300 p-1" />
            <p className="text-[9px]">Scan with any UPI App to Pay</p>
            <p className="text-[10px] font-bold">THANK YOU FOR YOUR VISIT!</p>
          </div>
        </div>
      )}
    </div>
  );
}
