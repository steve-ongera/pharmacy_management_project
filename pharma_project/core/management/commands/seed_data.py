"""
core/management/commands/seed_data.py

Usage:
    python manage.py seed_data
    python manage.py seed_data --months 6   # default
    python manage.py seed_data --months 12  # full year
    python manage.py seed_data --flush      # wipe existing data first
"""

import random
import uuid
from datetime import timedelta, date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

User = get_user_model()


# ── helpers ──────────────────────────────────────────────────────────────────

def rand_decimal(lo, hi, places=2):
    return round(Decimal(str(random.uniform(lo, hi))), places)


def rand_date_in_range(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def rand_phone():
    prefixes = ["0700", "0711", "0722", "0733", "0755", "0756", "0790", "0798"]
    return random.choice(prefixes) + "".join(str(random.randint(0, 9)) for _ in range(6))


def mpesa_ref():
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choices(chars, k=10))


# ── static seed data ─────────────────────────────────────────────────────────

USERS = [
    {"username": "alice_owner",  "first_name": "Alice",  "last_name": "Wanjiku",  "role": "owner",      "password": "Pass1234!"},
    {"username": "bob_pharm",    "first_name": "Bob",    "last_name": "Otieno",   "role": "pharmacist", "password": "Pass1234!"},
    {"username": "carol_pharm",  "first_name": "Carol",  "last_name": "Muthoni",  "role": "pharmacist", "password": "Pass1234!"},
    {"username": "dave_cash",    "first_name": "Dave",   "last_name": "Kamau",    "role": "cashier",    "password": "Pass1234!"},
    {"username": "eve_cash",     "first_name": "Eve",    "last_name": "Achieng",  "role": "cashier",    "password": "Pass1234!"},
]

SUPPLIERS = [
    {"name": "Regal Pharmaceuticals Ltd",  "contact_person": "James Ndegwa",  "phone": "0722100200", "county": "Nairobi"},
    {"name": "Cosmos Limited",             "contact_person": "Lucy Waweru",   "phone": "0733200300", "county": "Nairobi"},
    {"name": "Elys Chemical Industries",   "contact_person": "Peter Maina",   "phone": "0711300400", "county": "Kiambu"},
    {"name": "Beta Healthcare Group",      "contact_person": "Sarah Omondi",  "phone": "0700400500", "county": "Mombasa"},
    {"name": "Dawa Limited",               "contact_person": "John Kariuki",  "phone": "0755500600", "county": "Nairobi"},
    {"name": "Medivet Kenya",              "contact_person": "Grace Njeri",   "phone": "0798600700", "county": "Nakuru"},
]

CATEGORIES = [
    ("Analgesics & NSAIDs",       "Pain relief and anti-inflammatory medicines"),
    ("Antibiotics",               "Antibacterial agents for infections"),
    ("Antifungals",               "Medicines to treat fungal infections"),
    ("Antiparasitics",            "Medicines for parasitic infections including malaria"),
    ("Cardiovascular",            "Heart and blood pressure medicines"),
    ("Dermatology",               "Skin care and topical treatments"),
    ("Diabetes Management",       "Insulin and oral hypoglycaemics"),
    ("Gastrointestinal",          "Digestive and stomach medicines"),
    ("Nutrition & Supplements",   "Vitamins, minerals, and nutritional supplements"),
    ("Respiratory",               "Cough, cold, and asthma medicines"),
    ("Reproductive Health",       "Contraceptives and reproductive medicines"),
    ("Ophthalmology",             "Eye drops and treatments"),
    ("ENT",                       "Ear, nose, and throat products"),
    ("First Aid",                 "Wound care, bandages, antiseptics"),
    ("Medical Devices",           "Glucose meters, thermometers, gloves"),
]

