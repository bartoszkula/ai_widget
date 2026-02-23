import { useState, useCallback } from 'react'
import MapScreen from './components/MapScreen/MapScreen'
import HotelDetail from './components/HotelDetail/HotelDetail'
import CompareHotels from './components/CompareHotels/CompareHotels'
import { ToastProvider, useToast } from './components/Toast/Toast'
import './App.css'

function AppInner() {
  const [currentPage, setCurrentPage] = useState('map') // 'map' | 'detail' | 'compare'
  const [previousPage, setPreviousPage] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [compareHotels, setCompareHotels] = useState([])
  const [initialRoomQty, setInitialRoomQty] = useState(1)
  const [initialAdultsPerRoom, setInitialAdultsPerRoom] = useState(1)
  const [searchCheckIn, setSearchCheckIn] = useState('2027-09-07')
  const [searchCheckOut, setSearchCheckOut] = useState('2027-09-10')
  const showToast = useToast()

  const handleDatesChange = useCallback((start, end) => {
    const fmt = (d) => d.toISOString().slice(0, 10)
    setSearchCheckIn(fmt(start))
    setSearchCheckOut(fmt(end))
  }, [])

  const openHotelDetail = useCallback((hotel) => {
    setPreviousPage((prev) => currentPage !== 'detail' ? currentPage : prev)
    setSelectedHotel(hotel)
    setCurrentPage('detail')
  }, [currentPage])

  const goBack = useCallback(() => {
    if (previousPage === 'compare' && compareHotels.length >= 1) {
      setCurrentPage('compare')
    } else {
      setCurrentPage('map')
    }
    setSelectedHotel(null)
    setPreviousPage(null)
  }, [previousPage, compareHotels])

  const openCompare = useCallback(() => {
    setInitialRoomQty(1)
    setCurrentPage('compare')
  }, [])

  // Called from AI chat Group flow — set specific hotels + quantity and open compare
  const openCompareWithHotels = useCallback((selectedHotels, qty, adultsPerRoom) => {
    setCompareHotels(selectedHotels)
    setInitialRoomQty(qty)
    setInitialAdultsPerRoom(adultsPerRoom || 1)
    setCurrentPage('compare')
  }, [])

  const addToCompare = useCallback((hotel) => {
    const exists = compareHotels.find((h) => h.id === hotel.id)
    if (exists) {
      showToast(`${hotel.name} removed from compare`, 'info', 2500)
      setCompareHotels((prev) => prev.filter((h) => h.id !== hotel.id))
    } else if (compareHotels.length >= 3) {
      showToast('Compare list is full (max 3 hotels)', 'warning', 2500)
    } else {
      showToast(`${hotel.name} added to compare`, 'success', 2500)
      setCompareHotels((prev) => [...prev, hotel])
    }
  }, [compareHotels, showToast])

  const removeFromCompare = useCallback((hotelId) => {
    setCompareHotels((prev) => prev.filter((h) => h.id !== hotelId))
  }, [])

  const replaceHotel = useCallback((oldHotelId, newHotel) => {
    setCompareHotels((prev) => prev.map((h) => (h.id === oldHotelId ? newHotel : h)))
  }, [])

  const replaceAllHotels = useCallback((newHotels) => {
    setCompareHotels(newHotels)
  }, [])

  const isInCompare = useCallback((hotelId) => {
    return compareHotels.some((h) => h.id === hotelId)
  }, [compareHotels])

  return (
    <div className="app-container">
      {currentPage === 'map' && (
        <MapScreen
          onHotelDetailOpen={openHotelDetail}
          onOpenCompare={openCompare}
          onOpenCompareWithHotels={openCompareWithHotels}
          compareHotels={compareHotels}
          addToCompare={addToCompare}
          removeFromCompare={removeFromCompare}
          isInCompare={isInCompare}
          onDatesChange={handleDatesChange}
        />
      )}
      {currentPage === 'detail' && selectedHotel && (
        <HotelDetail
          hotel={selectedHotel}
          onBack={goBack}
          addToCompare={addToCompare}
          isInCompare={isInCompare}
          compareHotels={compareHotels}
          removeFromCompare={removeFromCompare}
          onOpenCompare={openCompare}
          onGroupBooking={(h) => {
            setCompareHotels([h])
            setInitialRoomQty(10)
            setCurrentPage('compare')
          }}
        />
      )}
      {currentPage === 'compare' && compareHotels.length >= 1 && (
        <CompareHotels
          hotels={compareHotels}
          onBack={goBack}
          onRemoveHotel={removeFromCompare}
          onReplaceHotel={replaceHotel}
          onReplaceAllHotels={replaceAllHotels}
          onViewHotelDetail={openHotelDetail}
          initialQuantity={initialRoomQty}
          initialAdultsPerRoom={initialAdultsPerRoom}
          defaultCheckIn={searchCheckIn}
          defaultCheckOut={searchCheckOut}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

export default App
