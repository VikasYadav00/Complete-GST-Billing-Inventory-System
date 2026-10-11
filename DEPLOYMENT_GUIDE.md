# 🚀 Deployment Guide: RetailPro Complete GST Billing & Inventory System

Ye guide aapko **Render** aur **Railway** par pura system (Frontend + Backend + PostgreSQL Database) deploy karne ka aasan tarika batati hai.

---

## 🌟 Option 1: Render par Deploy Karein (Sabse Simple & Free)

Render par aapka Frontend, Backend aur Database teeno deploy ho jayenge.

### Step 1: Render Account Banayein
1. [render.com](https://render.com) par jayein aur **Sign In with GitHub** karein.

---

### Step 2: PostgreSQL Database Banayein
1. Render Dashboard mein **New +** button par click karein aur **PostgreSQL** select karein.
2. Form bharein:
   - **Name**: `retailpro-db`
   - **Database**: `retailpro`
   - **User**: `retailpro_user`
   - **Region**: Oregon (ya koi bhi)
   - **Plan**: **Free**
3. **Create Database** par click karein.
4. Database banne ke baad **Internal Database URL** ya **External Database URL** copy kar lein (ye `DATABASE_URL` banega).

---

### Step 3: Backend Web Service Deploy Karein
1. Render Dashboard mein **New +** -> **Web Service** par click karein.
2. Apna GitHub repository connect karein: `VikasYadav00/Complete-GST-Billing-Inventory-System`.
3. Configuration settings bharein:
   - **Name**: `retailpro-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Free**
4. **Environment Variables** section mein Add karein:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Step 2 mein copy kiya hua Database URL)*
   - `CORS_ORIGIN`: `*`
   - `JWT_ACCESS_SECRET`: `retailpro_jwt_access_secret_2026_xyz`
   - `JWT_REFRESH_SECRET`: `retailpro_jwt_refresh_secret_2026_xyz`
5. **Create Web Service** par click karein.
6. Backend deploy hone ke baad aapko ek live URL milega (jaise `https://retailpro-backend.onrender.com`).
   Isko copy kar lein!

---

### Step 4: Database mein Tables aur Data Setup Karein
Jab backend deploy ho jaye:
1. Render backend service ke **Shell** tab par jayein.
2. Ye command run karein:
   ```bash
   npm run db:setup
   ```
   *(Ye command database schema push karegi aur sample products/categories/admin user create kar degi!)*

---

### Step 5: Frontend (Next.js) Web Service Deploy Karein
1. Render Dashboard mein dubara **New +** -> **Web Service** par click karein.
2. Vahi GitHub repository select karein: `VikasYadav00/Complete-GST-Billing-Inventory-System`.
3. Settings bharein:
   - **Name**: `retailpro-frontend`
   - **Root Directory**: `frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Free**
4. **Environment Variables** section mein add karein:
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_API_URL`: `https://retailpro-backend.onrender.com/api/v1` *(Apna Step 3 wala backend URL + `/api/v1`)*
5. **Create Web Service** par click karein.
6. Deploy complete hote hi aapka frontend live link taiyaar hai! 🎉

---

## 🚂 Option 2: Railway par Deploy Karein (Fastest & 1-Project Canvas)

Railway par ek hi project canvas ke andar Frontend, Backend aur Database add ho jate hain:

1. [railway.app](https://railway.app) par login karein via GitHub.
2. **New Project** -> **Provision PostgreSQL** par click karein.
3. Project canvas mein **+ Create** -> **GitHub Repo** par click karein aur `Complete-GST-Billing-Inventory-System` select karein.
4. **Backend Setup**:
   - Service settings mein **Root Directory** = `backend` set karein.
   - Variables mein add karein:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` *(Railway auto-link kar deta hai)*
     - `CORS_ORIGIN`: `*`
   - Deploy karein aur public networking enable karein.
5. **Frontend Setup**:
   - Canvas mein **+ Create** -> dubara vahi repo select karein.
   - Settings mein **Root Directory** = `frontend` set karein.
   - Variable mein add karein:
     - `NEXT_PUBLIC_API_URL`: `https://<backend-domain>.up.railway.app/api/v1`
   - Deploy karein aur public domain generate karein.

---

## 🔐 Default Login Credentials (After `db:setup`)
Database setup hone ke baad aap in credentials se login kar sakte hain:
- **Email**: `owner@retailpro.com`
- **Password**: `Password123!`
*(Ya fir registration tab se naya business account register kar sakte hain!)*
