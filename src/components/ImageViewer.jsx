import { useState, useEffect } from 'react'
import { QR_DATA } from '../App'

const QR_POOL = ['qr1', 'qr2', 'qr3', 'qr4', 'qr5']

/**
 * ImageViewer – shown on the scanning device after QR is read.
 * Displays the mapped image and a success message, then marks
 * the QR as scanned in localStorage.
 */
export default function ImageViewer({ qrId }) {
  const [phase, setPhase] = useState('loading') // 'loading' | 'success'
  const [imgLoaded, setImgLoaded] = useState(false)

  const meta = QR_DATA[qrId]
  const isValid = QR_POOL.includes(qrId) && meta

  useEffect(() => {
    // Brief loading delay for dramatic effect
    const t = setTimeout(() => setPhase('success'), 700)
    return () => clearTimeout(t)
  }, [])

  if (!isValid) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-20">
        <div className="text-6xl">❓</div>
        <p className="text-white font-bold text-xl">Unknown QR Code</p>
        <p className="text-white/40 text-sm">This QR doesn't match any item in the pool.</p>
        <a
          href="/"
          className="mt-4 text-purple-400 underline text-sm font-medium"
        >
          ← Back to home
        </a>
      </div>
    )
  }

  return (
    <div
      className="success-overlay"
      id="image-viewer-root"
    >
      {/* Loading phase */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-6">
          {/* Spinning ring loader */}
          <div className="relative w-20 h-20">
            <div
              className="absolute inset-0 rounded-full border-4 border-purple-500/20"
            />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400"
              style={{ animation: 'spinGlow 1s linear infinite' }}
            />
          </div>
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase">
            Unlocking…
          </p>
        </div>
      )}

      {/* Success phase */}
      {phase === 'success' && (
        <div className="flex flex-col items-center gap-6 px-6 text-center">

          {/* Success badge */}
          <div className="animate-success">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                boxShadow: '0 0 30px rgba(34, 197, 94, 0.25)'
              }}
            >
              <span className="text-2xl">✅</span>
              <span className="text-green-300 font-bold text-lg tracking-wide">
                QR SCANNED SUCCESSFULLY
              </span>
            </div>
          </div>

          {/* Item identity */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}
          >
            <p className="text-white/40 text-xs uppercase tracking-widest font-medium">
              You unlocked
            </p>
            <p className="text-white font-extrabold text-3xl mt-1">
              {meta.emoji} {meta.label}
            </p>
          </div>

          {/* Image reveal */}
          <div
            className="animate-fade-up relative"
            style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
          >
            {!imgLoaded && (
              <div className="skeleton w-80 h-64 absolute inset-0" />
            )}
            <img
              id="reveal-image"
              src={meta.image}
              alt={meta.label}
              className="image-fullscreen"
              style={{ display: imgLoaded ? 'block' : 'opacity-0' }}
              onLoad={() => setImgLoaded(true)}
            />
          </div>

          {/* QR ID tag */}
          <div
            className="animate-fade-up flex items-center gap-2"
            style={{ animationDelay: '0.45s', opacity: 0, animationFillMode: 'forwards' }}
          >
            <span className="text-white/20 text-xs font-mono uppercase">
              {qrId}
            </span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white/20 text-xs">
              Added to your cycle log
            </span>
          </div>

          {/* Back link */}
          <a
            id="back-home-link"
            href="/"
            className="animate-fade-up text-purple-400 text-sm font-semibold hover:text-purple-300 transition underline underline-offset-4"
            style={{ animationDelay: '0.6s', opacity: 0, animationFillMode: 'forwards' }}
          >
            ← Back to QR display
          </a>
        </div>
      )}
    </div>
  )
}
