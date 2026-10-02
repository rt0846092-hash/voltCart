from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_staff"]


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Try logging in.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"], User(username=attrs["email"], email=attrs["email"]))
        return attrs

    def create(self, data):
        # The email doubles as the username, so people log in with their email
        return User.objects.create_user(
            username=data["email"], email=data["email"],
            password=data["password"], first_name=data["name"].strip(),
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ProfileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError("Your current password is wrong.")
        return value

    def validate(self, attrs):
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "Choose a password different from your current one."})
        validate_password(attrs["new_password"], self.context["user"])
        return attrs



class RevocableTokenRefreshSerializer(TokenRefreshSerializer):
    """Refuse to refresh a login made before the password was changed, or for a disabled account."""

    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user = User.objects.filter(pk=refresh.payload.get(api_settings.USER_ID_CLAIM), is_active=True).first()
        claim = refresh.payload.get(api_settings.REVOKE_TOKEN_CLAIM)
        if user is None or claim != get_md5_hash_password(user.password):
            raise InvalidToken("This login has expired. Please log in again.")
        return super().validate(attrs)
