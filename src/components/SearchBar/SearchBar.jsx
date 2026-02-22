import { useState, useRef, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './SearchBar.css'

const SearchBar = ({ activeView, onViewChange, onHotelSearch, onGroupBooking, onDatesChange }) => {
  const [startDate, setStartDate] = useState(new Date(2027, 8, 7))
  const [endDate, setEndDate] = useState(new Date(2027, 8, 10))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showPaxPicker, setShowPaxPicker] = useState(false)
  const [hotelSearch, setHotelSearch] = useState('')

  // PAX state: array of rooms, each with { adults, children, childAges }
  const [rooms, setRooms] = useState([{ adults: 1, children: 0, childAges: [] }])

  const dateRef = useRef(null)
  const paxRef = useRef(null)

  // Close datepicker on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dateRef.current && !dateRef.current.contains(e.target)) {
        setShowDatePicker(false)
      }
      if (paxRef.current && !paxRef.current.contains(e.target)) {
        setShowPaxPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateChange = (dates) => {
    const [start, end] = dates
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setShowDatePicker(false)
      if (onDatesChange) onDatesChange(start, end)
    }
  }

  const formatDate = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // PAX helpers
  const totalGuests = rooms.reduce((sum, r) => sum + r.adults + r.children, 0)

  const updateRoom = (index, field, delta) => {
    setRooms(prev => prev.map((room, i) => {
      if (i !== index) return room
      const newVal = room[field] + delta
      const total = field === 'adults' ? newVal + room.children : room.adults + newVal
      if (newVal < 0 || total > 4 || total < 1) return room
      if (field === 'adults' && newVal < 1) return room
      const updated = { ...room, [field]: newVal }
      if (field === 'children') {
        const ages = [...(room.childAges || [])]
        while (ages.length < newVal) ages.push(5)
        updated.childAges = ages.slice(0, newVal)
      }
      return updated
    }))
  }

  const updateChildAge = (roomIndex, childIndex, age) => {
    setRooms(prev => prev.map((room, i) => {
      if (i !== roomIndex) return room
      const newAges = [...(room.childAges || [])]
      newAges[childIndex] = age
      return { ...room, childAges: newAges }
    }))
  }

  const addRoom = () => {
    if (rooms.length < 10) {
      setRooms(prev => [...prev, { adults: 1, children: 0, childAges: [] }])
    }
  }

  const removeRoom = (index) => {
    if (rooms.length > 1) {
      setRooms(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleSearchInput = (e) => {
    setHotelSearch(e.target.value)
    if (onHotelSearch) {
      onHotelSearch(e.target.value)
    }
  }

  return (
    <div className="search-bar-wrapper">
      <div className="search-bar">
        <div className="search-bar-inner">
          {/* Hotel search */}
          <div className="hotel-search-box">
            <svg className="hotel-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#999" strokeWidth="1.4"/>
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#999" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="hotel-search-input"
              placeholder="Hotel search"
              value={hotelSearch}
              onChange={handleSearchInput}
            />
          </div>

          {/* Dates */}
          <div className="search-dates" ref={dateRef}>
            <svg className="calendar-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#666" strokeWidth="1.2"/>
              <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="#666" strokeWidth="1.2"/>
              <line x1="4.5" y1="1" x2="4.5" y2="3" stroke="#666" strokeWidth="1.2"/>
              <line x1="9.5" y1="1" x2="9.5" y2="3" stroke="#666" strokeWidth="1.2"/>
            </svg>
            <span
              className="dates-text dates-clickable"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              {formatDate(startDate)} — {formatDate(endDate)}
            </span>
            {showDatePicker && (
              <div className="datepicker-popup">
                <DatePicker
                  selected={startDate}
                  onChange={handleDateChange}
                  startDate={startDate}
                  endDate={endDate}
                  selectsRange
                  inline
                  monthsShown={1}
                  minDate={new Date()}
                />
              </div>
            )}
          </div>

          {/* Guests / PAX selector */}
          <div className="search-guests" ref={paxRef}>
            <svg className="guests-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="4.5" r="2.5" stroke="#666" strokeWidth="1.2"/>
              <path d="M2 12.5c0-2.5 2.24-4.5 5-4.5s5 2 5 4.5" stroke="#666" strokeWidth="1.2" fill="none"/>
            </svg>
            <span
              className="guests-text guests-clickable"
              onClick={() => setShowPaxPicker(!showPaxPicker)}
            >
              {totalGuests} Guest{totalGuests !== 1 ? 's' : ''}, {rooms.length} Room{rooms.length !== 1 ? 's' : ''}
            </span>

            {showPaxPicker && (
              <div className="pax-popup">
                <div className="pax-group-banner">
                  <span className="pax-group-text">Looking for 10 rooms or more?</span>
                  <button className="pax-group-btn" onClick={() => { setShowPaxPicker(false); if (onGroupBooking) onGroupBooking() }}>Group booking</button>
                </div>
                <div className="pax-rooms">
                  {rooms.map((room, index) => (
                    <div key={index} className="pax-room">
                      <div className="pax-room-header">
                        <span className="pax-room-title">Room {index + 1}</span>
                        {rooms.length > 1 && (
                          <button className="pax-room-remove" onClick={() => removeRoom(index)}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <line x1="2" y1="2" x2="10" y2="10" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
                              <line x1="10" y1="2" x2="2" y2="10" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="pax-row">
                        <span className="pax-label">Adults</span>
                        <div className="pax-controls">
                          <button
                            className="pax-btn"
                            onClick={() => updateRoom(index, 'adults', -1)}
                            disabled={room.adults <= 1}
                          >−</button>
                          <span className="pax-value">{room.adults}</span>
                          <button
                            className="pax-btn"
                            onClick={() => updateRoom(index, 'adults', 1)}
                            disabled={room.adults + room.children >= 4}
                          >+</button>
                        </div>
                      </div>
                      <div className="pax-row">
                        <span className="pax-label">Children</span>
                        <div className="pax-controls">
                          <button
                            className="pax-btn"
                            onClick={() => updateRoom(index, 'children', -1)}
                            disabled={room.children <= 0}
                          >−</button>
                          <span className="pax-value">{room.children}</span>
                          <button
                            className="pax-btn"
                            onClick={() => updateRoom(index, 'children', 1)}
                            disabled={room.adults + room.children >= 4}
                          >+</button>
                        </div>
                      </div>
                      {room.children > 0 && (
                        <div className="pax-child-ages">
                          {(room.childAges || []).map((age, ci) => (
                            <div key={ci} className="pax-child-age-row">
                              <span className="pax-child-age-label">Child {ci + 1} age</span>
                              <select
                                className="pax-child-age-select"
                                value={age}
                                onChange={(e) => updateChildAge(index, ci, Number(e.target.value))}
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((a) => (
                                  <option key={a} value={a}>{a} yr{a > 1 ? 's' : ''}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {rooms.length < 10 && (
                  <button className="pax-add-room" onClick={addRoom}>
                    + Add room
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search button */}
          <button className="search-button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.8"/>
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="search-button-text">Search</span>
          </button>
        </div>
      </div>

      {/* View toggle — separate element, 20px to the right */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${activeView === 'both' ? 'view-toggle-active' : ''}`}
          onClick={() => onViewChange('both')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <rect x="9" y="1" width="6" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
          </svg>
          Compact
        </button>
        <button
          className={`view-toggle-btn ${activeView === 'list' ? 'view-toggle-active' : ''}`}
          onClick={() => onViewChange('list')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          List
        </button>
        <button
          className={`view-toggle-btn ${activeView === 'map' ? 'view-toggle-active' : ''}`}
          onClick={() => onViewChange('map')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M1 3.5l4.5-2 5 2.5 4.5-2v11l-4.5 2-5-2.5-4.5 2V3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
            <path d="M5.5 1.5v11M10.5 4v11" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Map only
        </button>
      </div>
    </div>
  )
}

export default SearchBar