# (name, generic_name, category_idx, unit, buying_price, selling_price, reorder_level, requires_rx, expiry_months_ahead)
PRODUCTS = [
    # Analgesics & NSAIDs (0)
    ("Panadol Extra 500mg",      "Paracetamol + Caffeine",    0, "strip",   25,   45,  20, False, 24),
    ("Brufen 400mg",             "Ibuprofen",                 0, "strip",   30,   60,  15, False, 24),
    ("Diclofenac Sodium 50mg",   "Diclofenac Sodium",         0, "strip",   18,   35,  15, True,  18),
    ("Morphine Sulphate 10mg",   "Morphine Sulphate",         0, "tablet",  60,  120,   5, True,  12),
    ("Tramadol 50mg",            "Tramadol HCl",              0, "capsule", 40,   80,  10, True,  18),
    ("Aspirin 300mg",            "Aspirin",                   0, "strip",   12,   22,  20, False, 36),

    # Antibiotics (1)
    ("Amoxicillin 500mg",        "Amoxicillin",               1, "capsule", 20,   45,  20, True,  18),
    ("Augmentin 625mg",          "Amoxicillin/Clavulanate",   1, "strip",   90,  180,  10, True,  18),
    ("Azithromycin 500mg",       "Azithromycin",              1, "strip",   55,  110,  10, True,  18),
    ("Ciprofloxacin 500mg",      "Ciprofloxacin",             1, "strip",   30,   65,  15, True,  18),
    ("Metronidazole 400mg",      "Metronidazole",             1, "strip",   15,   30,  15, True,  18),
    ("Doxycycline 100mg",        "Doxycycline HCl",           1, "capsule", 12,   25,  20, True,  18),
    ("Erythromycin 250mg",       "Erythromycin",              1, "strip",   25,   50,  15, True,  18),

    # Antifungals (2)
    ("Fluconazole 150mg",        "Fluconazole",               2, "capsule", 40,   85,  10, True,  24),
    ("Clotrimazole Cream 1%",    "Clotrimazole",              2, "tube",    60,  120,  10, False, 24),
    ("Ketoconazole Shampoo",     "Ketoconazole",              2, "bottle",  250, 480,   5, False, 24),

    # Antiparasitics / Malaria (3)
    ("Coartem 80/480mg",         "Artemether/Lumefantrine",   3, "strip",  150,  280,  15, True,  18),
    ("Malarone Adult",           "Atovaquone/Proguanil",      3, "strip",  600, 1100,   5, True,  18),
    ("Albendazole 400mg",        "Albendazole",               3, "tablet",  15,   30,  20, False, 24),
    ("Praziquantel 600mg",       "Praziquantel",              3, "tablet",  25,   50,  10, True,  24),
    ("Artesunate 200mg",         "Artesunate",                3, "strip",   90,  175,  10, True,  18),

    # Cardiovascular (4)
    ("Amlodipine 5mg",           "Amlodipine Besylate",       4, "strip",   25,   55,  15, True,  24),
    ("Lisinopril 10mg",          "Lisinopril",                4, "strip",   30,   60,  15, True,  24),
    ("Atenolol 50mg",            "Atenolol",                  4, "strip",   20,   40,  15, True,  24),
    ("Simvastatin 20mg",         "Simvastatin",               4, "strip",   35,   70,  15, True,  24),
    ("Warfarin 5mg",             "Warfarin Sodium",           4, "strip",   25,   55,  10, True,  12),
    ("Furosemide 40mg",          "Furosemide",                4, "strip",   15,   30,  15, True,  24),
    ("Digoxin 0.25mg",           "Digoxin",                   4, "strip",   18,   38,  10, True,  18),

    # Dermatology (5)
    ("Betnovate Cream",          "Betamethasone Valerate",    5, "tube",    80,  155,  10, True,  18),
    ("Calamine Lotion",          "Calamine",                  5, "bottle", 120,  210,  10, False, 24),
    ("Hydrocortisone 1% Cream",  "Hydrocortisone",            5, "tube",    65,  125,  10, False, 24),
    ("Whitfield Ointment",       "Benzoic Acid/Salicylic",    5, "tube",    40,   80,  10, False, 24),

    # Diabetes (6)
    ("Metformin 500mg",          "Metformin HCl",             6, "strip",   20,   40,  20, True,  24),
    ("Glibenclamide 5mg",        "Glibenclamide",             6, "strip",   12,   25,  15, True,  24),
    ("Insulin Mixtard 30/70",    "Insulin Human 30/70",       6, "vial",   650, 1200,   5, True,   6),
    ("Insulin Glargine 100IU",   "Insulin Glargine",          6, "vial",  2200, 3800,   3, True,   6),

    # Gastrointestinal (7)
    ("Omeprazole 20mg",          "Omeprazole",                7, "capsule", 15,   30,  20, False, 24),
    ("Ranitidine 150mg",         "Ranitidine HCl",            7, "strip",   12,   25,  20, False, 24),
    ("Buscopan 10mg",            "Hyoscine Butylbromide",     7, "strip",   35,   70,  15, False, 24),
    ("Lactulose Syrup",          "Lactulose",                 7, "bottle", 180,  330,  10, False, 18),
    ("Oral Rehydration Salts",   "ORS WHO Formula",           7, "sachet",   5,   12,  50, False, 24),
    ("Loperamide 2mg",           "Loperamide HCl",            7, "capsule", 10,   22,  20, False, 24),

    # Nutrition & Supplements (8)
    ("Vitamin C 500mg",          "Ascorbic Acid",             8, "strip",   12,   25,  30, False, 36),
    ("Folic Acid 5mg",           "Folic Acid",                8, "strip",    8,   18,  30, False, 36),
    ("Ferrous Sulphate 200mg",   "Ferrous Sulphate",          8, "strip",    8,   18,  30, False, 36),
    ("Vitamin B Complex",        "B-Complex Vitamins",        8, "strip",   15,   30,  25, False, 36),
    ("Calcium + Vit D3",         "Calcium Carbonate+Vit D3",  8, "strip",   30,   60,  20, False, 24),
    ("Zinc Sulphate 20mg",       "Zinc Sulphate",             8, "sachet",   6,   14,  30, False, 24),

    # Respiratory (9)
    ("Salbutamol Inhaler 100mcg","Salbutamol",                9, "piece",  220,  420,  10, True,  18),
    ("Beclometasone 100mcg",     "Beclometasone Dipropionate",9, "piece",  550,  950,   5, True,  18),
    ("Piriton Syrup",            "Chlorphenamine Maleate",    9, "bottle", 110,  200,  15, False, 24),
    ("Loratadine 10mg",          "Loratadine",                9, "strip",   15,   30,  20, False, 24),
    ("Ambroxol Syrup",           "Ambroxol HCl",              9, "bottle", 130,  240,  10, False, 18),
    ("Prednisolone 5mg",         "Prednisolone",              9, "strip",   15,   30,  15, True,  24),

    # Reproductive Health (10)
    ("Postinor-2",               "Levonorgestrel",           10, "strip",  120,  250,  10, False, 24),
    ("Microgynon 30",            "Ethinylestradiol/LNG",     10, "strip",   60,  130,  10, True,  24),
    ("Femiplan Injection",       "Medroxyprogesterone",      10, "vial",   180,  350,   5, True,  18),

    # Ophthalmology (11)
    ("Chloramphenicol Eye Drops","Chloramphenicol",          11, "bottle",  60,  120,  10, True,  12),
    ("Gentamicin Eye Drops",     "Gentamicin",               11, "bottle",  55,  110,  10, True,  12),
    ("Artificial Tears",         "Carbomer 0.2%",            11, "bottle",  90,  170,  10, False, 18),

    # ENT (12)
    ("Otrivin Nasal Spray",      "Xylometazoline",           12, "bottle", 130,  250,  10, False, 18),
    ("Waxsol Ear Drops",         "Docusate Sodium",          12, "bottle",  80,  160,  10, False, 24),

    # First Aid (13)
    ("Savlon Antiseptic Liquid", "Chlorhexidine/Cetrimide",  13, "bottle", 150,  280,  15, False, 36),
    ("Gentian Violet 0.5%",      "Crystal Violet",           13, "bottle",  40,   80,  15, False, 36),
    ("Hydrogen Peroxide 3%",     "Hydrogen Peroxide",        13, "bottle",  55,   95,  15, False, 24),
    ("Plaster/Bandage Roll",     "Cotton Bandage",           13, "piece",   30,   60,  20, False, 60),

    # Medical Devices (14)
    ("Accu-Chek Strips x50",     "Blood Glucose Test Strips",14, "box",   900, 1600,   5, False, 12),
    ("Digital Thermometer",      "Clinical Thermometer",     14, "piece",  250,  480,  10, False, 60),
    ("Disposable Gloves M x100", "Nitrile Gloves",           14, "box",   550,  950,  10, False, 60),
    ("Surgical Mask x50",        "3-Ply Surgical Mask",      14, "box",   250,  450,  10, False, 36),
    ("Alcohol Hand Gel 500ml",   "Isopropyl Alcohol 70%",    14, "bottle", 180,  320,  10, False, 24),
]

