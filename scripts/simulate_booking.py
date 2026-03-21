import requests
import threading

API_URL = "http://127.0.0.1:8000/api"

def create_show(title, num_seats):
    response = requests.post(f"{API_URL}/shows/", json={"title": title, "num_seats": num_seats})
    if response.status_code == 201:
        print(f"Show '{title}' created with {num_seats} seats.")
        return response.json()['id']
    else:
        print(f"Failed to create show: {response.text}")
        return None

def get_seats(show_id):
    response = requests.get(f"{API_URL}/shows/{show_id}/seats/")
    return response.json()

def book_seat(endpoint, seat_id, user_name):
    try:
        response = requests.post(f"{API_URL}/book/{endpoint}/", json={"seat_id": seat_id, "user_name": user_name})
        print(f"User {user_name}: Status {response.status_code} - {response.json().get('message', response.json().get('error'))}")
    except Exception as e:
        print(f"User {user_name}: Error - {e}")

def simulate_concurrency(endpoint, seat_id, num_users=5):
    threads = []
    print(f"\n--- Simulating concurrency on endpoint: {endpoint} for seat ID: {seat_id} ---")
    for i in range(num_users):
        user_name = f"User_{i+1}"
        t = threading.Thread(target=book_seat, args=(endpoint, seat_id, user_name))
        threads.append(t)
    
    for t in threads:
        t.start()
    
    for t in threads:
        t.join()

def check_bookings(seat_id):
    response = requests.get(f"{API_URL}/bookings/")
    bookings = response.json()
    seat_bookings = [b for b in bookings if b['seat'] == seat_id]
    print(f"Total bookings for seat {seat_id}: {len(seat_bookings)}")
    for b in seat_bookings:
        print(f"  - Booked by: {b['user_name']} at {b['booked_at']}")

if __name__ == "__main__":
    # Create a show and get a seat
    show_id = create_show("Concurrency Demo Movie", 5)
    if show_id:
        seats = get_seats(show_id)
        
        # Test 1: Naive (Should show race condition)
        # Note: We need different seats for each test or a reset mechanism.
        # Let's use different seats for each demo.
        
        # S01: Naive
        seat1_id = seats[0]['id']
        print(f"\nTesting NAIVE implementation on seat {seats[0]['seat_number']}...")
        simulate_concurrency("naive", seat1_id, num_users=5)
        check_bookings(seat1_id)
        
        # S02: Pessimistic
        seat2_id = seats[1]['id']
        print(f"\nTesting PESSIMISTIC implementation on seat {seats[1]['seat_number']}...")
        simulate_concurrency("pessimistic", seat2_id, num_users=5)
        check_bookings(seat2_id)
        
        # S03: Optimistic
        seat3_id = seats[2]['id']
        print(f"\nTesting OPTIMISTIC implementation on seat {seats[2]['seat_number']}...")
        simulate_concurrency("optimistic", seat3_id, num_users=5)
        check_bookings(seat3_id)
