import time
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db import transaction, IntegrityError
from django.utils import timezone
from .models import Show, Seat, Booking
from .serializers import ShowSerializer, SeatSerializer, BookingSerializer
from django.db import transaction, IntegrityError, OperationalError, models

class ShowViewSet(viewsets.ModelViewSet):
    queryset = Show.objects.all()
    serializer_class = ShowSerializer

@api_view(['GET'])
def get_seats(request, show_id):
    seats = Seat.objects.filter(show_id=show_id).order_by('seat_number')
    serializer = SeatSerializer(seats, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def list_bookings(request):
    bookings = Booking.objects.all()
    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def book_seat_naive(request):
    # Naive implementation vulnerable to race conditions.

    seat_id = request.data.get('seat_id')
    user_name = request.data.get('user_name')
    
    try:
        seat = Seat.objects.get(id=seat_id)
        
        if seat.status == 'AVAILABLE':
            # Simulate processing delay to make race condition more likely
            time.sleep(2)
            
            seat.status = 'BOOKED'
            seat.save()
            
            try:
                booking = Booking.objects.create(seat=seat, user_name=user_name)
                return Response({"message": f"Seat {seat.seat_number} booked successfully (naive)!"}, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"error": "Race condition detected! Double booking prevented by DB constraint."}, status=status.HTTP_409_CONFLICT)
        else:
            return Response({"error": "Seat already booked."}, status=status.HTTP_400_BAD_REQUEST)
    except Seat.DoesNotExist:
        return Response({"error": "Seat not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def book_seat_pessimistic(request):
    # Fixed implementation using pessimistic locking (select_for_update).

    seat_id = request.data.get('seat_id')
    user_name = request.data.get('user_name')
    
    try:
        with transaction.atomic():
            # select_for_update(nowait=True) will raise OperationalError if row is locked
            # This is better for a fast "already being processed" response
            seat = Seat.objects.select_for_update(nowait=True).get(id=seat_id)
            
            if seat.status == 'AVAILABLE':
                time.sleep(1)
                seat.status = 'BOOKED'
                seat.save()
                
                try:
                    Booking.objects.create(seat=seat, user_name=user_name)
                    return Response({"message": f"Seat {seat.seat_number} booked successfully (pessimistic)!"}, status=status.HTTP_201_CREATED)
                except IntegrityError:
                    return Response({"error": "Database integrity error."}, status=status.HTTP_409_CONFLICT)
            else:
                return Response({"error": "Seat already booked."}, status=status.HTTP_400_BAD_REQUEST)
    except OperationalError:
        return Response({"error": "Seat is currently being locked by another request. Try again."}, status=status.HTTP_409_CONFLICT)
    except Seat.DoesNotExist:
        return Response({"error": "Seat not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def lock_seat(request):
    seat_id = request.data.get('seat_id')
    user_name = request.data.get('user_name', 'Anonymous')
    
    try:
        with transaction.atomic():
            # Use select_for_update to prevent concurrent lock attempts
            seat = Seat.objects.select_for_update().get(id=seat_id)
            
            # Check if seat is available OR if it's already locked by the SAME user
            # OR if the lock is old (e.g., > 1 minute - for now let's just use 1 min)
            is_locked_by_me = seat.status == 'LOCKED' and seat.locked_by == user_name
            
            # Simple expiry logic: 10 seconds
            expiry_limit = timezone.now() - timezone.timedelta(seconds=10)
            is_expired = seat.status == 'LOCKED' and (seat.locked_at is None or seat.locked_at < expiry_limit)

            if seat.status == 'AVAILABLE' or is_locked_by_me or is_expired:
                seat.status = 'LOCKED'
                seat.locked_by = user_name
                seat.locked_at = timezone.now()
                seat.save()
                return Response({
                    "message": f"Seat {seat.seat_number} locked for 10 seconds.",
                    "seat": SeatSerializer(seat).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({"error": f"Seat is currently {seat.status.lower()}."}, status=status.HTTP_409_CONFLICT)
                
    except Seat.DoesNotExist:
        return Response({"error": "Seat not found."}, status=status.HTTP_404_NOT_FOUND)
    except OperationalError:
        return Response({"error": "Could not lock seat, try again."}, status=status.HTTP_409_CONFLICT)

@api_view(['POST'])
def unlock_seat(request):
    seat_id = request.data.get('seat_id')
    user_name = request.data.get('user_name') # Optional but good for security
    
    try:
        seat = Seat.objects.get(id=seat_id)
        if seat.status == 'LOCKED':
            seat.status = 'AVAILABLE'
            seat.locked_by = None
            seat.locked_at = None
            seat.save()
            return Response({"message": f"Seat {seat.seat_number} unlocked."}, status=status.HTTP_200_OK)
        return Response({"message": "Seat was not locked."}, status=status.HTTP_200_OK)
    except Seat.DoesNotExist:
        return Response({"error": "Seat not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def book_seat_optimistic(request):
    # Fixed implementation using optimistic locking (version field).
    # UPDATED: Now also checks if seat is LOCKED by the user.

    seat_id = request.data.get('seat_id')
    user_name = request.data.get('user_name', 'Anonymous')
    
    try:
        seat = Seat.objects.get(id=seat_id)
        
        # Allow booking if AVAILABLE or LOCKED by the same user
        if seat.status in ['AVAILABLE', 'LOCKED']:
            if seat.status == 'LOCKED' and seat.locked_by != user_name:
                return Response({"error": "Seat is locked by another user."}, status=status.HTTP_409_CONFLICT)

            # Store the version we read
            current_version = seat.version
            
            with transaction.atomic():
                # Update only if version hasn't changed
                updated = Seat.objects.filter(
                    id=seat_id, 
                    version=current_version
                ).filter(
                    models.Q(status='AVAILABLE') | models.Q(status='LOCKED', locked_by=user_name)
                ).update(
                    status='BOOKED', 
                    version=current_version + 1,
                    locked_by=None,
                    locked_at=None
                )
                
                if updated:
                    Booking.objects.create(seat=seat, user_name=user_name)
                    return Response({"message": f"Seat {seat.seat_number} booked successfully!"}, status=status.HTTP_201_CREATED)
                else:
                    return Response({"error": "Seat already booked or modified by another request."}, status=status.HTTP_409_CONFLICT)
        else:
            return Response({"error": "Seat already booked."}, status=status.HTTP_400_BAD_REQUEST)
    except IntegrityError:
        return Response({"error": "Database integrity error or seat already booked."}, status=status.HTTP_409_CONFLICT)
    except Seat.DoesNotExist:
        return Response({"error": "Seat not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def clear_shows(request):
    Show.objects.all().delete()
    return Response({"message": "All shows and bookings cleared."}, status=status.HTTP_200_OK)

@api_view(['GET'])
def api_root(request):
    return Response({
        "message": "Welcome to the Ticket Booking API",
        "endpoints": {
            "shows": "/api/shows/",
            "bookings": "/api/bookings/",
            "book_naive": "/api/book/naive/",
            "book_pessimistic": "/api/book/pessimistic/",
            "book_optimistic": "/api/book/optimistic/",
            "lock": "/api/lock/",
            "unlock": "/api/unlock/"
        }
    })

@api_view(['GET', 'POST'])
def create_show(request):
    if request.method == 'GET':
        shows = Show.objects.all()
        serializer = ShowSerializer(shows, many=True)
        return Response(serializer.data)
    
    title = request.data.get('title')
    num_seats = request.data.get('num_seats', 10)
    start_time = timezone.now()
    
    show = Show.objects.create(title=title, start_time=start_time)
    
    seats = []
    for i in range(1, num_seats + 1):
        seats.append(Seat(show=show, seat_number=f"S{i:02d}"))
    
    Seat.objects.bulk_create(seats)
    
    return Response(ShowSerializer(show).data, status=status.HTTP_201_CREATED)
