import { useState, useRef, useEffect } from 'react'
import './AiChat.css'

const initialOptions = [
  "Single room",
  "Double room",
  "Family/Friends",
  "Group",
]

const groupFollowUpOptions = [
  "Flexible cancellation",
  "Closest to the Venue",
  "Budget option",
  "Good price to value",
  "Recommend me something",
]

const AI_COLLAPSED_PHRASES = [
  "OK, I'm here if you need me.",
  "I'm here to help you.",
  "Need a hand?",
  "Unsure where to begin?",
]

const AiChat = ({ activeView, onGroupCompare, triggerGroup, onBudgetFilter, onClearFilters }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  const [collapsedPhrase, setCollapsedPhrase] = useState(AI_COLLAPSED_PHRASES[0])
  const [chatStep, setChatStep] = useState('initial') // 'initial' | 'askBudget' | 'askGroupSize' | 'groupFollowUp' | 'done'
  const [selectedOption, setSelectedOption] = useState(null)
  const [groupSizeInput, setGroupSizeInput] = useState('')
  const [groupFollowUpSelected, setGroupFollowUpSelected] = useState(null)
  const [submittedGroupSize, setSubmittedGroupSize] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [submittedBudget, setSubmittedBudget] = useState(null)
  const [isEditingBubble, setIsEditingBubble] = useState(false)
  const [bubbleInput, setBubbleInput] = useState('')
  const [customChips, setCustomChips] = useState([])
  const inputRef = useRef(null)
  const budgetInputRef = useRef(null)
  const bubbleInputRef = useRef(null)

  // Auto-open after 1 second on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true)
      setHasAutoOpened(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Focus input when group size question appears
  useEffect(() => {
    if (chatStep === 'askGroupSize' && inputRef.current) {
      inputRef.current.focus()
    }
    if (chatStep === 'askBudget' && budgetInputRef.current) {
      budgetInputRef.current.focus()
    }
  }, [chatStep])

  // Focus bubble input when entering edit mode
  useEffect(() => {
    if (isEditingBubble && bubbleInputRef.current) {
      bubbleInputRef.current.focus()
    }
  }, [isEditingBubble])

  // External trigger — PAX "Group booking" button was clicked
  useEffect(() => {
    if (triggerGroup) {
      setIsOpen(true)
      setHasAutoOpened(true)
      setSelectedOption('Group')
      setChatStep('askGroupSize')
      setIsEditingBubble(false)
    }
  }, [triggerGroup])

  const viewClass = activeView === 'both' ? 'ai-chat-view-both' : 'ai-chat-view-other'

  const handleOptionClick = (option) => {
    setSelectedOption(option)

    if (option === 'Single room' || option === 'Double room') {
      setChatStep('askBudget')
    } else if (option === 'Family/Friends' || option === 'Group') {
      setChatStep('askGroupSize')
    }
  }

  const handleGroupSizeSubmit = () => {
    if (!groupSizeInput.trim()) return
    const size = groupSizeInput.trim()
    setSubmittedGroupSize(size)

    if (selectedOption === 'Group') {
      setChatStep('groupFollowUp')
    } else {
      // Family/Friends — allocate 2 people per room
      const numPeople = parseInt(size, 10) || 1
      const numRooms = Math.ceil(numPeople / 2)
      setChatStep('done')
      if (onGroupCompare) {
        setTimeout(() => {
          onGroupCompare('Recommend me something', numRooms, 2)
        }, 1500)
      }
    }
    setGroupSizeInput('')
  }

  const handleGroupSizeKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGroupSizeSubmit()
    }
  }

  const handleBudgetSubmit = () => {
    const val = budgetInput.trim().replace(/[^0-9]/g, '')
    if (!val) return
    const maxPrice = Number(val)
    setSubmittedBudget(maxPrice)
    setChatStep('done')
    setBudgetInput('')
    if (onBudgetFilter) {
      onBudgetFilter(maxPrice)
    }
  }

  const handleIncreaseBudget = () => {
    if (!submittedBudget || !onBudgetFilter) return
    const newBudget = Math.round(submittedBudget * 1.10)
    setSubmittedBudget(newBudget)
    onBudgetFilter(newBudget)
  }

  const handleClearFilters = () => {
    // Reset AI assistant to initial state
    setChatStep('initial')
    setSelectedOption(null)
    setSubmittedBudget(null)
    setBudgetInput('')
    setGroupSizeInput('')
    setSubmittedGroupSize(null)
    setGroupFollowUpSelected(null)
    setCustomChips([])
    setIsEditingBubble(false)
    setBubbleInput('')
    if (onClearFilters) {
      onClearFilters()
    }
  }

  const handleBudgetKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBudgetSubmit()
    }
  }

  const handleGroupFollowUp = (option) => {
    setGroupFollowUpSelected(option)
    setChatStep('done')

    // Trigger compare view with 3 best hotels after a short delay for the message to show
    if (onGroupCompare && submittedGroupSize) {
      setTimeout(() => {
        onGroupCompare(option, submittedGroupSize)
      }, 1500)
    }
  }

  // Bubble edit handlers
  const handleBubbleClick = () => {
    if (chatStep === 'initial' && !isEditingBubble) {
      setIsEditingBubble(true)
      setBubbleInput('')
    }
  }

  const handleBubbleSearchSubmit = () => {
    const val = bubbleInput.trim()
    if (!val) return
    if (!customChips.includes(val)) {
      setCustomChips((prev) => [...prev, val])
    }
    setBubbleInput('')
    setIsEditingBubble(false)
  }

  const handleBubbleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBubbleSearchSubmit()
    } else if (e.key === 'Escape') {
      setIsEditingBubble(false)
      setBubbleInput('')
    }
  }

  const removeCustomChip = (chip) => {
    setCustomChips((prev) => prev.filter((c) => c !== chip))
  }

  // Build the current message text
  const getMessage = () => {
    if (chatStep === 'initial') {
      return 'Hi there! What are you looking for?'
    }
    if (chatStep === 'askBudget') {
      return 'OK, let me find the best options for you. What\'s your budget?'
    }
    if (chatStep === 'askGroupSize') {
      if (selectedOption === 'Group') {
        return 'Great choice! How many rooms will your group need?'
      }
      return 'Great choice! How many people will be in your party?'
    }
    if (chatStep === 'groupFollowUp') {
      return `Got it, ${submittedGroupSize} rooms! What matters most to you?`
    }
    if (chatStep === 'done') {
      if (selectedOption === 'Group' && groupFollowUpSelected) {
        return `Perfect! I'll find the best ${groupFollowUpSelected.toLowerCase()} options for ${submittedGroupSize} rooms. 🔍`
      }
      if (selectedOption === 'Family/Friends') {
        return `Lovely! I'll find the best options for your party of ${submittedGroupSize}. 🔍`
      }
      if (selectedOption === 'Single room' || selectedOption === 'Double room') {
        return `Here are the best ${selectedOption.toLowerCase()} options within your budget. 🔍`
      }
      return 'Great choice! Let me find the best options for you. 🔍'
    }
    return ''
  }

  // Build the current set of quick-chip options
  const getCurrentOptions = () => {
    if (chatStep === 'initial') return initialOptions
    if (chatStep === 'groupFollowUp') return groupFollowUpOptions
    return []
  }

  const currentOptions = getCurrentOptions()

  const getSelectedForStep = () => {
    if (chatStep === 'initial') return selectedOption
    if (chatStep === 'groupFollowUp') return groupFollowUpSelected
    return null
  }

  return (
    <div className={`ai-chat ${viewClass} ${!isOpen && hasAutoOpened ? 'ai-chat-is-collapsed' : ''}`}>
      {/* Collapsed state — centered, 20px above carousel */}
      {!isOpen && hasAutoOpened && (
        <div className="ai-chat-collapsed-center" onClick={() => { setIsOpen(true); setHasAutoOpened(true) }}>
          <div className="ai-chat-collapsed-pill">
            <span className="ai-chat-collapsed-emoji">😊</span>
            <span className="ai-chat-collapsed-text">{collapsedPhrase}</span>
          </div>
        </div>
      )}

      <div className={`ai-chat-inner ${!isOpen && hasAutoOpened ? 'ai-chat-inner-hidden' : ''}`}>
        {/* Avatar — click to toggle */}
        <div className="ai-chat-avatar" onClick={() => { if (isOpen) { setCollapsedPhrase(AI_COLLAPSED_PHRASES[Math.floor(Math.random() * AI_COLLAPSED_PHRASES.length)]) } setIsOpen(!isOpen); setHasAutoOpened(true) }}>
          <span className="ai-chat-emoji">😊</span>
        </div>

        {/* Message + options — always rendered, visibility controlled by CSS */}
        <div className={`ai-chat-content ${isOpen ? 'ai-chat-content-open' : 'ai-chat-content-closed'} ${!hasAutoOpened && isOpen ? 'ai-chat-intro' : ''}`}>
          <div
            className={`ai-chat-bubble ${chatStep === 'initial' && !isEditingBubble ? 'ai-chat-bubble-editable' : ''}`}
            onClick={handleBubbleClick}
          >
            {isEditingBubble ? (
              <div className="ai-chat-bubble-edit">
                <input
                  ref={bubbleInputRef}
                  type="text"
                  className="ai-chat-bubble-input"
                  placeholder="Type what you're looking for..."
                  value={bubbleInput}
                  onChange={(e) => setBubbleInput(e.target.value)}
                  onKeyDown={handleBubbleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="ai-chat-bubble-search-btn"
                  onClick={(e) => { e.stopPropagation(); handleBubbleSearchSubmit() }}
                  disabled={!bubbleInput.trim()}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              <p className="ai-chat-message">{getMessage()}</p>
            )}
          </div>

          {/* Custom search chips */}
          {customChips.length > 0 && (
            <div className="ai-chat-options">
              {customChips.map((chip) => (
                <button key={chip} className="ai-chat-option ai-chat-custom-chip">
                  {chip}
                  <span className="ai-chat-chip-remove" onClick={(e) => { e.stopPropagation(); removeCustomChip(chip) }}>×</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick-chip options */}
          {currentOptions.length > 0 && (
            <div className="ai-chat-options">
              {currentOptions.map((option) => (
                <button
                  key={option}
                  className={`ai-chat-option ${getSelectedForStep() === option ? 'ai-chat-option-selected' : ''}`}
                  onClick={() =>
                    chatStep === 'initial'
                      ? handleOptionClick(option)
                      : handleGroupFollowUp(option)
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Budget action chips — shown after budget filter is applied */}
          {chatStep === 'done' && submittedBudget && (selectedOption === 'Single room' || selectedOption === 'Double room') && (
            <div className="ai-chat-options">
              <button className="ai-chat-option" onClick={handleIncreaseBudget}>
                Increase budget by 10%
              </button>
              <button className="ai-chat-option" onClick={handleClearFilters}>
                Clear filters
              </button>
            </div>
          )}

          {/* Budget input — shown after Single room or Double room is clicked */}
          {chatStep === 'askBudget' && (
            <div className="ai-chat-input-row">
              <input
                ref={budgetInputRef}
                type="text"
                className="ai-chat-input"
                placeholder="e.g. £200"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={handleBudgetKeyDown}
              />
              <button
                className="ai-chat-send-btn"
                onClick={handleBudgetSubmit}
                disabled={!budgetInput.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Group size input — shown after Family/Friends or Group is clicked */}
          {chatStep === 'askGroupSize' && (
            <div className="ai-chat-input-row">
              <input
                ref={inputRef}
                type="text"
                className="ai-chat-input"
                placeholder={selectedOption === 'Group' ? 'e.g. 10 rooms' : 'e.g. 6 people'}
                value={groupSizeInput}
                onChange={(e) => setGroupSizeInput(e.target.value)}
                onKeyDown={handleGroupSizeKeyDown}
              />
              <button
                className="ai-chat-send-btn"
                onClick={handleGroupSizeSubmit}
                disabled={!groupSizeInput.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10L16 10M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AiChat
