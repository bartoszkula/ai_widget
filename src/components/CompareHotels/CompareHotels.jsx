import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { getHotelDetail } from '../../data/hotelDetails'
import { hotels as allHotelsData } from '../../data/hotels'
import { useToast } from '../Toast/Toast'
import { getPriceIncrease, getDaysUntilEvent } from '../../utils/urgency'
import './CompareHotels.css'

const VENUE_POS = [51.5085, 0.0295]

const getDistanceKm = (pos1, pos2) => {
  const R = 6371
  const dLat = ((pos2[0] - pos1[0]) * Math.PI) / 180
  const dLon = ((pos2[1] - pos1[1]) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((pos1[0] * Math.PI) / 180) *
      Math.cos((pos2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Estimate walking/driving time
const getWalkMins = (distKm) => Math.round((distKm / 5) * 60)
const getDriveMins = (distKm) => Math.max(1, Math.round((distKm / 30) * 60))
const formatTravelTime = (distKm) => {
  const walkMins = getWalkMins(distKm)
  if (walkMins < 30) return { text: `${walkMins} min walk`, icon: 'walk' }
  return { text: `${getDriveMins(distKm)} min drive`, icon: 'drive' }
}

const BOARD_SURCHARGES = {
  'Room Only': 0,
  'Bed & Breakfast': 8,
  'Half Board': 18,
  'Full Board': 30,
}

const CANCEL_OPTIONS = [
  { value: 'non-refundable', label: 'Non-refundable', pct: 0 },
  { value: 'moderate', label: 'Moderate', pct: 0.04 },
  { value: 'flexible', label: 'Flexible', pct: 0.09 },
]

let _nextId = 1

const AI_COLLAPSED_PHRASES = [
  "OK, I'm here if you need me.",
  "I'm here to help you.",
  "Need a hand?",
  "Unsure where to begin?",
]

const CompareHotels = ({ hotels, onBack, onRemoveHotel, onReplaceHotel, onReplaceAllHotels, initialQuantity = 1, initialAdultsPerRoom = 1, defaultCheckIn = '2027-09-07', defaultCheckOut = '2027-09-10' }) => {
  const [showSummary, setShowSummary] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [aiCollapsedPhrase, setAiCollapsedPhrase] = useState('')
  const [lightboxImg, setLightboxImg] = useState(null)
  const [flashHotelIds, setFlashHotelIds] = useState(new Set())
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareSent, setShareSent] = useState(false)
  const [removingHotelId, setRemovingHotelId] = useState(null)
  const [awaitingReplaceClick, setAwaitingReplaceClick] = useState(false)
  const [aiMessage, setAiMessage] = useState(null)
  const [showBooking, setShowBooking] = useState(false)
  const [bookingForm, setBookingForm] = useState({ firstName: '', lastName: '', email: '', company: '', vat: '', cardNumber: '', expiry: '', cvv: '' })
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const bodyRef = useRef(null)
  const showToast = useToast()

  // Build detail objects with distance, sorted cheapest to most expensive
  const details = useMemo(
    () =>
      hotels
        .map((h) => ({
          ...getHotelDetail(h),
          dist: getDistanceKm(h.position, VENUE_POS),
        }))
        .sort((a, b) => {
          const aMin = Math.min(...(a.rooms || []).map((r) => r.price))
          const bMin = Math.min(...(b.rooms || []).map((r) => r.price))
          return aMin - bMin
        }),
    [hotels],
  )

  // Room configurations per hotel: { [hotelId]: [config, ...] }
  const [configs, setConfigs] = useState(() => {
    const init = {}
    hotels.forEach((h) => {
      const d = getHotelDetail(h)
      // Pick the cheapest room type
      const cheapestIdx = d.rooms && d.rooms.length > 0
        ? d.rooms.reduce((best, r, i) => (r.price < d.rooms[best].price ? i : best), 0)
        : 0
      init[h.id] = [
        {
          id: _nextId++,
          roomTypeIndex: cheapestIdx,
          checkIn: defaultCheckIn,
          checkOut: defaultCheckOut,
          adults: initialAdultsPerRoom,
          children: 0,
          childAges: [],
          board: d.rooms[cheapestIdx]?.boardOptions?.[0] || 'Room Only',
          cancellation: 'moderate',
          quantity: initialQuantity,
          editing: false,
        },
      ]
    })
    return init
  })

  // Initial loading skeleton
  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 400)
    return () => clearTimeout(timer)
  }, [])

  // Auto-go-back if no hotels remain
  useEffect(() => {
    if (hotels.length < 1) onBack()
  }, [hotels.length, onBack])

  // Sync configs when hotels change (removal)
  useEffect(() => {
    const ids = new Set(hotels.map((h) => h.id))
    setConfigs((prev) => {
      const next = {}
      for (const [id, cfgs] of Object.entries(prev)) {
        if (ids.has(Number(id))) next[id] = cfgs
      }
      return next
    })
  }, [hotels])

  // Back-to-top scroll listener
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onScroll = () => setShowBackToTop(el.scrollTop > 300)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  /* ── Helpers ── */
  const getNights = (cin, cout) => {
    const d1 = new Date(cin)
    const d2 = new Date(cout)
    return Math.max(1, Math.round((d2 - d1) / 864e5))
  }

  const getRoom = (hotelId, idx) => details.find((d) => d.id === hotelId)?.rooms?.[idx]

  const getBaseTotal = (hid, c) => {
    const room = getRoom(hid, c.roomTypeIndex)
    return room ? room.price * getNights(c.checkIn, c.checkOut) * c.quantity : 0
  }

  const getBoardTotal = (_, c) => {
    return (BOARD_SURCHARGES[c.board] || 0) * getNights(c.checkIn, c.checkOut) * c.quantity
  }

  const getCancelTotal = (hid, c) => {
    const room = getRoom(hid, c.roomTypeIndex)
    if (!room) return 0
    const opt = CANCEL_OPTIONS.find((o) => o.value === c.cancellation)
    return Math.round(room.price * (opt?.pct || 0)) * getNights(c.checkIn, c.checkOut) * c.quantity
  }

  const getConfigTotal = (hid, c) => getBaseTotal(hid, c) + getBoardTotal(hid, c) + getCancelTotal(hid, c)

  /* ── Config CRUD ── */
  const updateConfig = useCallback((hotelId, configId, updates) => {
    setConfigs((prev) => ({
      ...prev,
      [hotelId]: prev[hotelId].map((c) => (c.id === configId ? { ...c, ...updates } : c)),
    }))
  }, [])

  const [blinkConfigId, setBlinkConfigId] = useState(null)

  const addConfig = useCallback(
    (hotelId) => {
      const d = details.find((d) => d.id === hotelId)
      setConfigs((prev) => {
        const existing = prev[hotelId] || []
        const usedIndices = new Set(existing.map((c) => c.roomTypeIndex))
        const totalRoomTypes = d?.rooms?.length || 1
        let nextIdx = 0
        for (let i = 0; i < totalRoomTypes; i++) {
          if (!usedIndices.has(i)) { nextIdx = i; break }
          if (i === totalRoomTypes - 1) nextIdx = 0
        }
        const newId = _nextId++
        setBlinkConfigId(newId)
        setTimeout(() => setBlinkConfigId(null), 1500)
        return {
          ...prev,
          [hotelId]: [
            ...existing,
            {
              id: newId,
              roomTypeIndex: nextIdx,
              checkIn: '2026-02-17',
              checkOut: '2026-02-19',
              adults: 1,
              children: 0,
              childAges: [],
              board: d?.rooms?.[nextIdx]?.boardOptions?.[0] || 'Room Only',
              cancellation: 'moderate',
              quantity: 1,
              editing: true,
            },
          ],
        }
      })
    },
    [details],
  )

  const removeConfig = useCallback((hotelId, configId) => {
    setConfigs((prev) => ({
      ...prev,
      [hotelId]: prev[hotelId].filter((c) => c.id !== configId),
    }))
  }, [])

  const duplicateConfig = useCallback((hotelId, configId) => {
    setConfigs((prev) => {
      const src = prev[hotelId].find((c) => c.id === configId)
      if (!src) return prev
      return { ...prev, [hotelId]: [...prev[hotelId], { ...src, id: _nextId++, editing: false }] }
    })
  }, [])

  const toggleEditing = useCallback((hotelId, configId) => {
    setConfigs((prev) => ({
      ...prev,
      [hotelId]: prev[hotelId].map((c) => (c.id === configId ? { ...c, editing: !c.editing } : c)),
    }))
  }, [])

  /* ── Computed totals ── */
  const hotelTotals = useMemo(() => {
    return details.map((d) => {
      const cfgs = configs[d.id] || []
      const totalRooms = cfgs.reduce((s, c) => s + c.quantity, 0)
      const totalAdults = cfgs.reduce((s, c) => s + c.adults * c.quantity, 0)
      const totalChildren = cfgs.reduce((s, c) => s + c.children * c.quantity, 0)
      const roomBase = cfgs.reduce((s, c) => s + getBaseTotal(d.id, c), 0)
      const boardSurcharge = cfgs.reduce((s, c) => s + getBoardTotal(d.id, c), 0)
      const cancelSurcharge = cfgs.reduce((s, c) => s + getCancelTotal(d.id, c), 0)
      const roomNights = cfgs.reduce((s, c) => s + c.quantity * getNights(c.checkIn, c.checkOut), 0)
      return {
        hotelId: d.id,
        name: d.name,
        stars: d.stars,
        totalRooms,
        totalAdults,
        totalChildren,
        totalGuests: totalAdults + totalChildren,
        roomBase,
        boardSurcharge,
        cancelSurcharge,
        subtotal: roomBase + boardSurcharge + cancelSurcharge,
        roomNights,
        cfgs,
      }
    })
  }, [details, configs])

  const grand = useMemo(() => {
    const g = {
      hotels: details.length,
      rooms: hotelTotals.reduce((s, t) => s + t.totalRooms, 0),
      roomTypes: hotelTotals.reduce((s, t) => s + t.cfgs.length, 0),
      adults: hotelTotals.reduce((s, t) => s + t.totalAdults, 0),
      children: hotelTotals.reduce((s, t) => s + t.totalChildren, 0),
      roomNights: hotelTotals.reduce((s, t) => s + t.roomNights, 0),
      total: hotelTotals.reduce((s, t) => s + t.subtotal, 0),
    }
    g.guests = g.adults + g.children
    return g
  }, [hotelTotals, details])

  // Date range across all configs
  const dateRange = useMemo(() => {
    let minIn = null
    let maxOut = null
    Object.values(configs)
      .flat()
      .forEach((c) => {
        const ci = new Date(c.checkIn)
        const co = new Date(c.checkOut)
        if (!minIn || ci < minIn) minIn = ci
        if (!maxOut || co > maxOut) maxOut = co
      })
    const fmt = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '–')
    const fmtY = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
    return { label: `${fmt(minIn)} → ${fmtY(maxOut)}`, checkIn: fmtY(minIn), checkOut: fmtY(maxOut) }
  }, [configs])

  const handleRemoveHotel = (hotelId) => {
    if (!onRemoveHotel || removingHotelId) return
    setRemovingHotelId(hotelId)
    setTimeout(() => {
      onRemoveHotel(hotelId)
      setRemovingHotelId(null)
    }, 400)
  }

  // "Change one hotel" — ask user to click on a hotel to replace
  const handleChangeOneHotel = useCallback(() => {
    setAwaitingReplaceClick(true)
    setAiMessage('Click on the hotel you would like to replace.')
  }, [])

  // Actually replace a hotel (called when user clicks a hotel column in replace mode)
  const executeReplaceHotel = useCallback((targetHotelId) => {
    if (!onReplaceHotel) return
    const currentIds = new Set(hotels.map((h) => h.id))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id))
      .map((h) => {
        const detail = getHotelDetail(h)
        const cheapest = detail.rooms?.length ? Math.min(...detail.rooms.map((r) => r.price)) : h.price
        return { hotel: h, score: (h.rating * h.stars) / cheapest }
      })
      .sort((a, b) => b.score - a.score)

    if (!candidates.length) return
    const replacement = candidates[0].hotel

    onReplaceHotel(targetHotelId, replacement)

    const d = getHotelDetail(replacement)
    const cheapestIdx = d.rooms?.length
      ? d.rooms.reduce((best, r, i) => (r.price < d.rooms[best].price ? i : best), 0) : 0
    setConfigs((prev) => {
      const next = { ...prev }
      delete next[targetHotelId]
      next[replacement.id] = [{
        id: _nextId++,
        roomTypeIndex: cheapestIdx,
        checkIn: defaultCheckIn,
        checkOut: defaultCheckOut,
        adults: 1,
        children: 0,
        childAges: [],
        board: d.rooms[cheapestIdx]?.boardOptions?.[0] || 'Room Only',
        cancellation: 'moderate',
        quantity: initialQuantity,
        editing: false,
      }]
      return next
    })

    setFlashHotelIds(new Set([replacement.id]))
    setTimeout(() => setFlashHotelIds(new Set()), 1200)

    // Reset AI state
    setAwaitingReplaceClick(false)
    setAiMessage(null)
    setAiCollapsed(false)
  }, [hotels, onReplaceHotel, initialQuantity, defaultCheckIn, defaultCheckOut])

  // Helper: replace all compared hotels with new set + reset configs + flash all
  const replaceAll = useCallback((newHotels) => {
    if (!onReplaceAllHotels) return
    onReplaceAllHotels(newHotels)
    const newConfigs = {}
    newHotels.forEach((h) => {
      const d = getHotelDetail(h)
      const cheapestIdx = d.rooms?.length
        ? d.rooms.reduce((best, r, i) => (r.price < d.rooms[best].price ? i : best), 0) : 0
      newConfigs[h.id] = [{
        id: _nextId++,
        roomTypeIndex: cheapestIdx,
        checkIn: '2026-02-17',
        checkOut: '2026-02-19',
        adults: 1,
        children: 0,
        childAges: [],
        board: d.rooms[cheapestIdx]?.boardOptions?.[0] || 'Room Only',
        cancellation: 'moderate',
        quantity: initialQuantity,
        editing: false,
      }]
    })
    setConfigs(newConfigs)
    // Flash all new hotel columns
    setFlashHotelIds(new Set(newHotels.map((h) => h.id)))
    setTimeout(() => setFlashHotelIds(new Set()), 1200)
  }, [onReplaceAllHotels, initialQuantity])

  // "Find less expensive" — find 3 cheaper alternatives
  const handleFindLessExpensive = useCallback(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMaxPrice = Math.max(...hotels.map((h) => h.price))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id) && h.price < currentMaxPrice)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
    if (candidates.length < 3) return
    replaceAll(candidates)
  }, [hotels, replaceAll])

  // Check if less expensive alternatives exist (to conditionally show chip)
  const hasLessExpensive = useMemo(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMaxPrice = Math.max(...hotels.map((h) => h.price))
    return allHotelsData.filter((h) => !currentIds.has(h.id) && h.price < currentMaxPrice).length >= 3
  }, [hotels])

  // "Find something else" — find 3 different hotels (best rated not currently shown)
  const handleFindSomethingElse = useCallback(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3)
    if (candidates.length < 3) return
    replaceAll(candidates)
  }, [hotels, replaceAll])

  // "Increase distance" — find 3 hotels further from venue than current furthest
  const handleIncreaseDistance = useCallback(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMaxDist = Math.max(...hotels.map((h) => getDistanceKm(h.position, VENUE_POS)))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id) && getDistanceKm(h.position, VENUE_POS) > currentMaxDist)
      .sort((a, b) => getDistanceKm(a.position, VENUE_POS) - getDistanceKm(b.position, VENUE_POS))
      .slice(0, 3)
    if (candidates.length < 3) {
      // Fallback: just pick 3 furthest hotels not in current set
      const fallback = allHotelsData
        .filter((h) => !currentIds.has(h.id))
        .sort((a, b) => getDistanceKm(b.position, VENUE_POS) - getDistanceKm(a.position, VENUE_POS))
        .slice(0, 3)
      if (fallback.length >= 3) replaceAll(fallback)
      return
    }
    replaceAll(candidates)
  }, [hotels, replaceAll])

  // "Higher rating" — find 3 hotels with higher star rating than current lowest
  const handleHigherRating = useCallback(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMinStars = Math.min(...hotels.map((h) => h.stars))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id) && h.stars > currentMinStars)
      .sort((a, b) => b.stars - a.stars || b.rating - a.rating)
      .slice(0, 3)
    if (candidates.length < 3) return
    replaceAll(candidates)
  }, [hotels, replaceAll])

  // "Add breakfast" — change all room configs to Bed & Breakfast
  const handleAddBreakfast = useCallback(() => {
    setConfigs((prev) => {
      const next = {}
      for (const [hotelId, cfgs] of Object.entries(prev)) {
        next[hotelId] = cfgs.map((c) => {
          const room = getRoom(Number(hotelId), c.roomTypeIndex)
          if (room && room.boardOptions.includes('Bed & Breakfast')) {
            return { ...c, board: 'Bed & Breakfast' }
          }
          return c
        })
      }
      return next
    })
    setAiMessage('Done! All rooms have been updated to Bed & Breakfast. 🍳')
    setTimeout(() => setAiMessage(null), 3000)
  }, [])

  // "Decrease distance" — find 3 hotels closer to venue than current closest
  const handleDecreaseDistance = useCallback(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMinDist = Math.min(...hotels.map((h) => getDistanceKm(h.position, VENUE_POS)))
    const candidates = allHotelsData
      .filter((h) => !currentIds.has(h.id) && getDistanceKm(h.position, VENUE_POS) < currentMinDist)
      .sort((a, b) => getDistanceKm(a.position, VENUE_POS) - getDistanceKm(b.position, VENUE_POS))
      .slice(0, 3)
    if (candidates.length < 3) return
    replaceAll(candidates)
  }, [hotels, replaceAll])

  // Check if closer alternatives exist
  const hasDecreaseDistance = useMemo(() => {
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMinDist = Math.min(...hotels.map((h) => getDistanceKm(h.position, VENUE_POS)))
    return allHotelsData.filter((h) => !currentIds.has(h.id) && getDistanceKm(h.position, VENUE_POS) < currentMinDist).length >= 3
  }, [hotels])

  // Check if higher-rated alternatives exist (hide chip if all 3 are already 5-star)
  const hasHigherRating = useMemo(() => {
    const allFiveStar = hotels.every((h) => h.stars === 5)
    if (allFiveStar) return false
    const currentIds = new Set(hotels.map((h) => h.id))
    const currentMinStars = Math.min(...hotels.map((h) => h.stars))
    return allHotelsData.filter((h) => !currentIds.has(h.id) && h.stars > currentMinStars).length >= 3
  }, [hotels])

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  // Share link (simulated)
  const shareLink = useMemo(() => {
    const ids = hotels.map((h) => h.id).join('-')
    return `https://dsei2027.eventbooking.com/quote/${ids}/${Date.now().toString(36)}`
  }, [hotels])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
      showToast('Share link copied to clipboard', 'success', 2500)
    })
  }, [shareLink, showToast])

  const handleShareSend = useCallback(() => {
    if (!shareEmail.trim()) return
    setShareSent(true)
    showToast(`Quote sent to ${shareEmail}`, 'success', 3000)
    setTimeout(() => {
      setShowShare(false)
      setShareEmail('')
      setShareSent(false)
    }, 1500)
  }, [shareEmail, showToast])

  // Generate & download a print-friendly PDF quote
  const generatePDF = useCallback(async () => {
    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule.autoTable

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const accent = [245, 197, 24]
      let y = 15

      // ─── Load event logo ───
      let logoDataUrl = null
      try {
        const resp = await fetch('/dsei-logo.png')
        const blob = await resp.blob()
        logoDataUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
      } catch (_) { /* logo optional */ }

      // ─── Header bar ───
      doc.setFillColor(...accent)
      doc.rect(0, 0, pageW, 22, 'F')
      let textX = 14
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 6, 3, 26, 16)
        textX = 35
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(26, 26, 26)
      doc.text('DSEI 2027 - Hotel Booking Quote', textX, 14)
      y = 30

      // ─── Summary stats with date range ───
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      // Format date range as "DD Month Year - DD Month Year"
      const fmtFullDate = (d) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      let minIn = null, maxOut = null
      Object.values(configs).flat().forEach((c) => {
        const ci = new Date(c.checkIn), co = new Date(c.checkOut)
        if (!minIn || ci < minIn) minIn = ci
        if (!maxOut || co > maxOut) maxOut = co
      })
      const dateRangeStr = `${fmtFullDate(minIn)} - ${fmtFullDate(maxOut)}`
      const statsText = `${dateRangeStr}  |  ${grand.hotels} ${grand.hotels === 1 ? 'Hotel' : 'Hotels'}  |  ${grand.rooms} ${grand.rooms === 1 ? 'Room' : 'Rooms'}  |  ${grand.guests} ${grand.guests === 1 ? 'Guest' : 'Guests'}  |  ${grand.roomNights} Room-${grand.roomNights === 1 ? 'night' : 'nights'}`
      doc.text(statsText, 14, y)
      y += 8

      // ─── Per-hotel tables ───
      hotelTotals.forEach((ht) => {
        const detail = details.find((d) => d.id === ht.hotelId)
        if (!detail) return

        // Hotel name + stars
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(26, 26, 26)
        doc.text(`${ht.name}  (${ht.stars} star)`, 14, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(detail.address, 14, y)
        y += 5

        // Table rows
        const rows = ht.cfgs.map((cfg) => {
          const room = getRoom(ht.hotelId, cfg.roomTypeIndex)
          if (!room) return []
          const nights = getNights(cfg.checkIn, cfg.checkOut)
          const cancelOpt = CANCEL_OPTIONS.find((o) => o.value === cfg.cancellation)
          const total = getConfigTotal(ht.hotelId, cfg)
          const ratePerNight = room.price + (BOARD_SURCHARGES[cfg.board] || 0) + Math.round(room.price * (cancelOpt?.pct || 0))
          const guestsStr = `${cfg.adults} ${cfg.adults === 1 ? 'Adult' : 'Adults'}${cfg.children > 0 ? ` + ${cfg.children} ${cfg.children === 1 ? 'Child' : 'Children'}` : ''}`
          return [
            room.type,
            cfg.board,
            `${fmtDate(cfg.checkIn)} - ${fmtDate(cfg.checkOut)}`,
            String(nights),
            String(cfg.quantity),
            guestsStr,
            `GBP ${ratePerNight}`,
            cancelOpt?.label || '',
            `GBP ${total.toLocaleString()}`,
          ]
        })

        autoTable(doc, {
          startY: y,
          margin: { left: 14, right: 14 },
          head: [['Room Type', 'Board', 'Dates', 'Nights', 'Rooms', 'Guests', 'Rate/Night', 'Cancellation', 'Subtotal']],
          body: rows,
          foot: [[
            { content: `${ht.totalRooms} ${ht.totalRooms === 1 ? 'room' : 'rooms'} | ${ht.totalGuests} ${ht.totalGuests === 1 ? 'guest' : 'guests'} | ${ht.roomNights} room-${ht.roomNights === 1 ? 'night' : 'nights'}`, colSpan: 7, styles: { halign: 'left', fontStyle: 'italic', textColor: [100, 100, 100] } },
            { content: 'Hotel Subtotal', styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `GBP ${ht.subtotal.toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold' } },
          ]],
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2 },
          headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          columnStyles: {
            3: { halign: 'center' },
            4: { halign: 'center' },
            6: { halign: 'right' },
            8: { halign: 'right', fontStyle: 'bold' },
          },
        })

        y = (doc.lastAutoTable?.finalY ?? y + 30) + 10
      })

      // ─── Grand total bar ───
      doc.setFillColor(...accent)
      doc.roundedRect(14, y, pageW - 28, 14, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(26, 26, 26)
      doc.text(`Grand Total  (${grand.hotels} ${grand.hotels === 1 ? 'hotel' : 'hotels'} | ${grand.rooms} ${grand.rooms === 1 ? 'room' : 'rooms'} | ${grand.roomNights} room-${grand.roomNights === 1 ? 'night' : 'nights'})`, 20, y + 9)
      doc.text(`GBP ${grand.total.toLocaleString()}`, pageW - 20, y + 9, { align: 'right' })

      y += 22

      // ─── Footer ───
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} - DSEI 2027 Hotel Booking Widget`, 14, doc.internal.pageSize.getHeight() - 8)

      doc.save(`DSEI2027_Quote_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Please try again.')
    }
  }, [details, hotelTotals, grand, dateRange, configs])

  /* ── Render ── */
  if (pageLoading) {
    return (
      <div className="cmp-page">
        <div className="cmp-topbar">
          <div className="cmp-topbar-left">
            <button className="cmp-back-arrow" onClick={onBack} title="Back">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <h1 className="cmp-title">Hotels Compare</h1>
          </div>
          <div className="cmp-topbar-right">
            <div className="cmp-skeleton-block cmp-skeleton-btn" />
            <div className="cmp-skeleton-block cmp-skeleton-btn" />
            <div className="cmp-skeleton-block cmp-skeleton-btn-primary" />
          </div>
        </div>
        <div className="cmp-event-bar">
          <div className="cmp-skeleton-block cmp-skeleton-text-md" />
        </div>
        <div className="cmp-body">
          <div className="cmp-columns">
            {hotels.map((_, i) => (
              <div key={i} className="cmp-col" style={{ overflow: 'hidden' }}>
                <div className="cmp-skeleton-block cmp-skeleton-hero" />
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="cmp-skeleton-block cmp-skeleton-card" />
                  <div className="cmp-skeleton-block cmp-skeleton-card-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="cmp-footer">
          <div className="cmp-skeleton-block cmp-skeleton-text-lg" />
          <div className="cmp-skeleton-block cmp-skeleton-total" />
        </div>
      </div>
    )
  }

  return (
    <div className="cmp-page">
      {/* ─── Top bar ─── */}
      <div className="cmp-topbar">
        <div className="cmp-topbar-left">
          <button className="cmp-back-arrow" onClick={onBack} title="Back">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="cmp-title">Hotels Compare</h1>
          <span className="cmp-title-badge">
            You're comparing: {grand.hotels} {grand.hotels === 1 ? 'hotel' : 'hotels'} and {grand.roomTypes} room {grand.roomTypes === 1 ? 'type' : 'types'}
          </span>
          {aiCollapsed && (
            <button className="cmp-ai-collapsed-btn" onClick={() => setAiCollapsed(false)}>
              <span className="cmp-ai-collapsed-emoji">😊</span>
              <span className="cmp-ai-collapsed-text">{aiCollapsedPhrase}</span>
            </button>
          )}
        </div>
        <div className="cmp-topbar-right">
          <button className="cmp-btn-outline" onClick={generatePDF}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{marginRight: 6, verticalAlign: '-2px'}}>
              <path d="M2 12v2h12v-2M8 2v8M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Save quote PDF
          </button>
          <button className="cmp-btn-outline" onClick={() => { setShowShare(true); setShareCopied(false); setShareSent(false); setShareEmail('') }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{marginRight: 6, verticalAlign: '-2px'}}>
              <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="5.8" y1="7" x2="10.2" y2="4" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="5.8" y1="9" x2="10.2" y2="12" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Share quote
          </button>
        </div>
      </div>

      {/* ─── Event bar ─── */}
      <div className="cmp-event-bar">
        <div className="cmp-event-left">
          <span className="cmp-event-tag">DEFENCE & SECURITY</span>
          <span className="cmp-event-text">
            DSEI UK 2027 · Sep 7–10, 2027 · ExCeL London
          </span>
        </div>
        <div className="cmp-event-right">
          <span className="cmp-event-count">
            {grand.hotels} of {grand.hotels} hotels
          </span>
          {details.length < 3 && (
            <button className="cmp-add-hotel-btn" onClick={onBack}>
              + Add Hotel
            </button>
          )}
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="cmp-body" ref={bodyRef}>
        {/* ─── AI Assistant recommendation ─── */}
        {!aiCollapsed && (
          <div className="cmp-ai-bar">
            <div className="cmp-ai-avatar cmp-ai-avatar-clickable" onClick={() => { setAiCollapsedPhrase(AI_COLLAPSED_PHRASES[Math.floor(Math.random() * AI_COLLAPSED_PHRASES.length)]); setAiCollapsed(true) }} title="Collapse assistant">
              <span className="cmp-ai-emoji">😊</span>
            </div>
            <div className="cmp-ai-content">
              <p className="cmp-ai-message">{aiMessage || "OK! Here's my recommendation. Compare prices, remove hotels that you don't like, add other rooms. Please note that I suggested the cheapest options for each hotel, but you can change it if you'd like!"}</p>
              {!awaitingReplaceClick && (
                <div className="cmp-ai-chips">
                  <button className="cmp-ai-chip" onClick={handleChangeOneHotel}>Change one hotel</button>
                  {hasLessExpensive && <button className="cmp-ai-chip" onClick={handleFindLessExpensive}>Find less expensive</button>}
                  <button className="cmp-ai-chip" onClick={handleFindSomethingElse}>Find something else</button>
                  <button className="cmp-ai-chip" onClick={handleIncreaseDistance}>Increase distance</button>
                  <button className="cmp-ai-chip" onClick={handleDecreaseDistance}>Decrease distance</button>
                  {hasHigherRating && <button className="cmp-ai-chip" onClick={handleHigherRating}>Higher rating</button>}
                  <button className="cmp-ai-chip" onClick={handleAddBreakfast}>Add breakfast</button>
                </div>
              )}
              {awaitingReplaceClick && (
                <div className="cmp-ai-chips">
                  <button className="cmp-ai-chip" onClick={() => { setAwaitingReplaceClick(false); setAiMessage(null) }}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Hotel columns ─── */}
        <div className="cmp-columns">
          {details.map((detail, colIndex) => {
            const hotelCfgs = configs[detail.id] || []
            const ht = hotelTotals.find((t) => t.hotelId === detail.id)
            const tierLabels = ['Budget option', 'Mid-range option', 'Premium option']
            const tierLabel = tierLabels[colIndex] || tierLabels[tierLabels.length - 1]
            return (
              <div className={`cmp-col ${flashHotelIds.has(detail.id) ? 'cmp-col-flash' : ''} ${removingHotelId === detail.id ? 'cmp-col-removing' : ''} ${awaitingReplaceClick ? 'cmp-col-replace-target' : ''}`} key={detail.id} onClick={awaitingReplaceClick ? () => executeReplaceHotel(detail.id) : undefined} style={awaitingReplaceClick ? { cursor: 'pointer' } : undefined}>
                {/* Hero header */}
                <div
                  className="cmp-col-hero"
                  style={{ backgroundImage: `url(${detail.gallery?.[0] || detail.image})` }}
                >
                  <span className={`cmp-col-tier cmp-col-tier-${colIndex}`}>{tierLabel}</span>
                  <button className="cmp-col-remove" onClick={() => handleRemoveHotel(detail.id)} title="Remove hotel">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  </button>
                  <div className="cmp-col-hero-overlay">
                    <h3 className="cmp-col-name">{detail.name}</h3>
                    <div className="cmp-col-stars">
                      {[...Array(5)].map((_, i) => <span key={i} className={i < detail.stars ? 'star-filled' : 'star-empty'}>★</span>)}
                      <span className="cmp-col-rating-score">{detail.rating}</span>
                      <span className="cmp-col-rating-reviews">({detail.reviews?.toLocaleString()})</span>
                    </div>
                    <span className="cmp-col-meta">{detail.address}</span>
                    <span className="cmp-col-dist">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="6" r="1.5" fill="currentColor" /></svg>
                      {detail.dist < 1 ? `${Math.round(detail.dist * 1000)} m` : `${detail.dist.toFixed(1)} km`} from venue
                      <span className="cmp-col-dot">·</span>
                      {(() => { const t = formatTravelTime(detail.dist); return (<>
                        {t.icon === 'walk' ? (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="2.5" r="1.5" fill="currentColor"/><path d="M6.5 5.5L8 8l2 1.5M8 8v3.5l-1.5 3M8 11.5l2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="5" width="13" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none"/><circle cx="4.5" cy="12.5" r="1.3" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="11.5" cy="12.5" r="1.3" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M3 5V3.5a1 1 0 011-1h3l1.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                        )}
                        {t.text}
                      </>)})()}
                    </span>
                  </div>
                </div>

                {/* Room config cards */}
                <div className="cmp-configs">
                  {hotelCfgs.map((cfg) => {
                    const room = getRoom(detail.id, cfg.roomTypeIndex)
                    if (!room) return null
                    const nights = getNights(cfg.checkIn, cfg.checkOut)
                    const cancelOpt = CANCEL_OPTIONS.find((o) => o.value === cfg.cancellation)
                    const cancelPerNight = Math.round(room.price * (cancelOpt?.pct || 0))
                    const total = getConfigTotal(detail.id, cfg)

                    return (
                      <div key={cfg.id} className={`cmp-card ${cfg.editing ? 'cmp-card-editing' : ''}`}>
                        <div className="cmp-card-top">
                          <img src={room.image} alt={room.type} className="cmp-card-thumb cmp-card-thumb-clickable" onClick={() => setLightboxImg({ src: room.image, alt: room.type })} />
                          <span className="cmp-card-type">{room.type}</span>
                          {cfg.editing && <span className="cmp-card-editing-badge">EDITING</span>}
                          <div className="cmp-card-actions">
                            <button className={`cmp-action-btn ${cfg.editing ? 'cmp-action-btn-ok' : ''}`} title={cfg.editing ? "Done" : "Edit"} onClick={() => toggleEditing(detail.id, cfg.id)}>
                              {cfg.editing ? (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5L6 12L13.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
                              )}
                            </button>
                            <button className="cmp-action-btn" title="Duplicate" onClick={() => duplicateConfig(detail.id, cfg.id)}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M11 5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v6.5A1.5 1.5 0 003 11h2" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                            </button>
                            <button className="cmp-action-btn cmp-action-delete" title="Delete" onClick={() => removeConfig(detail.id, cfg.id)}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                            <span className="cmp-card-qty-badge">{cfg.quantity} {cfg.quantity === 1 ? 'room' : 'rooms'}</span>
                          </div>
                        </div>

                        {!cfg.editing && (
                          <div className="cmp-card-compact" onClick={() => toggleEditing(detail.id, cfg.id)}>
                            <div className="cmp-card-row"><span className="cmp-label">IN</span><span className="cmp-value">{new Date(cfg.checkIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="cmp-label">OUT</span><span className="cmp-value">{new Date(cfg.checkOut).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                            <div className="cmp-card-row"><span className="cmp-label">Guests</span><span className="cmp-value">{cfg.adults} {cfg.adults === 1 ? 'Adult' : 'Adults'}{cfg.children > 0 ? ` + ${cfg.children} ${cfg.children === 1 ? 'Child' : 'Children'}${cfg.childAges?.length ? ` (${cfg.childAges.map(a => a + 'y').join(', ')})` : ''}` : ''}</span><span className="cmp-label">BOARD</span><span className="cmp-value">{cfg.board}</span></div>
                            <div className="cmp-card-row"><span className="cmp-label">CANCELLATION</span><span className={`cmp-cancel-tag cmp-cancel-${cfg.cancellation}`}>{cancelOpt?.label}{cancelPerNight > 0 ? ` (+£${cancelPerNight})` : ''}</span></div>
                          </div>
                        )}

                        {cfg.editing && (
                          <div className="cmp-card-edit">
                            <div className="cmp-edit-row">
                              <div className="cmp-edit-field cmp-edit-field-full"><label className="cmp-edit-label">ROOM TYPE</label><select className={`cmp-edit-select${blinkConfigId === cfg.id ? ' cmp-edit-select-blink' : ''}`} value={cfg.roomTypeIndex} onChange={(e) => { const idx = Number(e.target.value); const nr = detail.rooms[idx]; const updates = { roomTypeIndex: idx }; if (nr && !nr.boardOptions.includes(cfg.board)) { updates.board = nr.boardOptions[0] } updateConfig(detail.id, cfg.id, updates) }}>{detail.rooms.map((r, i) => (<option key={i} value={i}>{r.type} — £{r.price}/night</option>))}</select></div>
                            </div>
                            <div className="cmp-edit-row">
                              <div className="cmp-edit-field"><label className="cmp-edit-label">CHECK-IN</label><input type="date" className="cmp-edit-input" value={cfg.checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { const val = e.target.value; if (val >= new Date().toISOString().slice(0, 10)) { updateConfig(detail.id, cfg.id, { checkIn: val }); if (val >= cfg.checkOut) updateConfig(detail.id, cfg.id, { checkIn: val, checkOut: '' }) } }} /></div>
                              <div className="cmp-edit-field"><label className="cmp-edit-label">CHECK-OUT</label><input type="date" className="cmp-edit-input" value={cfg.checkOut} min={cfg.checkIn || new Date().toISOString().slice(0, 10)} onChange={(e) => { const val = e.target.value; if (val > cfg.checkIn) updateConfig(detail.id, cfg.id, { checkOut: val }) }} /></div>
                            </div>
                            <div className="cmp-edit-row">
                              <div className="cmp-edit-field"><label className="cmp-edit-label">ADULTS</label><select className="cmp-edit-select" value={cfg.adults} onChange={(e) => updateConfig(detail.id, cfg.id, { adults: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n}</option>))}</select></div>
                              <div className="cmp-edit-field"><label className="cmp-edit-label">CHILDREN</label><select className="cmp-edit-select" value={cfg.children} onChange={(e) => { const count = Number(e.target.value); const ages = [...(cfg.childAges || [])]; while (ages.length < count) ages.push(5); updateConfig(detail.id, cfg.id, { children: count, childAges: ages.slice(0, count) }) }}>{[0, 1, 2, 3].map((n) => (<option key={n} value={n}>{n}</option>))}</select></div>
                            </div>
                            {cfg.children > 0 && (
                              <div className="cmp-edit-row cmp-edit-child-ages">
                                {(cfg.childAges || []).map((age, ci) => (
                                  <div key={ci} className="cmp-edit-field cmp-edit-field-age">
                                    <label className="cmp-edit-label">Child {ci + 1} age</label>
                                    <select className="cmp-edit-select" value={age} onChange={(e) => { const newAges = [...(cfg.childAges || [])]; newAges[ci] = Number(e.target.value); updateConfig(detail.id, cfg.id, { childAges: newAges }) }}>
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map((a) => (<option key={a} value={a}>{a} yr{a > 1 ? 's' : ''}</option>))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="cmp-edit-row">
                              <div className="cmp-edit-field"><label className="cmp-edit-label">BOARD TYPE</label><select className="cmp-edit-select" value={cfg.board} onChange={(e) => updateConfig(detail.id, cfg.id, { board: e.target.value })}>{room.boardOptions.map((b) => (<option key={b} value={b}>{b}{BOARD_SURCHARGES[b] > 0 ? ` (+£${BOARD_SURCHARGES[b]}/n)` : ''}</option>))}</select></div>
                              <div className="cmp-edit-field"><label className="cmp-edit-label">CANCELLATION</label><select className="cmp-edit-select" value={cfg.cancellation} onChange={(e) => updateConfig(detail.id, cfg.id, { cancellation: e.target.value })}>{CANCEL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}{o.pct > 0 ? ` (+${Math.round(o.pct * 100)}%)` : ''}</option>))}</select></div>
                            </div>
                          </div>
                        )}

                        <div className="cmp-card-qty-row">
                          <span className="cmp-label">Qty</span>
                          <div className="cmp-qty-stepper">
                            <button className="cmp-qty-btn" onClick={() => updateConfig(detail.id, cfg.id, { quantity: Math.max(1, cfg.quantity - 1) })}>−</button>
                            <span className="cmp-qty-val">{cfg.quantity}</span>
                            <button className="cmp-qty-btn" onClick={() => updateConfig(detail.id, cfg.id, { quantity: Math.min(50, cfg.quantity + 1) })}>+</button>
                          </div>
                        </div>

                        <div className="cmp-card-price">
                          <span className="cmp-price-calc">£{room.price}/night × {nights} {nights === 1 ? 'night' : 'nights'} × {cfg.quantity} {cfg.quantity === 1 ? 'room' : 'rooms'}</span>
                          <span className="cmp-price-total"><span className="cmp-price-label">Rooms total: </span>£{total.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })}
                  <button className="cmp-add-config" onClick={() => addConfig(detail.id)}>+ Add other rooms</button>
                </div>

                {ht && (
                  <div className="cmp-col-subtotal">
                    <div className="cmp-col-subtotal-top">
                      <span className="cmp-col-subtotal-name">{detail.name}</span>
                      <span className="cmp-col-subtotal-meta">{ht.totalRooms} {ht.totalRooms === 1 ? 'room' : 'rooms'} · {ht.totalGuests} {ht.totalGuests === 1 ? 'guest' : 'guests'}</span>
                    </div>
                    <div className="cmp-col-subtotal-tags">
                      {hotelCfgs.map((cfg) => { const r = getRoom(detail.id, cfg.roomTypeIndex); return r ? (<span key={cfg.id} className="cmp-col-subtotal-tag">{cfg.quantity}× {r.type}</span>) : null })}
                    </div>
                    <div className="cmp-col-subtotal-amount"><span className="cmp-col-subtotal-label">Hotel total: </span>£{ht.subtotal.toLocaleString()}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Bottom summary cards ─── */}
        <div className="cmp-summary">
          <div className="cmp-summary-cards">
            {hotelTotals.map((t) => (
              <div className="cmp-summary-card" key={t.hotelId}>
                <h3 className="cmp-summary-card-title">Cost Breakdown</h3>
                <div className="cmp-summary-card-header">🏨 {t.name} ({t.totalRooms} {t.totalRooms === 1 ? 'room' : 'rooms'})</div>
                <div className="cmp-summary-line"><span>Room base ({t.roomNights} room-nights)</span><span>£{t.roomBase.toLocaleString()}</span></div>
                <div className="cmp-summary-line"><span>Board surcharges</span><span>£{t.boardSurcharge.toLocaleString()}</span></div>
                <div className="cmp-summary-line"><span>Cancellation policies</span><span>£{t.cancelSurcharge.toLocaleString()}</span></div>
                <div className="cmp-summary-line cmp-summary-line-total"><span>Hotel total</span><span>£{t.subtotal.toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Price increase urgency notice ─── */}
        <div className="cmp-urgency-banner">
          <div className="cmp-urgency-icon">📈</div>
          <div className="cmp-urgency-content">
            <span className="cmp-urgency-title">Price increase likely</span>
            <span className="cmp-urgency-text">
              Based on demand trends, prices for these hotels are expected to increase by {Math.round(hotels.reduce((sum, h) => sum + getPriceIncrease(h.id), 0) / hotels.length)}% in the next 48 hours. DSEI 2027 is in {getDaysUntilEvent()} days — book now to lock in current rates.
            </span>
          </div>
          <div className="cmp-urgency-hotels">
            {hotels.map((h) => (
              <span key={h.id} className="cmp-urgency-hotel-tag">
                {h.name.length > 20 ? h.name.slice(0, 20) + '…' : h.name}: +{getPriceIncrease(h.id)}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Back to top button ─── */}
      {showBackToTop && (
        <button className="cmp-back-to-top" onClick={scrollToTop} title="Back to top">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 16V4M10 4L5 9M10 4L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* ─── Grand total footer ─── */}
      <div className="cmp-footer">
        <div className="cmp-footer-stats">
          <div className="cmp-footer-stat"><span className="cmp-footer-stat-label">DATE RANGE</span><span className="cmp-footer-stat-value">{dateRange.label}</span></div>
          <div className="cmp-footer-stat"><span className="cmp-footer-stat-label">HOTELS</span><span className="cmp-footer-stat-value">{grand.hotels}</span></div>
          <div className="cmp-footer-stat"><span className="cmp-footer-stat-label">ROOMS</span><span className="cmp-footer-stat-value">{grand.rooms}</span></div>
          <div className="cmp-footer-stat"><span className="cmp-footer-stat-label">GUESTS</span><span className="cmp-footer-stat-value">{grand.adults} {grand.adults === 1 ? 'Adult' : 'Adults'}{grand.children > 0 ? ` + ${grand.children} ${grand.children === 1 ? 'Child' : 'Children'}` : ''}</span></div>
          <div className="cmp-footer-stat"><span className="cmp-footer-stat-label">ROOM-NIGHTS</span><span className="cmp-footer-stat-value">{grand.roomNights}</span></div>
        </div>
        <div className="cmp-footer-grand">
          <div className="cmp-footer-grand-amount"><span className="cmp-footer-grand-prefix">Grand total </span>£{grand.total.toLocaleString()} <small>GBP</small></div>
        </div>
        <button className="cmp-footer-cta" onClick={() => setShowSummary(true)}>{grand.rooms <= 10 ? 'Book rooms →' : 'Request quote →'}</button>
      </div>

      {/* ═══ QUOTE SUMMARY MODAL ═══ */}
      {showSummary && (
        <div className="qs-overlay" onClick={() => setShowSummary(false)}>
          <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qs-header">
              <div className="qs-header-left">
                <h2 className="qs-header-title">{grand.rooms <= 10 ? 'Booking summary' : 'Quote summary'}</h2>
                <span className="qs-header-event">DSEI UK 2027 · ExCeL London</span>
              </div>
              <div className="qs-header-right">
                <button className="qs-close" onClick={() => setShowSummary(false)}>×</button>
              </div>
            </div>

            <div className="qs-stats-row">
              <div className="qs-stat"><span className="qs-stat-num">{grand.hotels}</span><span className="qs-stat-label">Hotels</span></div>
              <div className="qs-stat"><span className="qs-stat-num">{grand.rooms}</span><span className="qs-stat-label">Rooms</span></div>
              <div className="qs-stat"><span className="qs-stat-num">{grand.guests}</span><span className="qs-stat-label">Guests</span></div>
              <div className="qs-stat"><span className="qs-stat-num">{grand.roomNights}</span><span className="qs-stat-label">Room-nights</span></div>
              <div className="qs-stat"><span className="qs-stat-num">{dateRange.checkIn}</span><span className="qs-stat-label">First check-in</span></div>
              <div className="qs-stat"><span className="qs-stat-num">{dateRange.checkOut}</span><span className="qs-stat-label">Last check-out</span></div>
            </div>

            <div className="qs-body">
              {hotelTotals.map((ht) => {
                const detail = details.find((d) => d.id === ht.hotelId)
                if (!detail) return null
                return (
                  <div className="qs-hotel-section" key={ht.hotelId}>
                    <div className="qs-hotel-header">
                      <div className="qs-hotel-name-row">
                        <h3 className="qs-hotel-name">{ht.name}</h3>
                        <span className="qs-hotel-stars">{[...Array(5)].map((_, i) => <span key={i} className={i < ht.stars ? 'star-filled' : 'star-empty'}>★</span>)}</span>
                      </div>
                      <span className="qs-hotel-meta">{detail.address}</span>
                    </div>

                    <table className="qs-table">
                      <thead>
                        <tr>
                          <th>Room Type</th>
                          <th>Board</th>
                          <th>Dates</th>
                          <th>Nights</th>
                          <th>Rooms</th>
                          <th>Rate/Night</th>
                          <th>Cancellation</th>
                          <th className="qs-th-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ht.cfgs.map((cfg) => {
                          const room = getRoom(ht.hotelId, cfg.roomTypeIndex)
                          if (!room) return null
                          const nights = getNights(cfg.checkIn, cfg.checkOut)
                          const cancelOpt = CANCEL_OPTIONS.find((o) => o.value === cfg.cancellation)
                          const total = getConfigTotal(ht.hotelId, cfg)
                          const ratePerNight = room.price + (BOARD_SURCHARGES[cfg.board] || 0) + Math.round(room.price * (cancelOpt?.pct || 0))
                          return (
                            <tr key={cfg.id}>
                              <td className="qs-td-type">{room.type}</td>
                              <td>{cfg.board}</td>
                              <td className="qs-td-dates">{fmtDate(cfg.checkIn)} – {fmtDate(cfg.checkOut)}</td>
                              <td className="qs-td-center">{nights}</td>
                              <td className="qs-td-center">{cfg.quantity}</td>
                              <td>£{ratePerNight}</td>
                              <td><span className={`qs-cancel-badge qs-cancel-${cfg.cancellation}`}>{cancelOpt?.label}</span></td>
                              <td className="qs-td-right qs-td-amount">£{total.toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="qs-tfoot-row">
                          <td colSpan="5" className="qs-tfoot-label">{ht.totalRooms} {ht.totalRooms === 1 ? 'room' : 'rooms'} · {ht.totalGuests} {ht.totalGuests === 1 ? 'guest' : 'guests'} · {ht.roomNights} room-{ht.roomNights === 1 ? 'night' : 'nights'}</td>
                          <td colSpan="2" className="qs-tfoot-subtotal-label">Hotel Subtotal</td>
                          <td className="qs-td-right qs-tfoot-amount">£{ht.subtotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })}
            </div>

            <div className="qs-grand">
              <div className="qs-grand-left">
                <span className="qs-grand-label">Grand Total</span>
                <span className="qs-grand-sub">{grand.hotels} {grand.hotels === 1 ? 'hotel' : 'hotels'} · {grand.rooms} {grand.rooms === 1 ? 'room' : 'rooms'} · {grand.roomNights} room-{grand.roomNights === 1 ? 'night' : 'nights'}</span>
              </div>
              <div className="qs-grand-amount">£{grand.total.toLocaleString()} <small>GBP</small></div>
            </div>

            <div className="qs-actions">
              <button className="qs-btn-outline" onClick={generatePDF}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 14h8M8 2v9M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Save quote PDF
              </button>
              <button className="qs-btn-outline" onClick={() => { setShowSummary(false); setTimeout(() => { setShowShare(true); setShareCopied(false); setShareSent(false); setShareEmail('') }, 100) }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="5.8" y1="7" x2="10.2" y2="4" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="5.8" y1="9" x2="10.2" y2="12" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Share quote
              </button>
              <button className="qs-btn-primary" onClick={() => setShowConfirm(true)}>{grand.rooms <= 10 ? 'Book rooms →' : 'Request quote →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHARE QUOTE MODAL ═══ */}
      {showShare && (
        <div className="cmp-share-overlay" onClick={() => setShowShare(false)}>
          <div className="cmp-share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmp-share-header">
              <h3 className="cmp-share-title">Share Quote</h3>
              <button className="cmp-share-close" onClick={() => setShowShare(false)}>×</button>
            </div>

            <div className="cmp-share-body">
              <label className="cmp-share-label">Link to this offer</label>
              <div className="cmp-share-link-row">
                <input
                  type="text"
                  className="cmp-share-link-input"
                  value={shareLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
                <button className="cmp-share-copy-btn" onClick={handleCopyLink}>
                  {shareCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <label className="cmp-share-label" style={{ marginTop: 18 }}>Send via e-mail</label>
              <input
                type="email"
                className="cmp-share-email-input"
                placeholder="Enter recipient e-mail address"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShareSend()}
              />
            </div>

            <div className="cmp-share-actions">
              <button className="cmp-share-cancel" onClick={() => setShowShare(false)}>Cancel</button>
              <button
                className="cmp-share-send"
                onClick={handleShareSend}
                disabled={!shareEmail.trim() || shareSent}
              >
                {shareSent ? 'Sent!' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PHOTO LIGHTBOX ═══ */}
      {lightboxImg && (
        <div className="cmp-lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <button className="cmp-lightbox-close" onClick={() => setLightboxImg(null)}>×</button>
          <img src={lightboxImg.src} alt={lightboxImg.alt} className="cmp-lightbox-img" onClick={(e) => e.stopPropagation()} />
          <span className="cmp-lightbox-caption">{lightboxImg.alt}</span>
        </div>
      )}

      {/* ═══ CONFIRMATION / QUOTE REQUEST POPUP ═══ */}
      {showConfirm && grand.rooms > 10 && (
        <div className="cmp-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="cmp-confirm-box" onClick={(e) => e.stopPropagation()}>
            <p className="cmp-confirm-text">
              You are about to request a quote for <strong>{grand.hotels} {grand.hotels === 1 ? 'hotel' : 'hotels'}</strong> and <strong>{grand.rooms} {grand.rooms === 1 ? 'room' : 'rooms'}</strong>.
            </p>
            <div className="cmp-confirm-actions">
              <button className="cmp-confirm-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="cmp-confirm-ok" onClick={() => setShowConfirm(false)}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BOOK ROOMS FORM (≤10 rooms) ═══ */}
      {showConfirm && grand.rooms <= 10 && !showBooking && (
        <div className="cmp-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="cmp-confirm-box" onClick={(e) => e.stopPropagation()}>
            <p className="cmp-confirm-text">
              You are about to book <strong>{grand.hotels} {grand.hotels === 1 ? 'hotel' : 'hotels'}</strong> and <strong>{grand.rooms} {grand.rooms === 1 ? 'room' : 'rooms'}</strong> for <strong>£{grand.total.toLocaleString()}</strong>.
            </p>
            <div className="cmp-confirm-actions">
              <button className="cmp-confirm-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="cmp-confirm-ok" onClick={() => setShowBooking(true)}>Proceed to payment</button>
            </div>
          </div>
        </div>
      )}

      {showBooking && (
        <div className="cmp-confirm-overlay" onClick={() => { setShowBooking(false); setShowConfirm(false) }}>
          <div className="cmp-booking-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="cmp-booking-title">Complete your booking</h3>
            <p className="cmp-booking-sub">Total: <strong>£{grand.total.toLocaleString()} GBP</strong> · {grand.rooms} {grand.rooms === 1 ? 'room' : 'rooms'} · {grand.hotels} {grand.hotels === 1 ? 'hotel' : 'hotels'}</p>

            <div className="cmp-booking-form">
              <div className="cmp-booking-row">
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">First name *</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.firstName} onChange={(e) => setBookingForm(p => ({ ...p, firstName: e.target.value }))} placeholder="John" />
                </div>
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">Last name *</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.lastName} onChange={(e) => setBookingForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" />
                </div>
              </div>

              <div className="cmp-booking-row">
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">E-mail address *</label>
                  <input type="email" className="cmp-booking-input" value={bookingForm.email} onChange={(e) => setBookingForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
                </div>
              </div>

              <div className="cmp-booking-row">
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">Company</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.company} onChange={(e) => setBookingForm(p => ({ ...p, company: e.target.value }))} placeholder="Optional" />
                </div>
                {bookingForm.company.trim() && (
                  <div className="cmp-booking-field">
                    <label className="cmp-booking-label">VAT number</label>
                    <input type="text" className="cmp-booking-input" value={bookingForm.vat} onChange={(e) => setBookingForm(p => ({ ...p, vat: e.target.value }))} placeholder="GB123456789" />
                  </div>
                )}
              </div>

              <div className="cmp-booking-divider" />

              <div className="cmp-booking-row">
                <div className="cmp-booking-field cmp-booking-field-wide">
                  <label className="cmp-booking-label">Credit card number *</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.cardNumber} onChange={(e) => setBookingForm(p => ({ ...p, cardNumber: e.target.value }))} placeholder="4242 4242 4242 4242" maxLength={19} />
                </div>
              </div>

              <div className="cmp-booking-row">
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">Expiration MM/YY *</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.expiry} onChange={(e) => setBookingForm(p => ({ ...p, expiry: e.target.value }))} placeholder="09/27" maxLength={5} />
                </div>
                <div className="cmp-booking-field">
                  <label className="cmp-booking-label">CVV *</label>
                  <input type="text" className="cmp-booking-input" value={bookingForm.cvv} onChange={(e) => setBookingForm(p => ({ ...p, cvv: e.target.value }))} placeholder="123" maxLength={4} />
                </div>
              </div>
            </div>

            <div className="cmp-booking-actions">
              <button className="cmp-booking-pay" onClick={() => { setShowBooking(false); setShowConfirm(false); setShowSummary(false); if (onBack) onBack() }}>Pay later</button>
              <button className="cmp-booking-pay cmp-booking-pay-now" onClick={() => { setShowBooking(false); setShowConfirm(false); setShowSummary(false); if (onBack) onBack() }}>Pay now — £{grand.total.toLocaleString()}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompareHotels
