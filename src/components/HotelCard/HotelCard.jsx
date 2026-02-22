import { getViewingNow } from '../../utils/urgency'
import './HotelCard.css'

const StarRating = ({ rating, maxStars = 5 }) => {
  return (
    <div className="star-rating">
      {[...Array(maxStars)].map((_, i) => (
        <svg
          key={i}
          className={`star ${i < Math.floor(rating) ? 'star-filled' : 'star-empty'}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M6 0.5L7.76 3.95L11.5 4.54L8.75 7.29L9.41 11.06L6 9.24L2.59 11.06L3.25 7.29L0.5 4.54L4.24 3.95L6 0.5Z"
            fill={i < Math.floor(rating) ? '#F5C518' : '#ddd'}
          />
        </svg>
      ))}
    </div>
  )
}

const HotelCard = ({ hotel, isActive, onClick, onCompare, isCompared, onDetailOpen, blinkCompare }) => {
  const handleCardClick = () => {
    if (onDetailOpen) {
      onDetailOpen(hotel)
    } else {
      onClick(hotel)
    }
  }

  const handleCompareClick = (e) => {
    e.stopPropagation()
    if (onCompare) onCompare(hotel)
  }

  return (
    <div
      className={`hotel-card ${isActive ? 'hotel-card-active' : ''}`}
      onClick={handleCardClick}
    >
      <div className="hotel-card-image-wrapper">
        <img
          src={hotel.image}
          alt={hotel.name}
          className="hotel-card-image"
          loading="lazy"
        />
        <div className="hotel-card-price-badge">
          £{hotel.price}
        </div>
        {hotel.promotion && (
          <div className="hotel-card-promotion">
            {hotel.promotion}
          </div>
        )}
      </div>
      <div className="hotel-card-info">
        <h3 className="hotel-card-name">{hotel.name}</h3>
        <div className="hotel-card-rating-row">
          <StarRating rating={hotel.stars} />
          <span className="hotel-card-rating-score">{hotel.rating}</span>
          <span className="hotel-card-reviews">({hotel.reviews.toLocaleString()})</span>
        </div>
        <div className={`hotel-card-viewing ${getViewingNow(hotel.id) ? '' : 'hotel-card-viewing-hidden'}`}>
          <span className="hotel-card-viewing-dot" />
          {getViewingNow(hotel.id) ? `${getViewingNow(hotel.id)} people viewing` : '\u00A0'}
        </div>
        {onCompare && (
          <button
            className={`hotel-card-compare-btn ${isCompared ? 'hotel-card-compare-active' : ''} ${blinkCompare && !isCompared ? 'hotel-card-compare-blink' : ''}`}
            onClick={handleCompareClick}
          >
            {isCompared ? '✓ Comparing' : '+ Compare'}
          </button>
        )}
      </div>
    </div>
  )
}

export default HotelCard
