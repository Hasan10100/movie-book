import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://127.0.0.1:8000/';

interface Seat {
  id: number;
  seat_number: string;
  status: 'AVAILABLE' | 'BOOKED' | 'LOCKED';
  show: number;
  version: number;
  locked_by: string | null;
  locked_at: string | null;
}

const App: React.FC = () => {
  const [shows, setShows] = useState<any[]>([]);
  const [selectedShow, setSelectedShow] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('selectedShowId');
    return saved ? parseInt(saved) : null;
  });
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [userName, setUserName] = useState(() => {
    return sessionStorage.getItem('userName') || '';
  });
  const [confirmingSeat, setConfirmingSeat] = useState<Seat | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (confirmingSeat && confirmingSeat.locked_at) {
      const lockTime = new Date(confirmingSeat.locked_at).getTime();
      if (now - lockTime > 10000) {
        setConfirmingSeat(null);
        setMessage({ text: 'Your lock has expired. Please try again.', type: 'error' });
      }
    }
  }, [now, confirmingSeat]);

  const fetchShows = async () => {
    try {
      const res = await axios.get(`${API_BASE}/shows/`);
      setShows(res.data);
    } catch (err) {
      console.error("Failed to fetch shows", err);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  useEffect(() => {
    let interval: any;
    if (selectedShow) {
      fetchSeats(selectedShow);
      sessionStorage.setItem('selectedShowId', selectedShow.toString());
      
      // Start polling every 3 seconds
      interval = setInterval(() => {
        fetchSeats(selectedShow);
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedShow]);

  const fetchSeats = async (showId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/shows/${showId}/seats/`);
      setSeats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const createShow = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/shows/`, { 
        title: 'Movie ' + new Date().toLocaleTimeString(), 
        num_seats: 5 
      });
      setSelectedShow(res.data.id);
      fetchShows();
      setMessage({ text: 'Show created!', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Failed to create show', type: 'error' });
    }
    setLoading(false);
  };

  const clearShows = async () => {
    if (!window.confirm("Are you sure you want to delete all shows and bookings?")) return;
    
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/clear-shows/`);
      setShows([]);
      setSelectedShow(null);
      setSeats([]);
      sessionStorage.removeItem('selectedShowId');
      setMessage({ text: 'All shows cleared!', type: 'info' });
    } catch (err) {
      setMessage({ text: 'Failed to clear shows', type: 'error' });
    }
    setLoading(false);
  };

  const handleSeatClick = async (seat: Seat) => {
    if (seat.status === 'BOOKED') return;
    
    // Instead of blocking locked seats in the UI, let the API handle the lock logic
    // (This allows taking over expired locks)
    
    if (!userName.trim()) {
      setMessage({ text: 'Please enter your name first!', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/lock/`, {
        seat_id: seat.id,
        user_name: userName
      });
      setConfirmingSeat(res.data.seat); // Use updated seat data from server
      if (selectedShow) fetchSeats(selectedShow);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Could not lock seat';
      setMessage({ text: errorMsg, type: 'error' });
    }
    setLoading(false);
  };

  const handleConfirmBooking = async () => {
    if (!confirmingSeat) return;
    
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/book/optimistic/`, {
        seat_id: confirmingSeat.id,
        user_name: userName
      });
      setMessage({ text: res.data.message, type: 'success' });
      setConfirmingSeat(null);
      if (selectedShow) fetchSeats(selectedShow);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Booking failed';
      setMessage({ text: errorMsg, type: 'error' });
      setConfirmingSeat(null);
      if (selectedShow) fetchSeats(selectedShow);
    }
    setLoading(false);
  };

  const handleCancelBooking = async () => {
    if (!confirmingSeat) return;
    
    try {
      await axios.post(`${API_BASE}/unlock/`, {
        seat_id: confirmingSeat.id,
        user_name: userName
      });
      setConfirmingSeat(null);
      if (selectedShow) fetchSeats(selectedShow);
    } catch (err) {
      console.error("Failed to unlock", err);
      setConfirmingSeat(null);
    }
  };

  return (
    <div className="container">
      <h1>🎬 Ticket Booking System</h1>
      <div className="controls">
        <select 
          value={selectedShow || ''} 
          onChange={(e) => setSelectedShow(parseInt(e.target.value))}
          className="show-selector"
        >
          <option value="" disabled>-- Select a Movie --</option>
          {shows.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <button onClick={createShow} disabled={loading} className="btn-create">Create New Show</button>
        <button onClick={clearShows} disabled={loading} className="btn-clear">Clear All</button>
        <input 
          type="text" 
          value={userName} 
          onChange={(e) => {
            const val = e.target.value;
            setUserName(val);
            sessionStorage.setItem('userName', val);
          }} 
          placeholder="User Name" 
        />
      </div>

      {message && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}

      {selectedShow && (
        <div className="booking-area">
          <h2>Select a Seat</h2>
          <div className="seat-grid">
            {seats.map(seat => {
              // Client-side expiry check
              let displayStatus = seat.status;
              let isExpired = false;
              
              if (seat.status === 'LOCKED' && seat.locked_at) {
                const lockTime = new Date(seat.locked_at).getTime();
                // Check if it's older than 10 seconds
                if (now - lockTime > 10000) {
                  displayStatus = 'AVAILABLE';
                  isExpired = true;
                }
              }

              return (
                <div 
                  key={seat.id} 
                  className={`seat ${displayStatus.toLowerCase()} ${(!isExpired && seat.locked_by === userName) ? 'my-lock' : ''}`}
                  onClick={() => handleSeatClick(seat)}
                >
                  <div className="seat-label">{seat.seat_number}</div>
                  {displayStatus === 'AVAILABLE' && <div className="status-text">Available</div>}
                  {displayStatus === 'LOCKED' && <div className="status-text">Locked {seat.locked_by === userName ? '(You)' : ''}</div>}
                  {displayStatus === 'BOOKED' && <div className="status-text">Booked</div>}
                </div>
              );
            })}
          </div>

          {confirmingSeat && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Confirm Booking</h3>
                <p>Are you sure you want to book seat <strong>{confirmingSeat.seat_number}</strong>?</p>
                <p className="modal-timer">This seat is locked for you for 10 seconds.</p>
                <div className="modal-actions">
                  <button onClick={handleConfirmBooking} className="btn-confirm" disabled={loading}>
                    {loading ? 'Booking...' : 'Yes, Book it!'}
                  </button>
                  <button onClick={handleCancelBooking} className="btn-cancel" disabled={loading}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
