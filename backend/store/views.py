from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db.models import Count, F, Q
from rest_framework import generics, viewsets
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from orders.services import stripe_enabled

from .models import Category, Product
from .serializers import CategorySerializer, ProductDetailSerializer, ProductListSerializer


class ProductPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        # order_by is needed: Django ignores Meta.ordering on aggregated queries
        return Category.objects.annotate(
            product_count=Count("products", filter=Q(products__is_active=True))
        ).order_by("position", "name")


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/products/  with optional filters:
      ?search=  ?category=<slug>  ?min_price=  ?max_price=  ?in_stock=1
      ?on_sale=1  ?featured=1  ?ordering=price|-price|name|-created_at
    """
    lookup_field = "slug"
    pagination_class = ProductPagination
    ORDERINGS = {"price", "-price", "name", "-name", "-created_at"}

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == "retrieve" else ProductListSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True).select_related("category")
        p = self.request.query_params

        if search := p.get("search", "").strip():
            qs = qs.filter(
                Q(name__icontains=search) | Q(brand__icontains=search)
                | Q(tagline__icontains=search) | Q(category__name__icontains=search)
            )
        if category := p.get("category"):
            qs = qs.filter(category__slug=category)
        for param, lookup in (("min_price", "price__gte"), ("max_price", "price__lte")):
            if value := p.get(param):
                try:
                    qs = qs.filter(**{lookup: Decimal(value)})
                except InvalidOperation:
                    pass
        if p.get("in_stock") == "1":
            qs = qs.filter(stock__gt=0)
        if p.get("on_sale") == "1":
            qs = qs.filter(compare_at_price__gt=F("price"))
        if p.get("featured") == "1":
            qs = qs.filter(featured=True)
        if (ordering := p.get("ordering")) in self.ORDERINGS:
            qs = qs.order_by(ordering, "id")
        return qs


@api_view(["GET"])
def store_config(request):
    """Settings the frontend needs, so they're defined in one place."""
    return Response({
        "store_name": settings.STORE_NAME,
        "currency": settings.CURRENCY,
        "shipping_fee": str(settings.SHIPPING_FEE),
        "free_shipping_over": str(settings.FREE_SHIPPING_OVER),
        "card_payments": stripe_enabled(),
        "max_quantity": settings.MAX_QUANTITY_PER_ITEM,
    })
