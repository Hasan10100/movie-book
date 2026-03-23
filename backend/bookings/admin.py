from django.contrib import admin
from .models import Show, Seat, Booking

admin.site.register(Show)
admin.site.register(Seat)
admin.site.register(Booking)