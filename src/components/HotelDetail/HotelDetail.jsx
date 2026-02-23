import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getHotelDetail } from '../../data/hotelDetails'
import { getBookedToday, getRoomsLeft } from '../../utils/urgency'
import CompareTray from '../CompareTray/CompareTray'
import './HotelDetail.css'

const EVENT_VENUE = {
  name: 'ExCeL London',
  position: [51.5085, 0.0295],
}

const createHotelPin = (price) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin"><span>\u00A3${price}</span></div>`,
    iconSize: [60, 32],
    iconAnchor: [30, 32],
    popupAnchor: [0, -32],
  })

const venueIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="venue-pin"><svg width="28" height="36" viewBox="0 0 24 32" fill="none"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#1a1a1a"/><circle cx="12" cy="12" r="5" fill="white"/></svg></div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
})

// Board surcharges per night
const BOARD_SURCHARGES = {
  'Room Only': 0,
  'Bed & Breakfast': 8,
  'Half Board': 18,
  'Full Board': 30,
}

const StarRating = ({ count }) => (
  <div className="detail-stars">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="16" height="16" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 0.5L7.76 3.95L11.5 4.54L8.75 7.29L9.41 11.06L6 9.24L2.59 11.06L3.25 7.29L0.5 4.54L4.24 3.95L6 0.5Z"
          fill={i < count ? '#F5C518' : '#555'}
        />
      </svg>
    ))}
  </div>
)

/* Skeleton placeholder shown during initial load */
const DetailSkeleton = ({ onBack }) => (
  <div className="hotel-detail-page">
    <div className="detail-topbar">
      <button className="detail-back-btn" onClick={onBack} title="Back">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div className="detail-topbar-logos" />
    </div>
    <div className="detail-hero">
      <div className="detail-hero-main"><div className="skeleton-block skeleton-hero" /></div>
      <div className="detail-hero-grid">
        {[0,1,2,3].map((i) => <div key={i} className="detail-hero-thumb"><div className="skeleton-block skeleton-thumb" /></div>)}
      </div>
    </div>
    <div className="detail-content">
      <div className="detail-header" style={{ borderBottom: 'none' }}>
        <div style={{ flex: 1 }}>
          <div className="skeleton-block skeleton-text-lg" />
          <div className="skeleton-block skeleton-text-sm" style={{ marginTop: 10 }} />
          <div className="skeleton-block skeleton-text-sm" style={{ marginTop: 8, width: '60%' }} />
        </div>
        <div className="skeleton-block skeleton-price-box" />
      </div>
      <div className="detail-section">
        <div className="skeleton-block skeleton-text-md" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[0,1,2,3,4].map((i) => <div key={i} className="skeleton-block skeleton-tag" />)}
        </div>
      </div>
      <div className="detail-section">
        <div className="skeleton-block skeleton-text-md" />
        <div className="detail-rooms" style={{ marginTop: 12 }}>
          {[0,1].map((i) => (
            <div key={i} className="skeleton-block skeleton-room-card" />
          ))}
        </div>
      </div>
    </div>
  </div>
)

const AI_COLLAPSED_PHRASES = [
  "OK, I'm here if you need me.",
  "I'm here to help you.",
  "Need a hand?",
  "Unsure where to begin?",
]

