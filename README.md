# 💊 PharmaTrack — Kenyan Pharmacy Management System

A full-stack pharmacy POS & inventory management system built for Kenyan pharmacies. Track sales, monitor stock, generate M-Pesa receipts, and gain insights into your most profitable medicines and categories.

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Django 4.x + Django REST Framework |
| Auth | SimpleJWT (access + refresh tokens) |
| Frontend | React 18 + Vite |
| Payments | Safaricom Daraja M-Pesa STK Push (dev bypass included) |
| Styling | Custom CSS (white & blue theme) + Bootstrap Icons |

---

## 📁 Project Structure

```
pharmatrack/
├── backend/
│   ├── pharmatrack/          # Django project
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── core/                 # Single Django app
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       └── urls.py
└── frontend/
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── utils/api.js
    │   ├── styles/main.css
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   ├── Navbar.jsx
    │   │   └── Sidebar.jsx
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Dashboard.jsx
    │       ├── POS.jsx
    │       ├── Inventory.jsx
    │       ├── Products.jsx
    │       ├── Suppliers.jsx
    │       ├── Reports.jsx
    │       ├── Users.jsx
    │       ├── Profile.jsx
    │       └── Settings.jsx
    └── package.json
```

---

## 🚀 Getting Started

### Backend Setup

```bash
# 1. Create & activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install django djangorestframework djangorestframework-simplejwt \
            django-cors-headers django-filter pillow python-dotenv

# 3. Configure environment
cp .env.example .env
# Edit .env with your DB credentials and secret key

# 4. Run migrations
python manage.py makemigrations core
python manage.py migrate

# 5. Create superuser (owner account)
python manage.py createsuperuser

# 6. Start server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` — login with your superuser credentials.

---

## 🔑 User Roles

| Role | Permissions |
|------|------------|
| **Owner** | Full access: reports, user management, settings, all CRUD |
| **Pharmacist** | POS, inventory, products, stock adjustments |
| **Cashier** | POS only |

---

## 🛒 POS Features

- Search products by name, generic name, or barcode scan
- Add walk-in or registered customers
- Cash / M-Pesa / Card / Insurance payment methods
- M-Pesa STK Push (bypassed in dev mode — set `MPESA_DEV_MODE=False` in production)
- Printable receipt with pharmacy name, items, totals, and change
- Auto stock deduction on sale completion

---

## 📊 Dashboard & Reports

- Today's sales, profit, and transaction count
- Monthly revenue and profit trends
- 7-day sales chart (line graph)
- Category revenue breakdown (pie/bar chart)
- Top 10 selling medicines (last 30 days)
- Low stock and expiry alerts

### Report Types (`/reports/`)

| `type` param | Description |
|-------------|-------------|
| `sales` | Daily sales totals in a date range |
| `profit` | Daily profit in a date range |
| `top_products` | Top products by revenue |
| `category` | Revenue by medicine category |

---

## 💳 M-Pesa Integration

In `settings.py`:

```python
MPESA_DEV_MODE = True          # Set False in production
MPESA_CONSUMER_KEY = ''
MPESA_CONSUMER_SECRET = ''
MPESA_SHORTCODE = ''
MPESA_PASSKEY = ''
MPESA_CALLBACK_URL = 'https://yourdomain.com/api/mpesa/callback/'
```

In dev mode, STK push is simulated and returns a mock success response instantly. Flip `MPESA_DEV_MODE=False` and fill in your Daraja credentials to go live.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login → returns JWT tokens |
| POST | `/api/auth/logout/` | Blacklist refresh token |
| GET/PATCH | `/api/auth/me/` | Current user profile |
| GET/POST | `/api/users/` | List / create users |
| GET/POST | `/api/products/` | List / create products |
| GET | `/api/products/low_stock/` | Products at/below reorder level |
| GET | `/api/products/expiring_soon/` | Expiring within 30 days |
| GET | `/api/products/search_pos/` | POS barcode/name search |
| GET/POST | `/api/sales/` | List / create sales |
| POST | `/api/sales/{slug}/refund/` | Refund a completed sale |
| GET/POST | `/api/stock-adjustments/` | Stock in/out/corrections |
| POST | `/api/mpesa/stk-push/` | Initiate M-Pesa payment |
| POST | `/api/mpesa/callback/` | Daraja webhook |
| GET | `/api/dashboard/` | Dashboard stats |
| GET | `/api/reports/` | Filterable reports |

---

## 🏪 Models Overview

- **User** — extended AbstractUser with `role` (owner/pharmacist/cashier)
- **Supplier** — medicine suppliers with slug-based lookup
- **Category** — medicine categories (antibiotics, painkillers, etc.)
- **Product** — full medicine catalogue with buying/selling price, stock, expiry
- **Customer** — registered customers with loyalty points
- **Sale** — transaction header with receipt number, payment method, totals
- **SaleItem** — line items per sale (product, qty, price snapshot)
- **StockAdjustment** — auditable log of all stock changes
- **MpesaTransaction** — M-Pesa STK push tracking

---

## 📝 Environment Variables (`.env`)

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=pharmatrack
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
MPESA_DEV_MODE=True
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=
```

---

## 📄 License

MIT — free for personal and commercial use.

---

Built with ❤️ for Kenyan pharmacies.