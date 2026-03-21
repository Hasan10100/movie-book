from django.urls import path
from . import views

urlpatterns = [
    path('', views.api_root, name='api_root'),
    path('shows/', views.create_show, name='create_show'),
    path('shows/<int:show_id>/seats/', views.get_seats, name='get_seats'),
    path('book/naive/', views.book_seat_naive, name='book_naive'),
    path('book/pessimistic/', views.book_seat_pessimistic, name='book_pessimistic'),
    path('book/optimistic/', views.book_seat_optimistic, name='book_optimistic'),
    path('bookings/', views.list_bookings, name='list_bookings'),
    path('clear-shows/', views.clear_shows, name='clear_shows'),
]
