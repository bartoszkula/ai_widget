// Extended hotel detail data — maps hotel id to extra fields
// Gallery images, amenities, room types, etc.

const galleryPool = [
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1529290130-4ca3753253ae?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1560200353-ce0a76b1d438?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1535827841776-24afc1e255ac?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&h=500&fit=crop',
]

// Generates 5 gallery images for a hotel by cycling through the pool
const getGallery = (hotelId) => {
  const start = ((hotelId - 1) * 3) % galleryPool.length
  return [0, 1, 2, 3, 4].map(i => galleryPool[(start + i) % galleryPool.length])
}

const amenitiesOptions = [
  'Free Wi-Fi', 'Gym', 'Spa', 'Pool', 'Restaurant', 'Bar', 'Parking',
  'Room Service', 'Business Centre', 'Concierge', 'Airport Shuttle',
  'Laundry', 'Pet Friendly', 'Air Conditioning', 'EV Charging',
]

const getAmenities = (hotelId, stars) => {
  const count = stars >= 4 ? 8 : stars >= 3 ? 6 : 4
  const start = (hotelId * 2) % amenitiesOptions.length
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(amenitiesOptions[(start + i) % amenitiesOptions.length])
  }
  return result
}

const roomImagePool = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=600&h=400&fit=crop',
]

const roomTypes = [
  {
    type: 'Standard Room',
    description: 'Comfortable room with all essential amenities for a pleasant stay.',
    amenities: ['Free Wi-Fi', 'Air Conditioning', 'TV', 'Desk', 'Safe', 'En-suite Bathroom', 'Hairdryer', 'Iron & Board'],
    boardOptions: ['Room Only', 'Bed & Breakfast'],
    cancellationOptions: [
      { value: 'free', label: 'Free Cancellation', detail: 'Free cancel until 48h before check-in' },
      { value: 'flexible', label: 'Flexible', detail: 'Cancel until 24h before, small fee' },
      { value: 'nonref', label: 'Non-refundable', detail: 'Best price, no changes allowed' },
    ],
    cancellation: 'Free cancellation until 48h before check-in',
    priceMultiplier: 1.0,
    maxGuests: 2,
    imageIndex: 0,
  },
  {
    type: 'Superior Room',
    description: 'Spacious room with upgraded furnishings and city views.',
    amenities: ['Free Wi-Fi', 'Air Conditioning', 'TV', 'Minibar', 'Safe', 'Coffee Machine', 'Blackout Curtains', 'Luxury Toiletries', 'Hairdryer'],
    boardOptions: ['Room Only', 'Bed & Breakfast', 'Half Board'],
    cancellationOptions: [
      { value: 'free', label: 'Free Cancellation', detail: 'Free cancel until 24h before check-in' },
      { value: 'flexible', label: 'Flexible', detail: 'Cancel until 12h before, small fee' },
      { value: 'nonref', label: 'Non-refundable', detail: 'Best price, no changes allowed' },
    ],
    cancellation: 'Free cancellation until 24h before check-in',
    priceMultiplier: 1.35,
    maxGuests: 2,
    imageIndex: 1,
  },
  {
    type: 'Deluxe Room',
    description: 'Premium room with panoramic views, luxury bedding and exclusive amenities.',
    amenities: ['Free Wi-Fi', 'Air Conditioning', 'Smart TV', 'Minibar', 'Safe', 'Coffee Machine', 'Bathrobe & Slippers', 'Nespresso', 'Rain Shower', 'Pillow Menu', 'USB Charging'],
    boardOptions: ['Bed & Breakfast', 'Half Board', 'Full Board'],
    cancellationOptions: [
      { value: 'flexible', label: 'Flexible', detail: 'Cancel until 24h before, small fee' },
      { value: 'nonref', label: 'Non-refundable', detail: 'Best price guarantee' },
    ],
    cancellation: 'Non-refundable — best price guarantee',
    priceMultiplier: 1.75,
    maxGuests: 2,
    imageIndex: 2,
  },
  {
    type: 'Family Suite',
    description: 'Generous suite with separate living area, perfect for families.',
    amenities: ['Free Wi-Fi', 'Air Conditioning', 'Smart TV', 'Minibar', 'Safe', 'Kitchenette', 'Sofa Bed', 'Baby Cot Available', 'Washing Machine', 'Highchair', 'Extra Towels'],
    boardOptions: ['Room Only', 'Bed & Breakfast', 'Half Board'],
    cancellationOptions: [
      { value: 'free', label: 'Free Cancellation', detail: 'Free cancel until 72h before check-in' },
      { value: 'flexible', label: 'Flexible', detail: 'Cancel until 48h before, small fee' },
      { value: 'nonref', label: 'Non-refundable', detail: 'Best price, no changes allowed' },
    ],
    cancellation: 'Free cancellation until 72h before check-in',
    priceMultiplier: 2.1,
    maxGuests: 4,
    imageIndex: 3,
  },
]

// Returns 2-4 room types based on star rating
const getRoomTypes = (hotelId, basePrice, stars) => {
  const count = stars >= 4 ? 4 : stars >= 3 ? 3 : 2
  return roomTypes.slice(0, count).map(rt => ({
    ...rt,
    price: Math.round(basePrice * rt.priceMultiplier),
    image: roomImagePool[(rt.imageIndex + hotelId) % roomImagePool.length],
  }))
}

export const getHotelDetail = (hotel) => ({
  ...hotel,
  gallery: getGallery(hotel.id),
  amenities: getAmenities(hotel.id, hotel.stars),
  rooms: getRoomTypes(hotel.id, hotel.price, hotel.stars),
})
