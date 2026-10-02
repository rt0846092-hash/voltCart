from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from store.models import Category, Product

def unsplash(photo_id):
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w=900&q=70"


# Free photos from Unsplash (Unsplash License), chosen without visible brand logos where possible
PHOTOS = {
    "nova-x-pro": unsplash("1592890288564-76628a30a657"),          # Jonas Leupe
    "nova-lite-5": unsplash("1585060544812-6b45742d762f"),         # Vojtech Bruzek
    "kite-fold": unsplash("1634403665481-74948d815f03"),           # Matteo Vella
    "aero-book-14": unsplash("1496181133206-80ce9b88a853"),        # Kari Shea
    "aero-book-16-studio": unsplash("1484788984921-03950022c9ef"), # Alex Knight
    "vertex-15-gaming": unsplash("1531297484001-80022131f5a1"),    # Ales Nesetril
    "pulse-anc-headphones": unsplash("1505740420928-5e560c06d30e"),# C D-X
    "rift-headset-pro": unsplash("1618366712010-f4ae9c647dcb"),    # Luke Peterson
}

# Brands are invented so the demo doesn't look like it sells other companies' products
CATEGORIES = [
    ("Phones", "phone"), ("Laptops", "laptop"), ("Audio", "audio"),
    ("Wearables", "watch"), ("Gaming", "gaming"), ("Accessories", "accessory"),
]

