import { useState, useMemo, useRef } from 'react'
import { getViewingNow } from '../../utils/urgency'
import './HotelList.css'

// ExCeL London coordinates
const VENUE_POSITION = [51.5085, 0.0295]

// Quick amenity tags for list view
const AMENITY_POOL = ['Wi-Fi', 'Gym', 'Spa', 'Pool', 'Restaurant', 'Bar', 'Parking', 'Room Service', 'Business Ctr', 'Shuttle', 'EV Charging', 'Pet Friendly']
const getQuickAmenities = (hotelId, stars) => {
  const count = stars >= 4 ? 5 : 4
  const start = ((hotelId - 1) * 2) % AMENITY_POOL.length
  return Array.from({ length: count }, (_, i) => AMENITY_POOL[(start + i) % AMENITY_POOL.length])
}

// Best cancellation for hotel based on stars
const getBestCancellation = (stars) => {
  if (stars >= 4) return { label: 'Free cancellation', cls: 'list-cancel-free' }
  if (stars >= 3) return { label: 'Flexible', cls: 'list-cancel-flexible' }
  return { label: 'Non-refundable', cls: 'list-cancel-nonref' }
}

// Haversine formula to calculate distance in km
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

const StarRating = ({ count }) => (
  <div className="list-stars">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 0.5L7.76 3.95L11.5 4.54L8.75 7.29L9.41 11.06L6 9.24L2.59 11.06L3.25 7.29L0.5 4.54L4.24 3.95L6 0.5Z"
          fill={i < count ? '#F5C518' : '#555'}
        />
      </svg>
    ))}
  </div>
)

// Clickable star filter
const StarFilter = ({ minStars, onChange }) => (
  <div className="filter-stars-row">
    {[3, 4, 5].map((s) => (
      <button
        key={s}
        className={`filter-star-btn ${minStars === s ? 'filter-star-btn-active' : ''}`}
        onClick={() => onChange(minStars === s ? 0 : s)}
      >
        {s}<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 0.5L7.76 3.95L11.5 4.54L8.75 7.29L9.41 11.06L6 9.24L2.59 11.06L3.25 7.29L0.5 4.54L4.24 3.95L6 0.5Z" fill="#F5C518"/></svg>+
      </button>
    ))}
  </div>
)

