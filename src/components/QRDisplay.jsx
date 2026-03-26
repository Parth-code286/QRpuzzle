import { useState, useEffect } from 'react'
import { QRCode } from 'react-qr-code'
import { QR_DATA } from '../App'

const QR_POOL = ['qr1', 'qr2', 'qr3', 'qr4', 'qr5']

/**
 * QRDisplay – shown on the main "host" device.
 * Displays the randomly-selected QR code with scan tracking, progress,
 * and slot badges for each QR in the cycle.
 */
export default function QRDisplay({ currentQr, scannedQrs, baseUrl, loading, onReset }) {
  const [visible, setVisible] = useState(false)

  // Trigger fade-in after mount
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
  }, [loading])

  const scannedCount = scannedQrs.length
  const progressPct  = (scannedCount / QR_POOL.length) * 100

  // Build the URL this QR encodes
  const qrUrl = currentQr ? `${baseUrl}?qr=${currentQr}` : ''
  const qrMeta = currentQr ? QR_DATA[currentQr] : null

  return (
    <div
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
      className="flex flex-col items-center gap-6"
      id="qr-display-root"
    >
      {/* ── Header ── */}
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-gradient tracking-tight mb-1" id="app-title">
          QR Quest
        </h1>
        <p className="text-white/40 text-sm font-medium tracking-widest uppercase">
          Scan to unlock the mystery
        </p>
      </div>

      {/* ── Glass card ── */}
      <div className="glass-card w-full p-8 flex flex-col items-center gap-6">

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col items-center gap-4 w-full animate-fade-up">
            <div className="skeleton w-52 h-52" />
            <div className="skeleton w-40 h-5" />
            <div className="skeleton w-32 h-4" />
          </div>
        )}

        {/* QR Code */}
        {!loading && currentQr && (
          <div className="flex flex-col items-center gap-4 animate-fade-scale">
            {/* Scan-line effect wrapper */}
            <div className="relative scan-line-wrapper rounded-2xl" id="qr-code-wrapper">
              <div className="qr-glow-container">
                <QRCode
                  id="active-qr-code"
                  value={qrUrl}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  level="H"
                />
              </div>
              <div className="scan-line" />
              {/* Corner decorations */}
              <span className="qr-corner qr-corner-tl" />
              <span className="qr-corner qr-corner-tr" />
              <span className="qr-corner qr-corner-bl" />
              <span className="qr-corner qr-corner-br" />
            </div>

            {/* QR identity */}
            <div className="text-center">
              <p className="text-white/30 text-xs uppercase tracking-widest font-medium">
                Active QR
              </p>
              <p className="text-white font-bold text-lg mt-1">
                {qrMeta?.emoji} {qrMeta?.label}
              </p>
              <p className="text-white/20 text-xs font-mono mt-1 break-all max-w-xs">
                {qrUrl}
              </p>
            </div>
          </div>
        )}

        {/* All scanned state */}
        {!loading && !currentQr && (
          <div className="flex flex-col items-center gap-3 py-6 animate-fade-scale">
            <div className="text-6xl animate-success">🎉</div>
            <p className="text-white font-bold text-xl">All QRs Scanned!</p>
            <p className="text-white/40 text-sm">Resetting cycle…</p>
          </div>
        )}

        {/* ── Progress ── */}
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Progress
            </span>
            <span className="text-white/80 text-sm font-bold">
              {scannedCount} / {QR_POOL.length} scanned
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPct}%` }}
              id="progress-bar"
              role="progressbar"
              aria-valuenow={scannedCount}
              aria-valuemax={QR_POOL.length}
            />
          </div>
        </div>

        {/* ── QR Slot Badges ── */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {QR_POOL.map((id) => {
            const meta     = QR_DATA[id]
            const isActive = id === currentQr
            const isDone   = scannedQrs.includes(id)
            const cls      = isActive ? 'qr-badge-active' : isDone ? 'qr-badge-scanned' : 'qr-badge-pending'
            const icon     = isActive ? '🟢' : isDone ? '✅' : '⬜'
            return (
              <span
                key={id}
                className={`qr-badge ${cls}`}
                id={`badge-${id}`}
              >
                {icon} {meta.emoji} {meta.label}
              </span>
            )
          })}
        </div>

        {/* ── Reset button ── */}
        <button
          id="reset-button"
          onClick={onReset}
          className="btn-reset"
          title="Reset the QR cycle (for testing)"
        >
          🔄 Reset Cycle
        </button>
      </div>

      {/* ── Hint ── */}
      <p className="text-white/20 text-xs text-center px-4">
        Point another device's camera at the QR code above
      </p>
    </div>
  )
}
