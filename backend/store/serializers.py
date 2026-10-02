from rest_framework import serializers

from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "kind", "product_count"]


class CategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["name", "slug", "kind"]


class ProductListSerializer(serializers.ModelSerializer):
    category = CategoryBriefSerializer(read_only=True)
    on_sale = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "brand", "tagline", "price", "compare_at_price",
            "on_sale", "stock", "category", "color", "image_url", "featured",
        ]


class ProductDetailSerializer(ProductListSerializer):
    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ["description", "specs"]


class AdminProductSerializer(serializers.ModelSerializer):
    """Staff create and edit products from the dashboard."""
    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "brand", "category", "category_name", "tagline", "description",
            "price", "compare_at_price", "stock", "specs", "color", "image_url", "is_active", "featured",
        ]
        # The link (slug) is made from the name when a product is created and never changes,
        # so shared links and old orders keep working
        read_only_fields = ["slug"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be more than 0.")
        return value

    def validate_color(self, value):
        import re
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Use a hex colour like #1e3a8a.")
        return value

    def validate_specs(self, value):
        if not isinstance(value, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in value.items()):
            raise serializers.ValidationError("Specs must be name → value text pairs.")
        return value

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        compare = attrs.get("compare_at_price", getattr(self.instance, "compare_at_price", None))
        if compare is not None and price is not None and compare <= price:
            raise serializers.ValidationError({"compare_at_price": "The original price must be higher than the sale price."})
        return attrs

    def create(self, data):
        from django.utils.text import slugify
        base = slugify(data["name"])[:45] or "product"
        slug, n = base, 2
        while Product.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        data["slug"] = slug
        return super().create(data)