CUSTOMER_NAMES = [
    "Mary Wanjiku", "John Kamau", "Grace Otieno", "Peter Mwangi", "Lucy Achieng",
    "David Njoroge", "Sarah Mutua", "James Odhiambo", "Ann Wangari", "Paul Cheruiyot",
    "Esther Njoki", "Michael Omondi", "Faith Muthoni", "George Kiprotich", "Lydia Awuor",
    "Joseph Maina", "Beatrice Ndegwa", "Charles Kimani", "Mercy Wekesa", "Patrick Owino",
    "Caroline Nganga", "Isaac Korir", "Priscilla Makena", "Samuel Ruto", "Leah Wairimu",
    "Daniel Gitau", "Hannah Atieno", "Alex Njenga", "Rachel Nyambura", "Stephen Ndung'u",
    "Agnes Chepkemoi", "Francis Muriuki", "Dorothy Auma", "Simon Njuguna", "Purity Wanjiru",
    "Edwin Rotich", "Josephine Adhiambo", "Denis Mwenda", "Tabitha Njeru", "Victor Kipkorir",
    "Jane Moraa", "Anthony Musyoki", "Irene Nyaguthii", "Robert Ochieng", "Winnie Chebet",
    "Gerald Mwangi", "Naomi Wambui", "Edward Sang", "Ruth Wanjala", "Lawrence Omolo",
]


