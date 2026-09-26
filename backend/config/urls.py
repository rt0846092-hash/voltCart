from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import ChangePasswordView, LoginView, MeView, RegisterView
from orders.views import AdminOrderViewSet, AdminStatsView, OrderViewSet, stripe_webhook
from store.views import AdminProductViewSet, CategoryListView, ProductViewSet, store_config

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("orders", OrderViewSet, basename="order")
router.register("admin/orders", AdminOrderViewSet, basename="admin-order")
router.register("admin/products", AdminProductViewSet, basename="admin-product")

admin.site.site_header = "Voltcart admin"
admin.site.site_title = "Voltcart admin"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", lambda r: JsonResponse({"ok": True})),
    path("api/config/", store_config),
    path("api/categories/", CategoryListView.as_view()),
    path("api/auth/register/", RegisterView.as_view()),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/me/", MeView.as_view()),
    path("api/auth/change-password/", ChangePasswordView.as_view()),
    path("api/admin/stats/", AdminStatsView.as_view()),
    path("api/webhooks/stripe/", stripe_webhook),
    path("api/", include(router.urls)),
]
