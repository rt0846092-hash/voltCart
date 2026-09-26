import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the staff account from ADMIN_EMAIL / ADMIN_PASSWORD if it doesn't exist."

    def handle(self, *args, **options):
        email = os.getenv("ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("ADMIN_PASSWORD", "")
        if not email or not password:
            self.stdout.write("ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping.")
            return
        User = get_user_model()
        if User.objects.filter(username=email).exists():
            self.stdout.write(f"Admin {email} already exists.")
            return
        User.objects.create_superuser(username=email, email=email, password=password, first_name="Admin")
        self.stdout.write(self.style.SUCCESS(f"Created admin {email}."))
