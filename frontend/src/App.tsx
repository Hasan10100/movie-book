import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://127.0.0.1:8000/';

interface Seat {
  id: number;
  seat_number: string;
  status: 'AVAILABLE' | 'BOOKED';
  show: number;
  version: number;
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

  const handleBook = async (seatId: number, endpoint: string) => {
    if (!userName.trim()) {
      setMessage({ text: 'Please enter your name before booking!', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API_BASE}/book/${endpoint}/`, {
        seat_id: seatId,
        user_name: userName
      });
      setMessage({ text: res.data.message, type: 'success' });
      if (selectedShow) fetchSeats(selectedShow);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Booking failed';
      setMessage({ text: errorMsg, type: 'error' });
      if (selectedShow) fetchSeats(selectedShow);
    }
    setLoading(false);
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
            {seats.map(seat => (
              <div 
                key={seat.id} 
                className={`seat ${seat.status.toLowerCase()}`}
              >
                <div className="seat-label">{seat.seat_number}</div>
                {seat.status === 'AVAILABLE' && (
                  <div className="seat-actions">
                    <button onClick={() => handleBook(seat.id, 'naive')}>Naive</button>
                    <button onClick={() => handleBook(seat.id, 'pessimistic')}>Pessimist</button>
                    <button onClick={() => handleBook(seat.id, 'optimistic')}>Optimist</button>
                  </div>
                )}
                {seat.status === 'BOOKED' && <div className="booked-text">Booked</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
