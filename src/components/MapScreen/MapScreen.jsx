import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import SearchBar from '../SearchBar/SearchBar'
import HotelCard from '../HotelCard/HotelCard'
import HotelList from '../HotelList/HotelList'
import AiChat from '../AiChat/AiChat'
import CompareTray from '../CompareTray/CompareTray'
import { hotels } from '../../data/hotels'
import { isHighDemand } from '../../utils/urgency'
import './MapScreen.css'

// Custom yellow marker icon
const createMarkerIcon = (price, isActive, isHidden) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin ${isActive ? 'marker-pin-active' : ''} ${isHidden ? 'marker-pin-hidden' : ''}">
      <span>£${price}</span>
    </div>`,
    iconSize: [60, 32],
    iconAnchor: [30, 32],
    popupAnchor: [0, -32],
  })
}

// Event venue marker — simple black pin
const eventVenueIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="venue-pin">
    <svg width="28" height="36" viewBox="0 0 24 32" fill="none">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#1a1a1a"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>
  </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
})

// ExCeL London coordinates
const EVENT_VENUE = {
  name: 'ExCeL London',
  position: [51.5085, 0.0295],
  description: 'DSEI UK 2027 Venue',
  image: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=200&fit=crop',
  eventName: 'DSEI 2027',
  eventInfo: 'The world\'s leading defence & security event, bringing together the global defence community to innovate and share knowledge.',
}

// Haversine distance in km
const getDistanceKm = (pos1, pos2) => {
  const R = 6371
  const dLat = ((pos2[0] - pos1[0]) * Math.PI) / 180
  const dLon = ((pos2[1] - pos1[1]) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pos1[0] * Math.PI) / 180) *
      Math.cos((pos2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Estimate walking time in minutes (avg 5 km/h)
const getWalkMins = (distKm) => Math.round((distKm / 5) * 60)

// Estimate driving time in minutes (avg 30 km/h city)
const getDriveMins = (distKm) => Math.max(1, Math.round((distKm / 30) * 60))

// Format distance: meters if < 1 km, otherwise km
const formatDistance = (distKm) => {
  if (distKm < 1) return `${Math.round(distKm * 1000)} m`
  return `${distKm.toFixed(1)} km`
}

// Format travel time: walking if < 30 min, driving otherwise
const formatTravelTime = (distKm) => {
  const walkMins = getWalkMins(distKm)
  if (walkMins < 30) return { text: `${walkMins} min walk`, icon: 'walk' }
  const driveMins = getDriveMins(distKm)
  return { text: `${driveMins} min drive`, icon: 'drive' }
}


// Star rating HTML for popup
const starsHtml = (count) => {
  return [...Array(5)].map((_, i) =>
    `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 0.5L7.76 3.95L11.5 4.54L8.75 7.29L9.41 11.06L6 9.24L2.59 11.06L3.25 7.29L0.5 4.54L4.24 3.95L6 0.5Z" fill="${i < count ? '#F5C518' : '#555'}"/></svg>`
  ).join('')
}

// Component to fly to a position on the map
const FlyToPosition = ({ position, zoom }) => {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom || 14, { duration: 0.8 })
    }
  }, [position, zoom, map])
  return null
}

