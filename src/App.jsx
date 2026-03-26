import { useState, useEffect, useCallback } from 'react'
import QRDisplay from './components/QRDisplay'
import ImageViewer from './components/ImageViewer'

// ─── WebSocket Manager ────────────────────────────────────────────────────────
class WebSocketManager {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
    this.listeners = new Set()
    this.roomId = this.getOrCreateRoomId()
  }

  getOrCreateRoomId() {
    let roomId = localStorage.getItem('qr_game_room_id')
    if (!roomId) {
      roomId = 'room_' + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('qr_game_room_id', roomId)
    }
    return roomId
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      // Using a public WebSocket server for demo
      this.ws = new WebSocket('wss://echo.websocket.org')
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        // Join room
        this.send({ type: 'JOIN_ROOM', roomId: this.roomId })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'QR_SCANNED' && data.roomId === this.roomId) {
            this.notifyListeners(data)
          }
        } catch (err) {
          console.log('Received non-JSON message:', event.data)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`)
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...data, roomId: this.roomId, timestamp: Date.now() }))
    }
  }

  broadcastScan(qrId) {
    this.send({ type: 'QR_SCANNED', qrId })
  }

  addListener(callback) {
    this.listeners.add(callback)
  }

  removeListener(callback) {
    this.listeners.delete(callback)
  }

  notifyListeners(data) {
    this.listeners.forEach(callback => callback(data))
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}

// Global WebSocket instance
const wsManager = new WebSocketManager()

// ─── Constants ────────────────────────────────────────────────────────────────
const QR_POOL = ['qr1', 'qr2', 'qr3', 'qr4', 'qr5']
const STORAGE_KEY = 'scannedQrs'
const CHANNEL_NAME = 'qr_game_channel'

// Image mapping for each QR ID
export const QR_DATA = {
  qr1: { image: '/images/img1.png', label: 'Treasure Chest',  emoji: '💰' },
  qr2: { image: '/images/img2.png', label: 'Mystic Portal',   emoji: '🌀' },
  qr3: { image: '/images/img3.png', label: 'Legendary Sword', emoji: '⚔️'  },
  qr4: { image: '/images/img4.png', label: 'Crystal Dragon',  emoji: '🐉' },
  qr5: { image: '/images/img5.png', label: 'Arcane Tome',     emoji: '📖' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read scanned QRs from localStorage, auto-reset if all 5 done */
function readScannedQrs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    // Auto-reset cycle when all are scanned
    if (arr.length >= QR_POOL.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      return []
    }
    return arr
  } catch {
    return []
  }
}

/** Pick a random QR that hasn't been scanned yet */
function pickRandomQr(scannedQrs) {
  const unscanned = QR_POOL.filter(id => !scannedQrs.includes(id))
  if (unscanned.length === 0) return null
  return unscanned[Math.floor(Math.random() * unscanned.length)]
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [scannedQrs, setScannedQrs]     = useState([])
  const [currentQr, setCurrentQr]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [isScannedView, setIsScannedView] = useState(false)
  const [scannedQrId, setScannedQrId]   = useState(null)

  // ── Derive base URL for QR codes
  const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`

  // ── Sync state from localStorage
  const syncFromStorage = useCallback(() => {
    const qrs = readScannedQrs()
    setScannedQrs(qrs)
    return qrs
  }, [])

  // ── Initialize on mount
  useEffect(() => {
    // Check if this is a scan result page (has ?qr= param)
    const params = new URLSearchParams(window.location.search)
    const qrParam = params.get('qr')

    if (qrParam && QR_POOL.includes(qrParam)) {
      // ── SCAN VIEW: mark as scanned and show image
      setIsScannedView(true)
      setScannedQrId(qrParam)

      // Mark scanned in localStorage
      const current = readScannedQrs()
      if (!current.includes(qrParam)) {
        const updated = [...current, qrParam]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }

      // Broadcast to other tabs via BroadcastChannel
      try {
        const bc = new BroadcastChannel(CHANNEL_NAME)
        bc.postMessage({ type: 'QR_SCANNED', qrId: qrParam })
        bc.close()
      } catch { /* BroadcastChannel not supported */ }

      // Broadcast globally via WebSocket
      try {
        wsManager.connect()
        wsManager.broadcastScan(qrParam)
      } catch (error) {
        console.error('Failed to broadcast scan:', error)
      }

      setLoading(false)
      return
    }

    // ── DISPLAY VIEW: pick which QR to show
    setTimeout(() => {
      const qrs = syncFromStorage()
      const picked = pickRandomQr(qrs)
      setCurrentQr(picked)
      setLoading(false)
    }, 800) // slight delay for loader effect
  }, [syncFromStorage])

  // ── Listen for scan events from other tabs and global WebSocket
  useEffect(() => {
    if (isScannedView) return // not needed on scan page

    let channel
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (e) => {
        if (e.data?.type === 'QR_SCANNED') {
          syncFromStorage()
        }
      }
    } catch { /* not supported */ }

    // WebSocket listener for global sync
    const handleWebSocketMessage = (data) => {
      if (data.type === 'QR_SCANNED') {
        syncFromStorage()
      }
    }
    
    wsManager.connect()
    wsManager.addListener(handleWebSocketMessage)

    // Fallback: poll localStorage every 2 seconds
    const pollInterval = setInterval(syncFromStorage, 2000)

    return () => {
      channel?.close()
      wsManager.removeListener(handleWebSocketMessage)
      clearInterval(pollInterval)
    }
  }, [isScannedView, syncFromStorage])

  // ── Reset handler
  const handleReset = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    const qrs = []
    setScannedQrs(qrs)
    setLoading(true)
    setTimeout(() => {
      const picked = pickRandomQr(qrs)
      setCurrentQr(picked)
      setLoading(false)
    }, 600)
  }, [])

  // ── Cleanup on unmount
  useEffect(() => {
    return () => {
      wsManager.disconnect()
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="bg-animated" aria-hidden="true" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg">
        {isScannedView ? (
          <ImageViewer qrId={scannedQrId} />
        ) : (
          <QRDisplay
            currentQr={currentQr}
            scannedQrs={scannedQrs}
            baseUrl={baseUrl}
            loading={loading}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