PRODUCTS = [
    # name, brand, category, price, compare_at, stock, featured, color, tagline, specs
    ("Nova X Pro", "Nova", "Phones", "899", "999", 14, True, "#1e3a8a",
     "6.7-inch OLED, triple camera, two-day battery.",
     {"Display": "6.7\" OLED, 120 Hz", "Storage": "256 GB", "Camera": "50 MP triple", "Battery": "5,000 mAh"}),
    ("Nova Lite 5", "Nova", "Phones", "329", None, 30, False, "#0f766e",
     "Everything you need, at a price that makes sense.",
     {"Display": "6.4\" LCD, 90 Hz", "Storage": "128 GB", "Camera": "48 MP dual", "Battery": "4,500 mAh"}),
    ("Kite Fold", "Kite", "Phones", "1299", None, 3, False, "#6d28d9",
     "A phone that opens into a tablet.",
     {"Display": "7.6\" foldable OLED", "Storage": "512 GB", "Camera": "50 MP", "Weight": "239 g"}),
    ("Aero Book 14", "Aero", "Laptops", "1149", "1299", 9, True, "#334155",
     "All-day battery in a 1.2 kg aluminium body.",
     {"Processor": "8-core, 3.8 GHz", "Memory": "16 GB", "Storage": "512 GB SSD", "Battery": "Up to 18 hours"}),
    ("Aero Book 16 Studio", "Aero", "Laptops", "1899", None, 4, False, "#111827",
     "A 16-inch creator laptop with a colour-accurate screen.",
     {"Processor": "12-core, 4.2 GHz", "Memory": "32 GB", "Storage": "1 TB SSD", "Display": "16\" 3K, 100% DCI-P3"}),
    ("Vertex 15 Gaming", "Vertex", "Laptops", "1499", None, 0, False, "#991b1b",
     "Fast refresh, fast graphics, fast everything.",
     {"Graphics": "8 GB dedicated", "Display": "15.6\" 165 Hz", "Memory": "16 GB", "Storage": "1 TB SSD"}),
    ("Pulse ANC Headphones", "Pulse", "Audio", "249", "299", 22, True, "#0f172a",
     "Noise cancelling that lets you hear only what you want.",
     {"Battery": "30 hours", "Noise cancelling": "Adaptive", "Weight": "250 g", "Connection": "Bluetooth 5.3"}),
    ("Pulse Buds 2", "Pulse", "Audio", "129", None, 40, False, "#e11d48",
     "Tiny earbuds with a big, clear sound.",
     {"Battery": "8 h (+24 h case)", "Water resistance": "IPX4", "Charging": "USB-C, wireless"}),
    ("Echo Mini Speaker", "Echo", "Audio", "59", "79", 5, False, "#ea580c",
     "Pocket-sized speaker, waterproof and loud.",
     {"Battery": "12 hours", "Water resistance": "IP67", "Weight": "210 g"}),
    ("Orbit Watch S", "Orbit", "Wearables", "299", None, 16, True, "#0369a1",
     "Health tracking and notifications on your wrist.",
     {"Display": "1.9\" AMOLED", "Battery": "Up to 7 days", "Sensors": "Heart rate, SpO2, GPS", "Water": "5 ATM"}),
    ("Orbit Band 3", "Orbit", "Wearables", "79", None, 35, False, "#15803d",
     "A slim fitness band with a two-week battery.",
     {"Battery": "14 days", "Sensors": "Heart rate, sleep", "Water": "5 ATM"}),
    ("Rift Controller", "Rift", "Gaming", "69", None, 25, False, "#7c3aed",
     "Wireless controller with low-latency play.",
     {"Connection": "2.4 GHz + Bluetooth", "Battery": "40 hours", "Works with": "PC, Android, iOS"}),
    ("Rift Handheld", "Rift", "Gaming", "499", "549", 2, True, "#111827",
     "Your PC game library, in your hands.",
     {"Display": "7\" 120 Hz", "Storage": "512 GB", "Battery": "3–8 hours"}),
    ("Rift Headset Pro", "Rift", "Gaming", "149", None, 12, False, "#be123c",
     "Surround sound and a crystal-clear mic.",
     {"Audio": "7.1 virtual surround", "Mic": "Detachable, noise-reducing", "Connection": "USB-C / 3.5 mm"}),
    ("Volt 65W Charger", "Volt", "Accessories", "45", None, 60, False, "#16a34a",
     "Charges your laptop, phone and earbuds from one plug.",
     {"Output": "65 W total", "Ports": "2 × USB-C, 1 × USB-A", "Technology": "GaN"}),
    ("Volt Power Bank 20K", "Volt", "Accessories", "59", None, 18, False, "#ca8a04",
     "Charge your phone four times on the go.",
     {"Capacity": "20,000 mAh", "Output": "30 W USB-C", "Weight": "350 g"}),
    ("Keys Mech 75", "Keys", "Accessories", "119", "139", 7, False, "#475569",
     "A compact mechanical keyboard that sounds great.",
     {"Layout": "75%", "Switches": "Hot-swappable", "Connection": "USB-C / Bluetooth"}),
    ("Glide Wireless Mouse", "Glide", "Accessories", "49", None, 0, False, "#0e7490",
     "Silent clicks and a battery that lasts months.",
     {"Battery": "Up to 70 days", "DPI": "400–4,000", "Connection": "Bluetooth / 2.4 GHz"}),
]


class Command(BaseCommand):
    help = "Add sample categories and products. Does nothing if products already exist."

    def handle(self, *args, **options):
        if Product.objects.exists():
            self.stdout.write("Products already exist; skipping.")
            return
        cats = {}
        for i, (name, kind) in enumerate(CATEGORIES):
            cats[name], _ = Category.objects.get_or_create(
                slug=slugify(name), defaults={"name": name, "kind": kind, "position": i}
            )
        for (name, brand, cat, price, compare, stock, featured, color, tagline, specs) in PRODUCTS:
            Product.objects.create(
                name=name, slug=slugify(name), brand=brand, category=cats[cat],
                price=Decimal(price), compare_at_price=Decimal(compare) if compare else None,
                stock=stock, featured=featured, color=color, tagline=tagline, specs=specs,
                image_url=PHOTOS.get(slugify(name), ""),
                description=(
                    f"{tagline} The {name} from {brand} is built for everyday use, "
                    f"with a design that's easy to live with and specs that hold up. "
                    f"Ships free on orders over $100, with a 30-day return window."
                ),
            )
        self.stdout.write(self.style.SUCCESS(f"Added {len(PRODUCTS)} products in {len(CATEGORIES)} categories."))
