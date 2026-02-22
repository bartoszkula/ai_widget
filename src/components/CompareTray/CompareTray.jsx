import './CompareTray.css'

const CompareTray = ({ compareHotels, onRemove, onCompare, onTrayClick }) => {
  return (
    <div className={`compare-tray ${compareHotels.length === 0 ? 'compare-tray-empty' : ''}`} onClick={() => { if (onTrayClick) onTrayClick() }}>
      <div className="compare-tray-header">
        <span className="compare-tray-title">Compare hotels ({compareHotels.length}/3)</span>
      </div>

      {compareHotels.length === 0 && (
        <div className="compare-tray-hint">
          <svg className="compare-tray-hint-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="11" y="4" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5.5 7h0M5.5 9h0M5.5 11h0M14.5 7h0M14.5 9h0M14.5 11h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="compare-tray-hint-text">Select hotels to compare</span>
        </div>
      )}

      {compareHotels.length > 0 && (
        <div className="compare-tray-items">
          {compareHotels.map((hotel) => (
            <div key={hotel.id} className="compare-tray-item">
              <img src={hotel.image} alt={hotel.name} className="compare-tray-img" />
              <div className="compare-tray-info">
                <span className="compare-tray-name">{hotel.name}</span>
                <span className="compare-tray-price">£{hotel.price}</span>
              </div>
              <button
                className="compare-tray-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(hotel.id) }}
                aria-label="Remove"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {compareHotels.length >= 2 && (
        <button className="compare-tray-btn" onClick={onCompare}>
          Compare Hotels
        </button>
      )}
    </div>
  )
}

export default CompareTray