const HotelList = ({ hotels, allHotels, activeHotel, onHotelClick, onCompare, isInCompare, onDetailOpen, activeView, filterState }) => {
  const [sortBy, setSortBy] = useState('distance')
  const [showFilters, setShowFilters] = useState(false)

  // Use lifted filter state from parent
  const { priceMin, setPriceMin, priceMax, setPriceMax, minStars, setMinStars, cancellation, setCancellation } = filterState || {}

  const isMapView = activeView === 'map'

  const listScrollRef = useRef(null)

  // Scroll list with arrows
  const scrollList = (direction) => {
    if (!listScrollRef.current) return
    const scrollAmount = 300
    listScrollRef.current.scrollBy({
      top: direction === 'up' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const activeFilterCount = (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + ((minStars || 0) > 0 ? 1 : 0) + (cancellation && cancellation !== 'all' ? 1 : 0)

  // Sort ALL hotels (for fade transitions), filtered set used for visibility
  const sourceHotels = allHotels || hotels
  const sortedAllHotels = useMemo(() => {
    const withDistance = sourceHotels.map((h) => ({
      ...h,
      distance: getDistanceKm(h.position, VENUE_POSITION),
    }))

    switch (sortBy) {
      case 'price-low':
        return [...withDistance].sort((a, b) => a.price - b.price)
      case 'price-high':
        return [...withDistance].sort((a, b) => b.price - a.price)
      case 'distance':
      default:
        return [...withDistance].sort((a, b) => a.distance - b.distance)
    }
  }, [sourceHotels, sortBy])

  // Set of visible hotel IDs for quick lookup
  const visibleIds = useMemo(() => new Set(hotels.map(h => h.id)), [hotels])

  // Price range bounds for the slider
  const priceBounds = useMemo(() => {
    const prices = sourceHotels.map(h => h.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [sourceHotels])

  const sliderMin = priceMin ? Number(priceMin) : priceBounds.min
  const sliderMax = priceMax ? Number(priceMax) : priceBounds.max

  const clearFilters = () => {
    if (setPriceMin) setPriceMin('')
    if (setPriceMax) setPriceMax('')
    if (setMinStars) setMinStars(0)
    if (setCancellation) setCancellation('all')
  }

  return (
    <div className={`hotel-list-overlay ${isMapView ? 'hotel-list-map-mode' : ''}`}>
      <div className="hotel-list-header">
        <span className="hotel-list-count">Displaying {visibleIds.size} hotels</span>
        <div className="hotel-list-header-top">
          <div className="hotel-list-header-controls">
            {!isMapView && (
              <div className="hotel-list-sort-inline">
                <label className="sort-label">Sort by</label>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="distance">Distance from Venue</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            )}
            <button
              className={`filter-toggle-btn ${showFilters ? 'filter-toggle-btn-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filters{activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="filters-panel">
            {/* Price range slider */}
            <div className="filter-group">
              <label className="filter-label">Price range (£)</label>
              <div className="filter-price-slider-wrapper">
                <div className="filter-price-slider-track">
                  <div
                    className="filter-price-slider-fill"
                    style={{
                      left: `${((sliderMin - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%`,
                      right: `${100 - ((sliderMax - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%`,
                    }}
                  />
                </div>
                <div className="filter-price-slider-thumbs">
                  <div className="filter-price-pin" style={{ left: `${((sliderMin - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%` }}>£{sliderMin}</div>
                  <input
                    type="range"
                    className="filter-price-range filter-price-range-min"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={5}
                    value={sliderMin}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (val <= sliderMax) setPriceMin && setPriceMin(val === priceBounds.min ? '' : String(val))
                    }}
                  />
                  <input
                    type="range"
                    className="filter-price-range filter-price-range-max"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={5}
                    value={sliderMax}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (val >= sliderMin) setPriceMax && setPriceMax(val === priceBounds.max ? '' : String(val))
                    }}
                  />
                  <div className="filter-price-pin" style={{ left: `${((sliderMax - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%` }}>£{sliderMax}</div>
                </div>
              </div>
            </div>

            {/* Star rating */}
            <div className="filter-group">
              <label className="filter-label">Star rating</label>
              <StarFilter minStars={minStars || 0} onChange={setMinStars} />
            </div>

            {/* Cancellation policy */}
            <div className="filter-group">
              <label className="filter-label">Cancellation</label>
              <div className="filter-cancel-row">
                {[
                  { value: 'all', label: 'Any' },
                  { value: 'free', label: 'Free' },
                  { value: 'flexible', label: 'Flexible' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`filter-cancel-btn ${(cancellation || 'all') === opt.value ? 'filter-cancel-btn-active' : ''}`}
                    onClick={() => setCancellation && setCancellation(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button className="filter-clear-btn" onClick={clearFilters}>
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Sort is now inline in header-top */}
      </div>

      {/* List with up/down arrows — hidden in map view */}
      {!isMapView && (
      <div className="hotel-list-scroll-wrapper">
        <button
          className="list-arrow list-arrow-up"
          onClick={() => scrollList('up')}
          aria-label="Scroll up"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M4 11L9 6L14 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="hotel-list-scroll" ref={listScrollRef}>
          {sortedAllHotels.map((hotel) => {
            const isHidden = !visibleIds.has(hotel.id)
            return (
              <div
                key={hotel.id}
                className={`list-fade-wrap ${isHidden ? 'list-fade-hidden' : ''}`}
              >
                <div
                  className={`hotel-list-item ${activeHotel === hotel.id ? 'hotel-list-item-active' : ''}`}
                  onClick={() => onDetailOpen ? onDetailOpen(hotel) : onHotelClick(hotel)}
                >
                  <div className="hotel-list-item-image-wrapper">
                    <img
                      src={hotel.image}
                      alt={hotel.name}
                      className="hotel-list-item-image"
                      loading="lazy"
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop' }}
                    />
                    <div className="hotel-list-item-price-badge">£{hotel.price}</div>
                    {hotel.promotion && (
                      <div className="hotel-list-item-promotion">{hotel.promotion}</div>
                    )}
                  </div>
                  <div className="hotel-list-item-info">
                    <h3 className="hotel-list-item-name">{hotel.name}</h3>
                    <div className="hotel-list-item-stars-row">
                      <StarRating count={hotel.stars} />
                      <span className="hotel-list-item-rating">
                        <strong>{hotel.rating}</strong> ({hotel.reviews.toLocaleString()})
                      </span>
                    </div>
                    <div className="hotel-list-item-amenities">
                      {getQuickAmenities(hotel.id, hotel.stars).map((a) => (
                        <span key={a} className="hotel-list-amenity-tag">{a}</span>
                      ))}
                    </div>
                    <div className="hotel-list-item-meta">
                      <div className="hotel-list-item-distance">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M8 1C5.24 1 3 3.24 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" stroke="#999" strokeWidth="1.2" fill="none"/>
                          <circle cx="8" cy="6" r="1.5" fill="#999"/>
                        </svg>
                        {hotel.distance.toFixed(1)} km from ExCeL
                      </div>
                      <span className={`hotel-list-cancel-tag ${getBestCancellation(hotel.stars).cls}`}>{getBestCancellation(hotel.stars).label}</span>
                      {getViewingNow(hotel.id) && (
                        <span className="list-viewing-badge">
                          <span className="list-viewing-dot" />
                          {getViewingNow(hotel.id)} viewing now
                        </span>
                      )}
                    </div>
                    {onCompare && (
                      <button
                        className={`list-compare-btn ${isInCompare && isInCompare(hotel.id) ? 'list-compare-active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onCompare(hotel) }}
                      >
                        {isInCompare && isInCompare(hotel.id) ? '✓ Comparing' : '+ Compare'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {visibleIds.size === 0 && (
            <div className="hotel-list-empty">
              No hotels match your filters
            </div>
          )}
        </div>

        <button
          className="list-arrow list-arrow-down"
          onClick={() => scrollList('down')}
          aria-label="Scroll down"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M4 7L9 12L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      )}
    </div>
  )
}

export default HotelList