const HotelDetail = ({ hotel, onBack, addToCompare, isInCompare, compareHotels = [], removeFromCompare, onOpenCompare, onGroupBooking }) => {
  const [detail, setDetail] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [roomOptions, setRoomOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [showGroupPrompt, setShowGroupPrompt] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [collapsedPhrase, setCollapsedPhrase] = useState(AI_COLLAPSED_PHRASES[0])

  useEffect(() => {
    setLoading(true)
    // Simulate brief loading delay for skeleton visibility
    const timer = setTimeout(() => {
      const d = getHotelDetail(hotel)
      setDetail(d)
      // Initialize room options with defaults
      const opts = {}
      d.rooms.forEach((room, idx) => {
        opts[idx] = {
          board: room.boardOptions[0],
          cancellation: room.cancellationOptions ? room.cancellationOptions[0].value : 'free',
          quantity: 1,
        }
      })
      setRoomOptions(opts)
      setLoading(false)
      window.scrollTo(0, 0)
    }, 350)
    return () => clearTimeout(timer)
  }, [hotel])

  const updateRoomOption = (idx, key, value) => {
    setRoomOptions(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [key]: value }
    }))
  }

  const getRoomPrice = (room, idx) => {
    const opts = roomOptions[idx]
    if (!opts) return room.price
    const boardSurcharge = BOARD_SURCHARGES[opts.board] || 0
    return room.price + boardSurcharge
  }

  const getRoomQty = (idx) => {
    return roomOptions[idx]?.quantity || 1
  }

  const getTotalQty = () => {
    return Object.values(roomOptions).reduce((sum, o) => sum + (o.quantity || 1), 0)
  }

  if (loading || !detail) return <DetailSkeleton onBack={onBack} />

  const gallery = detail.gallery
  const midLat = (hotel.position[0] + EVENT_VENUE.position[0]) / 2
  const midLon = (hotel.position[1] + EVENT_VENUE.position[1]) / 2

  return (
    <div className="hotel-detail-page">
      {/* Top bar */}
      <div className="detail-topbar">
        <div className="detail-topbar-left">
          <button className="detail-back-btn" onClick={onBack} title="Back">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="detail-title">Hotel details</h1>
        </div>
        {/* Collapsed AI pill in topbar */}
        {aiCollapsed && !showGroupPrompt && (
          <div className="detail-ai-collapsed-pill" onClick={() => { setAiCollapsed(false); setShowGroupPrompt(true) }}>
            <span className="detail-ai-collapsed-emoji">😊</span>
            <span className="detail-ai-collapsed-text">{collapsedPhrase}</span>
          </div>
        )}
        <div className="detail-topbar-logos" />
      </div>

      {/* Hero banner — 1 big left, 4 small right */}
      <div className="detail-hero">
        <div className="detail-hero-main">
          <img src={gallery[0]} alt={detail.name} />
        </div>
        <div className="detail-hero-grid">
          {gallery.slice(1, 5).map((img, i) => (
            <div key={i} className="detail-hero-thumb">
              <img src={img} alt={`${detail.name} ${i + 2}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Hotel info */}
      <div className="detail-content">
        <div className="detail-header">
          <div className="detail-header-left">
            <div className="detail-name-row">
              <h1 className="detail-name">{detail.name}</h1>
              {addToCompare && (
                <button
                  className={`detail-compare-btn ${isInCompare && isInCompare(hotel.id) ? 'detail-compare-btn-active' : ''}`}
                  onClick={() => addToCompare(hotel)}
                >
                  {isInCompare && isInCompare(hotel.id) ? '✓ In compare' : '+ Add to compare'}
                </button>
              )}
            </div>
            <div className="detail-rating-row">
              <StarRating count={detail.stars} />
              <span className="detail-rating-score">{detail.rating}</span>
              <span className="detail-reviews">({detail.reviews.toLocaleString()} reviews)</span>
            </div>
            <p className="detail-address">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" stroke="#999" strokeWidth="1.2" fill="none"/><circle cx="8" cy="6" r="1.5" fill="#999"/></svg>
              {detail.address}
            </p>
          </div>
          <div className="detail-header-right">
            <div className="detail-price-box">
              <span className="detail-price-label">From</span>
              <span className="detail-price-amount">£{detail.price}</span>
              <span className="detail-price-per">/night</span>
            </div>
            <div className="detail-booked-today">
              <span className="detail-booked-icon">🔥</span>
              Booked {getBookedToday(hotel.id, detail.stars)} times today
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="detail-section">
          <h2 className="detail-section-title">Hotel Amenities</h2>
          <div className="detail-amenities">
            {detail.amenities.map((a) => (
              <span key={a} className="detail-amenity-tag">{a}</span>
            ))}
          </div>
        </div>

        {/* Room types */}
        <div className="detail-section">
          <h2 className="detail-section-title">Available Rooms</h2>
          <div className="detail-rooms">
            {detail.rooms.map((room, idx) => {
              const opts = roomOptions[idx] || {}
              const displayPrice = getRoomPrice(room, idx)
              const selectedCancel = room.cancellationOptions?.find(c => c.value === opts.cancellation)
              const roomsLeft = getRoomsLeft(hotel.id, idx)

              return (
                <div
                  key={idx}
                  className={`detail-room-card ${selectedRoom === idx ? 'detail-room-card-selected' : ''}`}
                  onClick={() => setSelectedRoom(idx)}
                >
                  <div className="detail-room-img-wrap">
                    <img src={room.image} alt={room.type} className="detail-room-img" loading="lazy" />
                    {roomsLeft && (
                      <span className="detail-room-scarcity">Only {roomsLeft} left at this price</span>
                    )}
                  </div>
                  <div className="detail-room-body">
                    <div className="detail-room-header">
                      <h3 className="detail-room-type">{room.type}</h3>
                      <div className="detail-room-price">
                        <span className="detail-room-price-amount">£{displayPrice}</span>
                        <span className="detail-room-price-per">/night</span>
                      </div>
                    </div>
                    <p className="detail-room-desc">{room.description}</p>

                    <div className="detail-room-tags">
                      {room.amenities.map((a) => (
                        <span key={a} className="detail-room-tag">{a}</span>
                      ))}
                    </div>

                    <div className="detail-room-meta">
                      {/* Sleeps — with bed icon (moved above board) */}
                      <div className="detail-room-meta-item">
                        <span className="detail-room-meta-label">Sleeps</span>
                        <span className="detail-room-guests">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M2 13V8h12v5" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M1 13h14" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round"/>
                            <path d="M4 8V6.5A1.5 1.5 0 015.5 5h5A1.5 1.5 0 0112 6.5V8" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="5.5" cy="6.5" r="1" fill="#bbb"/>
                          </svg>
                          {room.maxGuests} guests
                        </span>
                      </div>

                      {/* Board options — interactive */}
                      <div className="detail-room-meta-item">
                        <span className="detail-room-meta-label">Board</span>
                        <div className="detail-room-board-options">
                          {room.boardOptions.map((b) => (
                            <button
                              key={b}
                              className={`detail-room-board-btn ${opts.board === b ? 'detail-room-board-btn-active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); updateRoomOption(idx, 'board', b) }}
                            >
                              {b}
                              {BOARD_SURCHARGES[b] > 0 && (
                                <span className="board-surcharge">+£{BOARD_SURCHARGES[b]}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cancellation — interactive */}
                      <div className="detail-room-meta-item">
                        <span className="detail-room-meta-label">Cancellation</span>
                        <div className="detail-room-cancel-options">
                          {(room.cancellationOptions || []).map((c) => (
                            <button
                              key={c.value}
                              className={`detail-room-cancel-btn ${opts.cancellation === c.value ? `detail-room-cancel-btn-active cancel-${c.value}` : ''}`}
                              onClick={(e) => { e.stopPropagation(); updateRoomOption(idx, 'cancellation', c.value) }}
                              title={c.detail}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        {selectedCancel && (
                          <span className="detail-room-cancel-detail">{selectedCancel.detail}</span>
                        )}
                      </div>
                    </div>

                    <div className="detail-room-qty-row">
                      <span className="detail-room-qty-label">Qty</span>
                      <div className="detail-room-qty-stepper">
                        <button className="detail-room-qty-btn" onClick={(e) => { e.stopPropagation(); const q = getRoomQty(idx); if (q > 1) updateRoomOption(idx, 'quantity', q - 1) }}>−</button>
                        <span className="detail-room-qty-val">{getRoomQty(idx)}</span>
                        <button className="detail-room-qty-btn" onClick={(e) => { e.stopPropagation(); const q = getRoomQty(idx); if (getTotalQty() < 10) { updateRoomOption(idx, 'quantity', q + 1) } else if (!aiCollapsed) { setShowGroupPrompt(true) } }}>+</button>
                      </div>
                      <span className="detail-room-qty-total">
                        {getRoomQty(idx) > 1 ? `${getRoomQty(idx)} rooms` : '1 room'}
                      </span>
                    </div>

                    <button className="detail-room-book-btn">
                      Select {getRoomQty(idx) > 1 ? `${getRoomQty(idx)} Rooms` : 'Room'} — £{displayPrice * getRoomQty(idx)}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Map */}
        <div className="detail-section">
          <h2 className="detail-section-title">Location</h2>
          <div className="detail-map-wrapper">
            <MapContainer
              center={[midLat, midLon]}
              zoom={14}
              className="detail-map"
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Marker position={hotel.position} icon={createHotelPin(hotel.price)}>
                <Popup>{hotel.name}</Popup>
              </Marker>
              <Marker position={EVENT_VENUE.position} icon={venueIcon}>
                <Popup>{EVENT_VENUE.name}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Compare tray — fixed position on detail page, only when hotels added */}
      {compareHotels.length > 0 && (
        <div className="detail-compare-tray-wrapper">
          <CompareTray
            compareHotels={compareHotels}
            onRemove={removeFromCompare}
            onCompare={onOpenCompare}
          />
        </div>
      )}

      {/* Group booking AI prompt overlay */}
      {showGroupPrompt && (
        <div className="detail-ai-overlay" onClick={() => { setShowGroupPrompt(false); setAiCollapsed(true); setCollapsedPhrase(AI_COLLAPSED_PHRASES[Math.floor(Math.random() * AI_COLLAPSED_PHRASES.length)]) }}>
          <div className="detail-ai-center" onClick={(e) => e.stopPropagation()}>
            <div className="detail-ai-inner">
              <div className="detail-ai-avatar">
                <span className="detail-ai-emoji">😊</span>
              </div>
              <div className="detail-ai-content">
                <div className="detail-ai-bubble">
                  <p className="detail-ai-message">Hey there! I notice you're looking to book multiple rooms. Would you like to switch to <strong>Group Booking</strong> for better rates?</p>
                </div>
                <div className="detail-ai-options">
                  <button className="detail-ai-option" onClick={() => { setShowGroupPrompt(false); if (onGroupBooking) onGroupBooking(hotel) }}>Yes</button>
                  <button className="detail-ai-option" onClick={() => { setShowGroupPrompt(false); setAiCollapsed(true); setCollapsedPhrase(AI_COLLAPSED_PHRASES[Math.floor(Math.random() * AI_COLLAPSED_PHRASES.length)]) }}>No</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HotelDetail
