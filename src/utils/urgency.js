// Deterministic pseudo-random based on hotel ID — consistent per hotel, looks random
const seededRandom = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

// "X people viewing now" — 2-9, appears on ~60% of hotels
export const getViewingNow = (hotelId) => {
  const r = seededRandom(hotelId + 7)
  if (r > 0.6) return null // 40% chance of no badge
  return Math.floor(seededRandom(hotelId + 3) * 8) + 2 // 2-9
}

// "Booked X times today" — 5-28, higher stars = more bookings
export const getBookedToday = (hotelId, stars) => {
  const base = stars >= 4 ? 14 : stars >= 3 ? 8 : 5
  return base + Math.floor(seededRandom(hotelId + 11) * 15)
}

// "Only X rooms left" — 1-5, appears on ~50% of room types
export const getRoomsLeft = (hotelId, roomIdx) => {
  const r = seededRandom(hotelId * 100 + roomIdx + 17)
  if (r > 0.5) return null // 50% chance of no badge
  return Math.floor(seededRandom(hotelId * 100 + roomIdx + 29) * 5) + 1 // 1-5
}

// "High demand" — appears on ~40% of hotels (top-rated)
export const isHighDemand = (hotelId, rating) => {
  if (rating < 4.0) return false
  return seededRandom(hotelId + 23) < 0.55
}

// Days until DSEI 2027 (Sep 7, 2027)
export const getDaysUntilEvent = () => {
  const eventDate = new Date(2027, 8, 7) // Sep 7, 2027
  const now = new Date()
  const diff = eventDate - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// "Price increase likely" — deterministic % increase per hotel, 5-18%
export const getPriceIncrease = (hotelId) => {
  return Math.floor(seededRandom(hotelId + 37) * 14) + 5 // 5-18%
}