class Command(BaseCommand):
    help = "Seed the database with realistic pharmacy data for 6+ months"

    def add_arguments(self, parser):
        parser.add_argument("--months", type=int, default=6)
        parser.add_argument("--flush", action="store_true", help="Delete existing data first")

    def handle(self, *args, **options):
        months = options["months"]
        flush = options["flush"]

        # import models here to avoid AppRegistryNotReady at module level
        from core.models import (
            Supplier, Category, Product, Customer,
            Sale, SaleItem, StockAdjustment, MpesaTransaction,
        )

        if flush:
            self.stdout.write(self.style.WARNING("Flushing existing data…"))
            MpesaTransaction.objects.all().delete()
            SaleItem.objects.all().delete()
            Sale.objects.all().delete()
            StockAdjustment.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            Supplier.objects.all().delete()
            Customer.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        today = timezone.now().date()
        start_date = today - timedelta(days=30 * months)

        with transaction.atomic():
            # ── users ──────────────────────────────────────────────────────
            self.stdout.write("Creating users…")
            staff = []
            for u in USERS:
                obj, created = User.objects.get_or_create(
                    username=u["username"],
                    defaults={
                        "first_name": u["first_name"],
                        "last_name":  u["last_name"],
                        "role":       u["role"],
                        "phone":      rand_phone(),
                        "is_active":  True,
                    },
                )
                if created:
                    obj.set_password(u["password"])
                    obj.save()
                staff.append(obj)

            cashiers     = [s for s in staff if s.role in ("cashier", "pharmacist", "owner")]
            pharmacists  = [s for s in staff if s.role in ("pharmacist", "owner")]

            # ── suppliers ──────────────────────────────────────────────────
            self.stdout.write("Creating suppliers…")
            supplier_objs = []
            for s in SUPPLIERS:
                obj, _ = Supplier.objects.get_or_create(
                    name=s["name"],
                    defaults={**s, "is_active": True},
                )
                supplier_objs.append(obj)

            # ── categories ─────────────────────────────────────────────────
            self.stdout.write("Creating categories…")
            cat_objs = []
            for name, desc in CATEGORIES:
                obj, _ = Category.objects.get_or_create(name=name, defaults={"description": desc})
                cat_objs.append(obj)

            # ── products ───────────────────────────────────────────────────
            self.stdout.write("Creating products…")
            product_objs = []
            for row in PRODUCTS:
                name, generic, cat_idx, unit, bp, sp, reorder, rx, exp_months = row
                expiry = today + timedelta(days=30 * exp_months)
                obj, _ = Product.objects.get_or_create(
                    name=name,
                    defaults={
                        "generic_name":         generic,
                        "category":             cat_objs[cat_idx],
                        "supplier":             random.choice(supplier_objs),
                        "unit":                 unit,
                        "buying_price":         Decimal(str(bp)),
                        "selling_price":        Decimal(str(sp)),
                        "stock_quantity":       random.randint(reorder * 3, reorder * 10),
                        "reorder_level":        reorder,
                        "expiry_date":          expiry,
                        "requires_prescription": rx,
                        "is_active":            True,
                    },
                )
                product_objs.append(obj)

            # ── customers ──────────────────────────────────────────────────
            self.stdout.write("Creating customers…")
            customer_objs = []
            for name in CUSTOMER_NAMES:
                obj, _ = Customer.objects.get_or_create(
                    name=name,
                    defaults={"phone": rand_phone(), "loyalty_points": random.randint(0, 500)},
                )
                customer_objs.append(obj)

            # ── stock adjustments (initial restocks) ───────────────────────
            self.stdout.write("Creating initial stock adjustments…")
            for product in product_objs:
                adj_date = start_date - timedelta(days=5)
                StockAdjustment.objects.create(
                    product=product,
                    adjusted_by=random.choice(pharmacists),
                    reason="purchase",
                    quantity_change=product.stock_quantity,
                    previous_quantity=0,
                    new_quantity=product.stock_quantity,
                    notes="Initial opening stock",
                    created_at=timezone.make_aware(
                        timezone.datetime.combine(adj_date, timezone.datetime.min.time())
                    ),
                )

            # ── sales ──────────────────────────────────────────────────────
            self.stdout.write(f"Creating sales for {months} months…")
            payment_methods = ["cash", "mpesa", "card", "insurance"]
            payment_weights = [0.40, 0.45, 0.10, 0.05]
            current = start_date
            sale_count = 0

            while current <= today:
                # weekday multiplier: more sales Mon-Sat
                is_weekend = current.weekday() == 6  # Sunday
                daily_sales = random.randint(3, 8) if is_weekend else random.randint(12, 30)

                # first-of-month bump (paydays in Kenya)
                if current.day in (1, 2, 3, 28, 29, 30, 31):
                    daily_sales = int(daily_sales * 1.35)

                for _ in range(daily_sales):
                    # pick a random time during business hours
                    hour   = random.randint(8, 19)
                    minute = random.randint(0, 59)
                    sale_dt = timezone.make_aware(
                        timezone.datetime(current.year, current.month, current.day, hour, minute)
                    )

                    customer    = random.choice([None, None, random.choice(customer_objs)])
                    served_by   = random.choice(cashiers)
                    payment     = random.choices(payment_methods, weights=payment_weights, k=1)[0]
                    n_items     = random.choices([1, 2, 3, 4, 5], weights=[40, 25, 18, 10, 7], k=1)[0]
                    items_pool  = random.sample(product_objs, min(n_items, len(product_objs)))

                    subtotal = Decimal("0")
                    item_data = []
                    for product in items_pool:
                        qty   = random.randint(1, 4)
                        price = product.selling_price
                        disc  = Decimal("0")
                        if random.random() < 0.08:           # 8 % chance of line discount
                            disc = round(price * Decimal("0.05") * qty, 2)
                        line_total = price * qty - disc
                        subtotal  += line_total
                        item_data.append((product, qty, price, product.buying_price, disc, line_total))

                    discount     = Decimal("0")
                    if random.random() < 0.05:               # 5 % chance of overall discount
                        discount = round(subtotal * Decimal("0.05"), 2)
                    tax          = Decimal("0")              # most Kenyan pharmacy sales are VAT-exempt
                    total        = subtotal - discount + tax
                    amount_paid  = total
                    if payment == "cash":
                        # round up to nearest 50
                        amount_paid = Decimal(str(int((total / 50).to_integral_value() * 50 + 50)))
                        if amount_paid < total:
                            amount_paid += Decimal("50")
                    change       = amount_paid - total

                    # build receipt number manually to avoid date-collision issues in bulk
                    prefix  = f"RCP{current.strftime('%Y%m%d')}"
                    sale_count += 1
                    receipt = f"{prefix}-{sale_count:05d}"
                    slug    = slugify(receipt)

                    sale = Sale.objects.create(
                        receipt_number = receipt,
                        slug           = slug,
                        customer       = customer,
                        served_by      = served_by,
                        payment_method = payment,
                        mpesa_reference= mpesa_ref() if payment == "mpesa" else "",
                        subtotal       = subtotal,
                        discount       = discount,
                        tax            = tax,
                        total_amount   = total,
                        amount_paid    = amount_paid,
                        change_given   = change,
                        status         = "completed",
                        created_at     = sale_dt,
                    )

                    for product, qty, price, bp, disc, line_total in item_data:
                        SaleItem.objects.create(
                            sale         = sale,
                            product      = product,
                            quantity     = qty,
                            unit_price   = price,
                            buying_price = bp,
                            discount     = disc,
                            total_price  = line_total,
                        )

                    # M-Pesa transaction record
                    if payment == "mpesa":
                        MpesaTransaction.objects.create(
                            sale                  = sale,
                            phone_number          = rand_phone(),
                            amount                = total,
                            merchant_request_id   = uuid.uuid4().hex[:20],
                            checkout_request_id   = uuid.uuid4().hex[:20],
                            mpesa_receipt_number  = sale.mpesa_reference,
                            status                = "success",
                            result_desc           = "The service request is processed successfully.",
                            created_at            = sale_dt,
                        )

                    # loyalty points for known customer
                    if customer:
                        pts = int(total / 100)   # 1 point per KES 100
                        Customer.objects.filter(pk=customer.pk).update(
                            loyalty_points=customer.loyalty_points + pts
                        )

                # mid-month restock adjustment
                if current.day == 15:
                    prods_to_restock = [p for p in product_objs if p.stock_quantity <= p.reorder_level * 2]
                    for product in random.sample(prods_to_restock or product_objs, min(8, len(product_objs))):
                        qty_add = random.randint(product.reorder_level * 2, product.reorder_level * 5)
                        prev_qty = product.stock_quantity
                        product.stock_quantity += qty_add
                        product.save(update_fields=["stock_quantity"])
                        StockAdjustment.objects.create(
                            product=product,
                            adjusted_by=random.choice(pharmacists),
                            reason="purchase",
                            quantity_change=qty_add,
                            previous_quantity=prev_qty,
                            new_quantity=product.stock_quantity,
                            notes=f"Mid-month restock — {current.strftime('%B %Y')}",
                            created_at=timezone.make_aware(
                                timezone.datetime.combine(current, timezone.datetime.min.time())
                            ),
                        )

                # occasional damage/loss write-off
                if random.random() < 0.03:   # ~3 % of days
                    product = random.choice(product_objs)
                    qty_lost = random.randint(1, 5)
                    if product.stock_quantity >= qty_lost:
                        prev = product.stock_quantity
                        product.stock_quantity -= qty_lost
                        product.save(update_fields=["stock_quantity"])
                        StockAdjustment.objects.create(
                            product=product,
                            adjusted_by=random.choice(pharmacists),
                            reason=random.choice(["damage", "theft"]),
                            quantity_change=-qty_lost,
                            previous_quantity=prev,
                            new_quantity=product.stock_quantity,
                            notes="Written off after stock count",
                            created_at=timezone.make_aware(
                                timezone.datetime.combine(current, timezone.datetime.min.time())
                            ),
                        )

                current += timedelta(days=1)

            # ── add a few pending / cancelled sales (last 30 days) ─────────
            self.stdout.write("Creating pending/refunded sales…")
            for status in ["pending", "refunded", "cancelled"]:
                for _ in range(random.randint(2, 5)):
                    sale_date = rand_date_in_range(today - timedelta(days=30), today)
                    sale_dt   = timezone.make_aware(
                        timezone.datetime.combine(sale_date, timezone.datetime.min.time())
                    )
                    product   = random.choice(product_objs)
                    qty       = random.randint(1, 3)
                    total     = product.selling_price * qty
                    sale_count += 1
                    receipt   = f"RCP{sale_date.strftime('%Y%m%d')}-{sale_count:05d}"

                    Sale.objects.create(
                        receipt_number = receipt,
                        slug           = slugify(receipt),
                        customer       = random.choice(customer_objs),
                        served_by      = random.choice(cashiers),
                        payment_method = "cash",
                        subtotal       = total,
                        discount       = Decimal("0"),
                        tax            = Decimal("0"),
                        total_amount   = total,
                        amount_paid    = total if status != "pending" else Decimal("0"),
                        change_given   = Decimal("0"),
                        status         = status,
                        notes          = f"Seeded {status} sale",
                        created_at     = sale_dt,
                    )

        self.stdout.write(self.style.SUCCESS(
            f"\n✅  Seed complete!\n"
            f"   Users      : {User.objects.count()}\n"
            f"   Suppliers  : {Supplier.objects.count()}\n"
            f"   Categories : {Category.objects.count()}\n"
            f"   Products   : {Product.objects.count()}\n"
            f"   Customers  : {Customer.objects.count()}\n"
            f"   Sales      : {Sale.objects.count()}\n"
            f"   Sale items : {SaleItem.objects.count()}\n"
            f"   Adjustments: {StockAdjustment.objects.count()}\n"
            f"   M-Pesa txns: {MpesaTransaction.objects.count()}\n"
        ))