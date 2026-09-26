from django.db import models


class Category(models.Model):
    # `kind` picks the illustration the frontend draws for products in this category
    KINDS = [
        ("phone", "Phone"),
        ("laptop", "Laptop"),
        ("audio", "Audio"),
        ("watch", "Watch"),
        ("gaming", "Gaming"),
        ("accessory", "Accessory"),
    ]

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(unique=True)
    kind = models.CharField(max_length=20, choices=KINDS, default="accessory")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    brand = models.CharField(max_length=60)
    tagline = models.CharField(max_length=160)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Original price, shown crossed out when the product is on sale.",
    )
    stock = models.PositiveIntegerField(default=0)
    specs = models.JSONField(default=dict, blank=True, help_text='e.g. {"Battery": "20 hours"}')
    color = models.CharField(max_length=7, default="#1f2937", help_text="Hex colour for the product artwork.")
    image_url = models.URLField(blank=True, help_text="Optional photo. Artwork is drawn when empty.")
    is_active = models.BooleanField(default=True)
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-featured", "name"]
        indexes = [models.Index(fields=["is_active", "category"])]
        constraints = [
            models.CheckConstraint(check=models.Q(price__gt=0), name="product_price_positive"),
        ]

    def __str__(self):
        return self.name

    @property
    def on_sale(self):
        return bool(self.compare_at_price and self.compare_at_price > self.price)
