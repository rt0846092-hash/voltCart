from django.contrib import admin

from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "kind", "position"]
    list_editable = ["position"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "brand", "category", "price", "stock", "is_active", "featured"]
    list_editable = ["price", "stock", "is_active", "featured"]
    list_filter = ["category", "is_active", "featured"]
    search_fields = ["name", "brand"]
    prepopulated_fields = {"slug": ["name"]}