const MapScreen = ({ onHotelDetailOpen, onOpenCompare, onOpenCompareWithHotels, compareHotels, addToCompare, removeFromCompare, isInCompare, onDatesChange }) => {
  const [activeHotel, setActiveHotel] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const [activeView, setActiveView] = useState('both')
  const [hotelSearchQuery, setHotelSearchQuery] = useState('')
  const [showGroupLoading, setShowGroupLoading] = useState(false)
  const [groupTrigger, setGroupTrigger] = useState(0)
  const [blinkCompareButtons, setBlinkCompareButtons] = useState(false)
  const cardsContainerRef = useRef(null)

  // Lifted filter state — shared between map view & list view
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [minStars, setMinStars] = useState(0)
  const [cancellation, setCancellation] = useState('all')

  const filterState = { priceMin, setPriceMin, priceMax, setPriceMax, minStars, setMinStars, cancellation, setCancellation }

  // Drag-to-scroll state
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)
  const hasDragged = useRef(false)

  // Carousel arrow scroll
  const scrollCarousel = (direction) => {
    if (!cardsContainerRef.current) return
    const scrollAmount = 240
    cardsContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // Drag-to-scroll handlers
  const handleMouseDown = (e) => {
    if (!cardsContainerRef.current) return
    isDragging.current = true
    hasDragged.current = false
    dragStartX.current = e.pageX
    scrollStartX.current = cardsContainerRef.current.scrollLeft
    cardsContainerRef.current.style.cursor = 'grabbing'
    cardsContainerRef.current.style.userSelect = 'none'
  }

  const handleMouseMove = (e) => {
    if (!isDragging.current || !cardsContainerRef.current) return
    const dx = e.pageX - dragStartX.current
    if (Math.abs(dx) > 5) hasDragged.current = true
    cardsContainerRef.current.scrollLeft = scrollStartX.current - dx
  }

  const handleMouseUp = () => {
    if (!cardsContainerRef.current) return
    isDragging.current = false
    cardsContainerRef.current.style.cursor = 'grab'
    cardsContainerRef.current.style.userSelect = ''
  }

  // Attach global mousemove/mouseup so dragging works even if cursor leaves the container
  useEffect(() => {
    const onMove = (e) => handleMouseMove(e)
    const onUp = () => handleMouseUp()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Filter hotels by search query + filters
  const filteredHotels = useMemo(() => {
    let result = hotelSearchQuery
      ? hotels.filter(h => h.name.toLowerCase().includes(hotelSearchQuery.toLowerCase()))
      : [...hotels]
    if (priceMin) result = result.filter(h => h.price >= Number(priceMin))
    if (priceMax) result = result.filter(h => h.price <= Number(priceMax))
    if (minStars > 0) result = result.filter(h => h.stars >= minStars)
    if (cancellation === 'free') result = result.filter(h => h.rating >= 4.0)
    else if (cancellation === 'flexible') result = result.filter(h => h.rating >= 3.5)
    return result
  }, [hotelSearchQuery, priceMin, priceMax, minStars, cancellation])

  // Set of visible hotel IDs for marker fade transitions
  const filteredIds = useMemo(() => new Set(filteredHotels.map(h => h.id)), [filteredHotels])

  const handleHotelClick = (hotel) => {
    setActiveHotel(hotel.id)
    setFlyTo({ position: hotel.position, zoom: 14 })
  }

  const handleMarkerClick = (hotel) => {
    setActiveHotel(hotel.id)
    // Scroll to the card in "both" view
    if (activeView === 'both' && cardsContainerRef.current) {
      const cardIndex = filteredHotels.findIndex(h => h.id === hotel.id)
      const cards = cardsContainerRef.current.children
      if (cards[cardIndex]) {
        cards[cardIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    }
  }

  // AI Chat Group flow — select 3 best hotels based on preference
  const handleGroupCompare = useCallback((preference, roomCount, adultsPerRoom) => {
    const qty = parseInt(roomCount, 10) || 1
    const withDistance = hotels.map((h) => ({
      ...h,
      distance: getDistanceKm(h.position, EVENT_VENUE.position),
      valueScore: h.rating / (h.price / 100), // rating per £100
    }))

    let sorted
    switch (preference) {
      case 'Flexible cancellation':
        // Highest-rated hotels (better cancellation policies)
        sorted = [...withDistance].sort((a, b) => b.rating - a.rating)
        break
      case 'Closest to the Venue':
        sorted = [...withDistance].sort((a, b) => a.distance - b.distance)
        break
      case 'Budget option':
        sorted = [...withDistance].sort((a, b) => a.price - b.price)
        break
      case 'Good price to value':
        sorted = [...withDistance].sort((a, b) => b.valueScore - a.valueScore)
        break
      case 'Recommend me something':
      default:
        // Top rated overall
        sorted = [...withDistance].sort((a, b) => b.rating - a.rating || a.distance - b.distance)
        break
    }

    const top3 = sorted.slice(0, 3)
    if (onOpenCompareWithHotels) {
      setShowGroupLoading(true)
      setTimeout(() => {
        setShowGroupLoading(false)
        onOpenCompareWithHotels(top3, qty, adultsPerRoom || 1)
      }, 2000)
    }
  }, [onOpenCompareWithHotels])

  // Centered on ExCeL London / Royal Docks area
  const center = [51.508, 0.015]

  return (
    <div className="map-screen">
      {/* Logo */}
      <a href="https://www.dsei.co.uk/" target="_blank" rel="noopener noreferrer" className="logo-container">
        <img src="/dsei-logo.png" alt="DSEI UK" className="logo-image" />
      </a>

      <SearchBar activeView={activeView} onViewChange={setActiveView} onHotelSearch={setHotelSearchQuery} onGroupBooking={() => setGroupTrigger((n) => n + 1)} onDatesChange={onDatesChange} />

      <MapContainer
        center={center}
        zoom={13}
        className="map-container"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {flyTo && <FlyToPosition position={flyTo.position} zoom={flyTo.zoom} />}

        {hotels.map((hotel) => {
          const isHidden = !filteredIds.has(hotel.id)
          const dist = getDistanceKm(hotel.position, EVENT_VENUE.position)
          return (
            <Marker
              key={hotel.id}
              position={hotel.position}
              icon={createMarkerIcon(hotel.price, activeHotel === hotel.id, isHidden)}
              eventHandlers={{
                click: () => !isHidden && handleMarkerClick(hotel),
              }}
            >
              <Popup className="hotel-popup-rich" maxWidth={300} minWidth={280}>
                {(() => {
                  const travel = formatTravelTime(dist)
                  return (
                    <div className="popup-card popup-card-clickable" onClick={() => onHotelDetailOpen(hotel)}>
                      <div className="popup-card-img-wrap">
                        <img src={hotel.image} alt={hotel.name} className="popup-card-img" />
                        <span className="popup-card-price">£{hotel.price}</span>
                        <div className="popup-card-overlay">
                          {hotel.promotion && <span className="popup-card-promo">{hotel.promotion}</span>}
                          <div className="popup-card-name">{hotel.name}</div>
                          <div className="popup-card-stars-row">
                            <span className="popup-card-stars" dangerouslySetInnerHTML={{ __html: starsHtml(hotel.stars) }} />
                            <span className="popup-card-rating"><strong>{hotel.rating}</strong> ({hotel.reviews.toLocaleString()})</span>
                          </div>
                        </div>
                      </div>
                      <div className="popup-card-bottom">
                        <div className="popup-card-distance">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" stroke="#ccc" strokeWidth="1.2" fill="none"/><circle cx="8" cy="6" r="1.5" fill="#ccc"/></svg>
                          <span>{formatDistance(dist)} to ExCeL</span>
                        </div>
                        <span className="popup-card-dot">·</span>
                        <div className="popup-card-travel">
                          {travel.icon === 'walk' ? (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="2.5" r="1.5" fill="#ccc"/><path d="M6.5 5.5L8 8l2 1.5M8 8v3.5l-1.5 3M8 11.5l2 3" stroke="#ccc" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="5" width="13" height="6" rx="1.5" stroke="#ccc" strokeWidth="1.1" fill="none"/><circle cx="4.5" cy="12.5" r="1.3" stroke="#ccc" strokeWidth="1" fill="none"/><circle cx="11.5" cy="12.5" r="1.3" stroke="#ccc" strokeWidth="1" fill="none"/><path d="M3 5V3.5a1 1 0 011-1h3l1.5 2.5" stroke="#ccc" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                          )}
                          <span>{travel.text}</span>
                        </div>
                        {isHighDemand(hotel.id, hotel.rating) && (
                          <span className="popup-card-demand">📈 High demand</span>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </Popup>
            </Marker>
          )
        })}

        {/* Event venue marker */}
        <Marker
          position={EVENT_VENUE.position}
          icon={eventVenueIcon}
          zIndexOffset={1000}
        >
          <Popup className="venue-popup-rich" maxWidth={300} minWidth={280}>
            <div className="popup-card">
              <div className="popup-card-img-wrap">
                <img src={EVENT_VENUE.image} alt={EVENT_VENUE.name} className="popup-card-img" />
              </div>
              <div className="popup-card-body">
                <div className="popup-card-name">{EVENT_VENUE.name}</div>
                <div className="popup-card-event-name">{EVENT_VENUE.eventName}</div>
                <div className="popup-card-event-info">{EVENT_VENUE.eventInfo}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* List / Map filter overlay */}
      {(activeView === 'list' || activeView === 'map') && (
        <HotelList
          hotels={filteredHotels}
          allHotels={hotels}
          activeHotel={activeHotel}
          onHotelClick={handleHotelClick}
          onCompare={addToCompare}
          isInCompare={isInCompare}
          onDetailOpen={onHotelDetailOpen}
          activeView={activeView}
          filterState={filterState}
        />
      )}

      {/* AI Chat — always visible regardless of view */}
      <AiChat
        activeView={activeView}
        onGroupCompare={handleGroupCompare}
        triggerGroup={groupTrigger}
        onBudgetFilter={(maxPrice) => {
          setPriceMax(String(maxPrice))
          setActiveView('list')
        }}
        onClearFilters={() => {
          setPriceMin('')
          setPriceMax('')
          setMinStars(0)
          setCancellation('all')
        }}
      />

      {/* Compare tray — top right */}
      <CompareTray
        compareHotels={compareHotels}
        onRemove={removeFromCompare}
        onCompare={onOpenCompare}
        onTrayClick={() => { setBlinkCompareButtons(true); setTimeout(() => setBlinkCompareButtons(false), 1500) }}
      />

      {/* Bottom cards overlay — visible in "both" view only */}
      {activeView === 'both' && (
        <div className="cards-overlay">
          <div className="cards-carousel-wrapper">
            <button
              className="carousel-arrow carousel-arrow-left"
              onClick={() => scrollCarousel('left')}
              aria-label="Scroll left"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div
              className="cards-scroll"
              ref={cardsContainerRef}
              onMouseDown={handleMouseDown}
              style={{ cursor: 'grab' }}
            >
              {hotels.map((hotel) => {
                const isHidden = !filteredHotels.some(h => h.id === hotel.id)
                return (
                  <div key={hotel.id} className={`card-fade-wrap ${isHidden ? 'card-fade-hidden' : ''}`}>
                    <HotelCard
                      hotel={hotel}
                      isActive={activeHotel === hotel.id}
                      onClick={handleHotelClick}
                      onCompare={addToCompare}
                      isCompared={isInCompare(hotel.id)}
                      onDetailOpen={onHotelDetailOpen}
                      blinkCompare={blinkCompareButtons}
                    />
                  </div>
                )
              })}
            </div>
            <button
              className="carousel-arrow carousel-arrow-right"
              onClick={() => scrollCarousel('right')}
              aria-label="Scroll right"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay for Group flow */}
      {showGroupLoading && (
        <div className="group-loading-overlay">
          <div className="group-loading-box">
            <div className="group-loading-spinner" />
            <span className="group-loading-text">Loading best offers...</span>
          </div>
        </div>
      )}

    </div>
  )
}

export default MapScreen
