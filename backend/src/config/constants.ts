// Indian GST State Codes Reference
export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const UNITS = [
  'PCS',
  'BOX',
  'PKT',
  'PACK',
  'KG',
  'GM',
  'GRAM',
  'LTR',
  'LITRE',
  'ML',
  'MTR',
  'FT',
  'SET',
  'DOZ',
  'DOZEN',
  'BAG',
  'BOTTLE',
  'CAN',
  'DRUM',
  'PAIR',
  'QTL',
  'QUINTAL',
  'TON',
] as const;

export const MOVEMENT_TYPES = {
  OPENING_STOCK: 'OPENING_STOCK',
  PURCHASE_RECEIVED: 'PURCHASE_RECEIVED',
  SALE: 'SALE',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  DAMAGE_ADJUSTMENT: 'DAMAGE_ADJUSTMENT',
  LOSS_ADJUSTMENT: 'LOSS_ADJUSTMENT',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
} as const;

export const ROLES = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  BILLING_STAFF: 'BILLING_STAFF',
  INVENTORY_STAFF: 'INVENTORY_STAFF',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT',
  SPLIT: 'SPLIT',
  CHEQUE: 'CHEQUE',
} as const;

export const INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  FINAL: 'FINAL',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
} as const;

export const PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
} as const;

// Default permissions mapping for standard roles
export const DEFAULT_ROLE_PERMISSIONS: Record<string, { resource: string; action: string }[]> = {
  OWNER: [
    { resource: '*', action: '*' },
  ],
  MANAGER: [
    { resource: 'products', action: 'manage' },
    { resource: 'categories', action: 'manage' },
    { resource: 'inventory', action: 'manage' },
    { resource: 'purchases', action: 'manage' },
    { resource: 'suppliers', action: 'manage' },
    { resource: 'sales', action: 'manage' },
    { resource: 'customers', action: 'manage' },
    { resource: 'payments', action: 'manage' },
    { resource: 'expenses', action: 'manage' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'export' },
  ],
  BILLING_STAFF: [
    { resource: 'sales', action: 'create' },
    { resource: 'sales', action: 'read' },
    { resource: 'products', action: 'read' },
    { resource: 'customers', action: 'read' },
    { resource: 'customers', action: 'create' },
    { resource: 'customers', action: 'update' },
    { resource: 'payments', action: 'create' },
    { resource: 'payments', action: 'read' },
  ],
  INVENTORY_STAFF: [
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'inventory', action: 'manage' },
    { resource: 'purchases', action: 'read' },
    { resource: 'purchases', action: 'update' },
    { resource: 'categories', action: 'read' },
  ],
};
