# RetailPro — Retail Inventory, GST Billing, Stock Control & Business Management System

A production-ready, full-stack ERP, inventory control, and GST billing web application engineered specifically for Indian retail enterprises, agri-retail stores (fertilizers, seeds, pesticides), and general product businesses.

---

## 🌟 Key Features

### 1. 👥 Multi-User Role-Based Access Control (RBAC)
- **Role Hierarchy**:
  - `OWNER`: Full unrestricted access to financial P&L, system configurations, audits, and user management.
  - `MANAGER`: Store management, purchases, customer ledger, inventory adjustment, and staff supervision.
  - `BILLING_STAFF` (Cashier): Fast POS billing terminal, invoice printing, customer lookup, and cash collection.
  - `INVENTORY_STAFF`: Stock intake, purchase verification, damage adjustments, and stock auditing.
- JWT Access & Refresh Token authentication with granular resource-action permissions.

### 2. 🧾 Indian GST Billing & POS Terminal
- **Intra-State vs Inter-State Auto Detection**: Automatically applies CGST + SGST (within state) or IGST (inter-state) based on recipient state codes.
- **Tax Modes**: Supports both tax-exclusive and tax-inclusive pricing.
- **Payment Modes**: Cash, UPI / Dynamic QR Code, Credit / Debit Cards, Bank Transfer (NEFT/RTGS), and Store Credit.
- **Format Switcher**:
  - **A4 Standard GST Tax Invoice / Bill of Supply** (Original for Recipient, Duplicate for Transporter, Triplicate for Supplier) with HSN breakdown and amount in words.
  - **80mm Thermal Receipt** for fast checkout counters.
- **Dynamic UPI QR Code**: Built-in payment QR generated on the fly with invoice number and exact amount payable.

### 3. 📦 Real-Time Inventory & Stock Control
- Real-time stock deductions on billing and additions on purchase receipt.
- FIFO / Weighted Average Cost inventory valuation.
- Low-stock and out-of-stock threshold alerts.
- Stock movements audit ledger tracking every single addition, sale, manual adjustment, or damage.

### 4. 👥 Customers & Suppliers Ledger Management
- Complete B2B and B2C customer profiles with GSTIN validation.
- Real-time running balance statement and transaction ledger.
- Direct **WhatsApp payment reminder** generation.
- Receive partial payments and allocate them against specific invoices or general accounts.

### 5. 🛒 Purchase Orders & Inward Procurement
- Supplier order tracking, supplier invoice numbering, and multi-item procurement.
- Automatic stock replenishment upon order receipt.

### 6. 📊 Reports & Financial Analytics
- **Live Executive Dashboard**: Today's sales, monthly revenue, gross profit, net profit, total inventory value, and customer dues.
- **GST Summary Report**: Taxable turnover, CGST, SGST, IGST totals ready for GSTR-1 and GSTR-3B filing.
- **Profit & Loss (P&L)**: Revenue vs COGS vs Operating Expenses.
- **Excel / CSV Exports**: Export products, sales, customers, and ledger statements.

### 7. 🌐 Bilingual Hindi & English Support
- Full interface localization in both English and Hindi (हिन्दी) with seamless one-click switching.

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js 18+ & npm
- PostgreSQL database

### 1. Environment Configuration

**Backend (`backend/.env`)**:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/retailpro?schema=public"
JWT_ACCESS_SECRET="retailpro_super_secret_access_jwt_key_2026_production"
JWT_REFRESH_SECRET="retailpro_super_secret_refresh_jwt_key_2026_production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000"
```

**Frontend (`frontend/.env.local`)**:
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"
```

### 2. Database Setup & Seeding

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### 3. Start Backend Server

```bash
cd backend
npm run dev
# Running on http://localhost:5000 (API at http://localhost:5000/api/v1)
```

### 4. Start Frontend Server

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

---

## 🔑 Demo Login Credentials

The database is pre-seeded with a complete retail business dataset (**Sharma Agro & Retail Enterprises**):

| Role | Email | Password | Access Level |
|---|---|---|---|
| **👑 Owner** | `owner@retailpro.com` | `Password123!` | Complete unrestricted access & reports |
| **👔 Manager** | `manager@retailpro.com` | `Password123!` | Sales, purchases, inventory, customers |
| **💼 Cashier** | `cashier@retailpro.com` | `Password123!` | POS Billing & invoice printing |
| **📦 Inventory Staff** | `inventory@retailpro.com` | `Password123!` | Stock adjustments & purchase receiving |

*(You can also use the 1-Click Demo buttons directly on http://localhost:3000/login)*

---

## 📂 Project Architecture

```
Faishal/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Complete database schema (18 models)
│   │   └── seed.ts              # Database seeder with realistic retail data
│   └── src/
│       ├── config/              # Constants, permissions matrix, env
│       ├── db/                  # Prisma client instance
│       ├── middleware/          # Auth JWT, RBAC, Zod validator, rate limiters
│       ├── routes/              # Express API endpoints
│       ├── services/            # Business logic (Sales, GST, Stock, WhatsApp)
│       ├── utils/               # HTTP Errors, logger
│       ├── validators/          # Zod request validation schemas
│       ├── app.ts               # Express application configuration
│       └── server.ts            # Server bootstrap
└── frontend/
    └── src/
        ├── app/
        │   ├── dashboard/       # Executive metrics & sales trend charts
        │   ├── products/        # Catalog, filters, and add/edit forms
        │   ├── sales/           # Invoices list, POS billing, detail & print
        │   ├── customers/       # Customer ledger statement & payment modal
        │   ├── suppliers/       # Supplier directory & purchase history
        │   ├── purchases/       # Procurement orders & stock incoming
        │   ├── inventory/       # Stock balances & adjustment logs
        │   ├── expenses/        # Business expense tracker
        │   ├── reports/         # P&L, GST GSTR-1 report, inventory valuation
        │   ├── settings/        # Business profile, GST, UPI, WhatsApp
        │   └── login/           # Multi-role authentication & demo login
        ├── components/layout/   # Responsive AppShell, Topbar, Sidebar
        ├── contexts/            # AuthContext, I18nContext (EN/HI)
        └── lib/api.ts           # Axios client with auto JWT refresh interceptor
```

---

## 🛡 Security & Quality Assurances
- **Password Security**: Strong bcrypt salting (rounds: 10).
- **Session Security**: Short-lived access tokens with rotating refresh tokens.
- **SQL Injection Prevention**: Parameterized queries through Prisma ORM.
- **Input Validation**: Strict Zod schemas on all API endpoints.
- **State Codes & GSTIN**: Validated against Indian GST Council state code list.
- **Atomic Operations**: Database transactions ensure inventory stock balances, payments, and invoice allocations never desynchronize.
