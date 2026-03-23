from django.db import models

class Show(models.Model):
    title = models.CharField(max_length=200)
    start_time = models.DateTimeField()

    def __str__(self):
        return self.title

class Seat(models.Model):
    STATUS_CHOICES = [
        ('AVAILABLE', 'Available'),
        ('LOCKED', 'Locked'),
        ('BOOKED', 'Booked'),
    ]
    show = models.ForeignKey(Show, related_name='seats', on_delete=models.CASCADE)
    seat_number = models.CharField(max_length=10)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='AVAILABLE')
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.CharField(max_length=100, null=True, blank=True)
    version = models.IntegerField(default=0)  # For optimistic locking

    class Meta:
        unique_together = ('show', 'seat_number')

    def __str__(self):
        return f"{self.show.title} - {self.seat_number}"

class Booking(models.Model):
    seat = models.OneToOneField(Seat, on_delete=models.CASCADE)
    user_name = models.CharField(max_length=100)
    booked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking for {self.seat.seat_number} by {self.user_name}"
