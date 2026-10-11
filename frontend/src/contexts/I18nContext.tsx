'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type Language = 'en' | 'hi';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.inventory': 'Inventory',
    'nav.purchases': 'Purchases',
    'nav.suppliers': 'Suppliers',
    'nav.sales': 'Sales & POS',
    'nav.customers': 'Customers',
    'nav.salesParties': 'Sales Parties (Wholesale & Retail)',
    'nav.purchaseParties': 'Purchase Parties (Suppliers)',
    'nav.payments': 'Payments',
    'nav.expenses': 'Expenses',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    // Dashboard
    'dashboard.todaySales': "Today's Sales",
    'dashboard.monthlySales': 'Monthly Sales',
    'dashboard.grossProfit': 'Gross Profit',
    'dashboard.netProfit': 'Net Profit',
    'dashboard.totalProducts': 'Total Products',
    'dashboard.lowStock': 'Low Stock',
    'dashboard.outOfStock': 'Out of Stock',
    'dashboard.customerDues': 'Customer Dues',
    'dashboard.supplierDues': 'Supplier Dues',
    'dashboard.inventoryValue': 'Inventory Value',
    'dashboard.recentSales': 'Recent Sales',
    'dashboard.salesTrend': 'Sales Trend',
    'dashboard.lowStockAlerts': 'Low Stock Alerts',
    // Common
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading…',
    'common.noData': 'No data found',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.total': 'Total',
    'common.paid': 'Paid',
    'common.unpaid': 'Unpaid',
    'common.pending': 'Pending',
    'common.name': 'Name',
    'common.phone': 'Phone',
    'common.email': 'Email',
    'common.address': 'Address',
    'common.gstin': 'GSTIN',
    'common.back': 'Back',
    'common.view': 'View',
    'common.print': 'Print',
    'common.download': 'Download',
    'common.import': 'Import',
    // Products
    'products.title': 'Products',
    'products.add': 'Add Product',
    'products.sku': 'SKU',
    'products.price': 'Price',
    'products.stock': 'Stock',
    'products.category': 'Category',
    'products.gstRate': 'GST Rate',
    'products.hsn': 'HSN Code',
    'products.unit': 'Unit',
    'products.purchasePrice': 'Purchase Price',
    'products.sellingPrice': 'Selling Price',
    'products.mrp': 'MRP',
    'products.lowStockThreshold': 'Low Stock Threshold',
    'products.openingStock': 'Opening Stock',
    'products.currentStock': 'Current Stock',
    // Sales
    'sales.title': 'Sales',
    'sales.pos': 'POS Billing',
    'sales.invoice': 'Invoice',
    'sales.newSale': 'New Sale',
    'sales.customer': 'Customer',
    'sales.items': 'Items',
    'sales.subtotal': 'Subtotal',
    'sales.discount': 'Discount',
    'sales.taxableAmount': 'Taxable Amount',
    'sales.cgst': 'CGST',
    'sales.sgst': 'SGST',
    'sales.igst': 'IGST',
    'sales.grandTotal': 'Grand Total',
    'sales.paymentMethod': 'Payment Method',
    'sales.cash': 'Cash',
    'sales.upi': 'UPI',
    'sales.card': 'Card',
    'sales.credit': 'Credit',
    'sales.checkout': 'Checkout',
    'sales.printInvoice': 'Print Invoice',
    // Inventory
    'inventory.title': 'Inventory',
    'inventory.stockMovements': 'Stock Movements',
    'inventory.adjust': 'Adjust Stock',
    'inventory.reason': 'Reason',
    // Settings
    'settings.title': 'Settings',
    'settings.businessProfile': 'Business Profile',
    'settings.invoiceSettings': 'Invoice Settings',
    'settings.whatsapp': 'WhatsApp Alerts',
    'settings.staff': 'Staff & Roles',
    'settings.gst': 'GST Configuration',
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register Business',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.businessName': 'Business Name',
    'auth.ownerName': 'Owner Name',
    'auth.phone': 'Phone Number',
    'auth.loginTitle': 'Welcome back',
    'auth.loginSubtitle': 'Sign in to your RetailPro account',
  },
  hi: {
    // Navigation
    'nav.dashboard': 'डैशबोर्ड',
    'nav.products': 'उत्पाद',
    'nav.categories': 'श्रेणियाँ',
    'nav.inventory': 'इन्वेंट्री',
    'nav.purchases': 'खरीदारी',
    'nav.suppliers': 'आपूर्तिकर्ता',
    'nav.sales': 'बिक्री और POS',
    'nav.customers': 'ग्राहक',
    'nav.salesParties': 'बिक्री पार्टियां (थोक व खुदरा)',
    'nav.purchaseParties': 'खरीद पार्टियां (सप्लायर)',
    'nav.payments': 'भुगतान',
    'nav.expenses': 'खर्च',
    'nav.reports': 'रिपोर्ट',
    'nav.settings': 'सेटिंग्स',
    'nav.logout': 'लॉग आउट',
    // Dashboard
    'dashboard.todaySales': 'आज की बिक्री',
    'dashboard.monthlySales': 'मासिक बिक्री',
    'dashboard.grossProfit': 'सकल लाभ',
    'dashboard.netProfit': 'शुद्ध लाभ',
    'dashboard.totalProducts': 'कुल उत्पाद',
    'dashboard.lowStock': 'कम स्टॉक',
    'dashboard.outOfStock': 'स्टॉक समाप्त',
    'dashboard.customerDues': 'ग्राहक बकाया',
    'dashboard.supplierDues': 'आपूर्तिकर्ता बकाया',
    'dashboard.inventoryValue': 'इन्वेंट्री मूल्य',
    'dashboard.recentSales': 'हाल की बिक्री',
    'dashboard.salesTrend': 'बिक्री प्रवृत्ति',
    'dashboard.lowStockAlerts': 'कम स्टॉक अलर्ट',
    // Common
    'common.search': 'खोजें',
    'common.filter': 'फ़िल्टर',
    'common.export': 'निर्यात',
    'common.add': 'जोड़ें',
    'common.edit': 'संपादित करें',
    'common.delete': 'हटाएं',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'common.loading': 'लोड हो रहा है…',
    'common.noData': 'कोई डेटा नहीं मिला',
    'common.actions': 'क्रियाएं',
    'common.status': 'स्थिति',
    'common.active': 'सक्रिय',
    'common.inactive': 'निष्क्रिय',
    'common.date': 'दिनांक',
    'common.amount': 'राशि',
    'common.total': 'कुल',
    'common.paid': 'भुगतान',
    'common.unpaid': 'अवैतनिक',
    'common.pending': 'लंबित',
    'common.name': 'नाम',
    'common.phone': 'फ़ोन',
    'common.email': 'ईमेल',
    'common.address': 'पता',
    'common.gstin': 'जीएसटीआईएन',
    'common.back': 'वापस',
    'common.view': 'देखें',
    'common.print': 'प्रिंट',
    'common.download': 'डाउनलोड',
    'common.import': 'आयात',
    // Products
    'products.title': 'उत्पाद',
    'products.add': 'उत्पाद जोड़ें',
    'products.sku': 'SKU कोड',
    'products.price': 'मूल्य',
    'products.stock': 'स्टॉक',
    'products.category': 'श्रेणी',
    'products.gstRate': 'जीएसटी दर',
    'products.hsn': 'HSN कोड',
    'products.unit': 'इकाई',
    'products.purchasePrice': 'खरीद मूल्य',
    'products.sellingPrice': 'बिक्री मूल्य',
    'products.mrp': 'एमआरपी',
    'products.lowStockThreshold': 'कम स्टॉक सीमा',
    'products.openingStock': 'प्रारंभिक स्टॉक',
    'products.currentStock': 'वर्तमान स्टॉक',
    // Sales
    'sales.title': 'बिक्री',
    'sales.pos': 'POS बिलिंग',
    'sales.invoice': 'चालान',
    'sales.newSale': 'नई बिक्री',
    'sales.customer': 'ग्राहक',
    'sales.items': 'सामान',
    'sales.subtotal': 'उपकुल',
    'sales.discount': 'छूट',
    'sales.taxableAmount': 'करयोग्य राशि',
    'sales.cgst': 'सीजीएसटी',
    'sales.sgst': 'एसजीएसटी',
    'sales.igst': 'आईजीएसटी',
    'sales.grandTotal': 'कुल योग',
    'sales.paymentMethod': 'भुगतान का तरीका',
    'sales.cash': 'नकद',
    'sales.upi': 'यूपीआई',
    'sales.card': 'कार्ड',
    'sales.credit': 'उधार',
    'sales.checkout': 'भुगतान करें',
    'sales.printInvoice': 'चालान प्रिंट करें',
    // Inventory
    'inventory.title': 'इन्वेंट्री',
    'inventory.stockMovements': 'स्टॉक गतिविधि',
    'inventory.adjust': 'स्टॉक समायोजित करें',
    'inventory.reason': 'कारण',
    // Settings
    'settings.title': 'सेटिंग्स',
    'settings.businessProfile': 'व्यवसाय प्रोफ़ाइल',
    'settings.invoiceSettings': 'चालान सेटिंग्स',
    'settings.whatsapp': 'व्हाट्सएप अलर्ट',
    'settings.staff': 'स्टाफ और भूमिकाएं',
    'settings.gst': 'जीएसटी कॉन्फ़िगरेशन',
    // Auth
    'auth.login': 'लॉगिन',
    'auth.register': 'व्यवसाय पंजीकृत करें',
    'auth.email': 'ईमेल पता',
    'auth.password': 'पासवर्ड',
    'auth.businessName': 'व्यवसाय का नाम',
    'auth.ownerName': 'मालिक का नाम',
    'auth.phone': 'फ़ोन नंबर',
    'auth.loginTitle': 'वापस स्वागत है',
    'auth.loginSubtitle': 'अपने RetailPro खाते में साइन इन करें',
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rp_language') as Language) || 'en';
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp_language', lang);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[language][key] || translations['en'][key] || key;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
