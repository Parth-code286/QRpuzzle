import { useState, useEffect, useCallback } from 'react'
import QRDisplay from './components/QRDisplay'
import ImageViewer from './components/ImageViewer'

// ─── Real-time Sync Manager ────────────────────────────────────────────────────────
class RealtimeSyncManager {
  constructor() {
    this.listeners = new Set()
    this.roomId = this.getOrCreateRoomId()
    this.isConnected = false
    this.lastKnownScan = null
  }

  getOrCreateRoomId() {
    let roomId = localStorage.getItem('qr_game_room_id')
    if (!roomId) {
      roomId = 'room_' + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('qr_game_room_id', roomId)
    }
    return roomId
  }

  async connect() {
    if (this.isConnected) return

    try {
      // Use Firebase Realtime Database for cross-device sync
      // This is a free public demo instance for testing
      const firebaseUrl = `https://qr-game-sync-default-rtdb.firebaseio.com/rooms/${this.roomId}.json`
      
      console.log('Connecting to real-time sync for room:', this.roomId)
      this.startFirebaseSync(firebaseUrl)
      this.isConnected = true
    } catch (error) {
      console.error('Failed to connect:', error)
      // Fallback to polling-based sync
      this.startPollingFallback()
    }
  }

  startFirebaseSync(firebaseUrl) {
    // Poll Firebase for changes every 1 second
    this.firebaseInterval = setInterval(async () => {
      try {
        const response = await fetch(firebaseUrl)
        if (response.ok) {
          const data = await response.json()
          if (data && data.lastScan && data.lastScan !== this.lastKnownScan) {
            this.lastKnownScan = data.lastScan
            this.notifyListeners({
              type: 'QR_SCANNED',
              qrId: data.lastScanQrId,
              timestamp: data.timestamp
            })
          }
        }
      } catch (err) {
        console.log('Firebase sync error, using fallback')
      }
    }, 1000)
  }

  startPollingFallback() {
    // Fallback: Use BroadcastChannel for same browser tabs
    console.log('Using fallback sync method')
    try {
      const bc = new BroadcastChannel('qr_game_channel')
      bc.onmessage = (e) => {
        if (e.data?.type === 'QR_SCANNED') {
          this.notifyListeners(e.data)
        }
      }
    } catch { /* BroadcastChannel not supported */ }
  }

  async broadcastScan(qrId) {
    const scanData = {
      lastScan: Date.now().toString(),
      lastScanQrId: qrId,
      timestamp: Date.now()
    }
    
    try {
      // Update Firebase Realtime Database
      const firebaseUrl = `https://qr-game-sync-default-rtdb.firebaseio.com/rooms/${this.roomId}.json`
      await fetch(firebaseUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scanData)
      })
      
      console.log('Broadcasted scan to Firebase:', qrId)
    } catch (error) {
      console.error('Firebase broadcast failed, using local fallback')
    }
    
    // Also use BroadcastChannel for same-browser tabs
    try {
      const bc = new BroadcastChannel('qr_game_channel')
      bc.postMessage({
        type: 'QR_SCANNED',
        qrId,
        timestamp: Date.now()
      })
      bc.close()
    } catch { /* BroadcastChannel not supported */ }
    
    // Notify local listeners immediately
    this.notifyListeners({
      type: 'QR_SCANNED',
      qrId,
      timestamp: Date.now()
    })
  }

  addListener(callback) {
    this.listeners.add(callback)
  }

  removeListener(callback) {
    this.listeners.delete(callback)
  }

  notifyListeners(data) {
    console.log('Notifying listeners of scan:', data)
    this.listeners.forEach(callback => {
      try {
        callback(data)
      } catch (err) {
        console.error('Error in listener callback:', err)
      }
    })
  }

  disconnect() {
    this.isConnected = false
    if (this.firebaseInterval) {
      clearInterval(this.firebaseInterval)
      this.firebaseInterval = null
    }
  }
}

// Global sync instance
const syncManager = new RealtimeSyncManager()

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

      // Broadcast globally via real-time sync
      try {
        syncManager.connect()
        syncManager.broadcastScan(qrParam)
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

  // ── Listen for scan events from other tabs and global sync
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

    // Real-time sync listener
    const handleSyncMessage = (data) => {
      if (data.type === 'QR_SCANNED') {
        console.log('Received scan update:', data)
        syncFromStorage()
      }
    }
    
    syncManager.connect()
    syncManager.addListener(handleSyncMessage)

    // Fallback: poll localStorage every 2 seconds
    const pollInterval = setInterval(syncFromStorage, 2000)

    return () => {
      channel?.close()
      syncManager.removeListener(handleSyncMessage)
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
      syncManager.disconnect()
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
