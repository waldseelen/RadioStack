'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2, ListMusic, Shuffle, Repeat, Heart, AlertTriangle, Target, Music } from 'lucide-react'
import { usePlayerStore } from '@/stores/player-store'
import { useFavorites } from '@/hooks/use-favorites'
import { cn } from '@/lib/utils'

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [showQueue, setShowQueue] = useState(false)
  
  // Metadata States
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null)
  const [nowPlayingArtist, setNowPlayingArtist] = useState<string | null>(null)

  // Visualizer Web Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const {
    currentStation,
    isPlaying,
    shuffle,
    volume,
    streamError,
    togglePlay,
    toggleShuffle,
    setVolume,
    setStreamError,
    next,
    prev,
    currentCategoryStations,
  } = usePlayerStore()
  
  const { toggle, isFavorite } = useFavorites()

  // Audio element control
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentStation) return
    el.volume = volume
    const url = currentStation.streamUrl
    if (el.src !== url) {
      el.src = url
      el.load()
    }
    if (isPlaying) {
      const p = el.play()
      if (p && typeof p.then === 'function') {
          p.catch(() => {
              setStreamError(true)
          })
      }
    } else {
      el.pause()
    }
  }, [currentStation, isPlaying, volume, setStreamError])

  // Media Session API
  useEffect(() => {
    if (!currentStation || typeof window === 'undefined' || !navigator.mediaSession) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStation.name,
      artist: nowPlayingTitle ? `${nowPlayingArtist || 'Bilinmeyen'} - ${nowPlayingTitle}` : (currentStation.category || 'RadioStack'),
      artwork: currentStation.logo ? [{ src: currentStation.logo }] : [],
    })

    navigator.mediaSession.setActionHandler('play', () => {
      if (!usePlayerStore.getState().isPlaying) togglePlay()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      if (usePlayerStore.getState().isPlaying) togglePlay()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prev()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      next()
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
  }, [currentStation, nowPlayingTitle, nowPlayingArtist, togglePlay, next, prev])

  // Polling Stream Metadata (Now Playing)
  useEffect(() => {
    if (!currentStation || !isPlaying) {
      setNowPlayingTitle(null)
      setNowPlayingArtist(null)
      return
    }

    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/metadata?url=${encodeURIComponent(currentStation.streamUrl)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.title) {
            setNowPlayingTitle(data.title)
            setNowPlayingArtist(data.artist)
          }
        }
      } catch (err) {
        console.error('Metadata API error:', err)
      }
    }

    void fetchMetadata()
    const interval = setInterval(fetchMetadata, 15000) // 15 saniyede bir güncelle

    return () => clearInterval(interval)
  }, [currentStation, isPlaying])

  // Web Audio Context & Analyser setup
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setupAudioContext = () => {
      if (audioContextRef.current) return
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64 // Düzgün ve şık frekans barları için küçük FFT
        
        const source = ctx.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(ctx.destination)

        audioContextRef.current = ctx
        analyserRef.current = analyser
        sourceRef.current = source
      } catch (err) {

        console.error("AudioContext setup failed:", err)
      }
    }

    const handlePlay = () => {
      setupAudioContext()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        void audioContextRef.current.resume()
      }
    }

    audio.addEventListener('play', handlePlay)
    return () => {
      audio.removeEventListener('play', handlePlay)
    }
  }, [])

  // Canvas Ekolayzır Çizim Döngüsü
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      if (!analyser || !isPlaying) {
        // Çalmıyorken düz çizgiler veya boş alan çiz
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#262626'
        const barWidth = 2
        const gap = 1
        const totalBars = Math.floor(canvas.width / (barWidth + gap))
        for (let i = 0; i < totalBars; i++) {
          const x = i * (barWidth + gap)
          const y = canvas.height / 2 - 1
          ctx.fillRect(x, y, barWidth, 2)
        }
        return
      }

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = 2
      const gap = 1
      const totalBars = Math.floor(canvas.width / (barWidth + gap))

      for (let i = 0; i < totalBars; i++) {
        const dataIdx = Math.floor((i / totalBars) * bufferLength)
        const value = dataArray[dataIdx] || 0
        const percent = value / 255
        const barHeight = percent * canvas.height * 0.9 // Maksimum %90 yükseklik

        const x = i * (barWidth + gap)
        const y = canvas.height - barHeight

        // Proje temasına uygun sarı/neon-sarı (#e8ff00) tonlarında dinamik HSL geçişi
        const hue = 66
        const saturation = 100
        const lightness = 45 + percent * 10
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        ctx.fillRect(x, y, barWidth, barHeight)
      }
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying])

  if (!currentStation) return null

  const isFav = isFavorite(currentStation.id)

  const scrollToActive = () => {
      const el = document.getElementById(`station-${currentStation.id}`)
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-4', 'ring-accent')
          setTimeout(() => el.classList.remove('ring-4', 'ring-accent'), 2000)
      }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-neutral-800 shadow-2xl">
      <audio 
        ref={audioRef} 
        className="hidden" 
        crossOrigin="anonymous" // Web Audio API'nin CORS engeline takılmaması için kritik
        onError={() => setStreamError(true)}
        onPlay={() => setStreamError(false)}
      />
      
      {/* Queue Dropup */}
      {showQueue && (
         <div className="border-b border-neutral-800 max-h-48 overflow-auto bg-black p-2">
            <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-neutral-900">
               <span className="font-mono text-[10px] uppercase text-neutral-500">Up Next</span>
               <span className="font-mono text-[10px] text-neutral-600">{currentCategoryStations.length} items</span>
            </div>
            <div className="grid grid-cols-1 gap-px bg-neutral-900 border border-neutral-900">
              {currentCategoryStations.slice(0, 20).map((st) => (
                <button
                  key={st.id}
                  onClick={() => usePlayerStore.getState().setStation(st, currentCategoryStations)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-left transition-colors bg-black",
                    st.id === currentStation.id ? "text-white" : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                  )}
                >
                  <span className="w-4 flex justify-center shrink-0">
                    {st.id === currentStation.id && isPlaying ? (
                       <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    ) : null}
                  </span>
                  <span className="truncate text-xs font-sans">{st.name}</span>
                </button>
              ))}
            </div>
         </div>
      )}

      {/* Main Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 h-14">
        
        {/* Info Area */}
        <div className="flex items-center gap-3 w-1/3 md:w-1/3 min-w-0">
          <button 
            onClick={scrollToActive}
            className="h-9 w-9 shrink-0 bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden relative group"
            title="Scroll to current station"
            type="button"
          >
             {currentStation.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentStation.logo} alt="" className="h-full w-full object-cover grayscale opacity-80 group-hover:opacity-100 transition-opacity" />
             ) : (
                <span className="font-mono text-xs text-neutral-500">{currentStation.name.charAt(0)}</span>
             )}
             <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Target className="h-4 w-4 text-accent" />
             </div>
          </button>

          <div className="min-w-0 flex-1 cursor-pointer" onClick={scrollToActive} title="Scroll to current station">
             <div className="flex items-center gap-2">
                 <h4 className={cn(
                     "truncate font-sans text-sm font-medium transition-colors",
                     streamError ? "text-red-500" : "text-accent"
                 )}>
                     {currentStation.name}
                 </h4>
                 {isPlaying && !streamError && <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />}
             </div>
             
             {/* Display Now Playing Metadata if available, else Category */}
             <div className="flex items-center gap-2 min-w-0">
                {nowPlayingTitle ? (
                    <div className="flex items-center gap-1.5 text-accent/80 min-w-0">
                      <Music className="h-3 w-3 shrink-0 text-accent" />
                      <p className="truncate font-sans text-[10px] font-semibold animate-in fade-in slide-in-from-left-2 duration-300">
                          {nowPlayingArtist && `${nowPlayingArtist} - `}{nowPlayingTitle}
                      </p>
                    </div>
                ) : (
                    <p className="truncate font-mono text-[10px] text-neutral-500 uppercase">{currentStation.category || 'Yayın'}</p>
                )}
                {streamError && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase animate-pulse shrink-0">
                        <AlertTriangle className="h-3 w-3" />
                        Offline
                    </span>
                )}
             </div>
          </div>

          {/* Canvas Ekolayzır (Responsive Görünüm) */}
          <div className="hidden sm:block shrink-0 px-2 border-l border-neutral-900">
              <canvas ref={canvasRef} width={60} height={20} className="w-[60px] h-5 opacity-80" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 md:gap-4 w-1/3 md:w-1/3">
          <button
            type="button"
            className={cn(
              "hidden md:block p-1.5 transition-colors",
              shuffle ? "text-accent" : "text-neutral-600 hover:text-accent"
            )}
            onClick={() => toggleShuffle()}
            title={shuffle ? "Shuffle Mode" : "Sequential Mode"}
          >
            {shuffle ? <Shuffle className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            className="p-1.5 text-neutral-500 hover:text-white transition-colors"
            onClick={() => prev()}
            title="Previous"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          
          <button
            type="button"
            className={cn(
                "flex h-9 w-9 items-center justify-center border transition-all",
                streamError 
                    ? "border-red-900 bg-red-950 text-red-500 hover:bg-red-900 hover:text-white"
                    : "border-accent bg-accent text-black hover:scale-105 active:scale-95"
            )}
            onClick={() => togglePlay()}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            className="p-1.5 text-neutral-500 hover:text-white transition-colors"
            onClick={() => next()}
            title="Next"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => toggle(currentStation.id)}
            className={cn(
              "p-1.5 transition-all hover:scale-110 active:scale-90",
              isFav ? "text-accent" : "text-neutral-700 hover:text-neutral-400"
            )}
            title={isFav ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
          </button>
        </div>

        {/* Extras */}
        <div className="hidden md:flex items-center justify-end gap-4 w-1/3 min-w-0">
          <button 
            type="button"
            onClick={() => setShowQueue(!showQueue)}
            className={cn(
              "p-1.5 transition-colors border border-transparent",
              showQueue ? "bg-neutral-900 border-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
            title="Queue"
          >
            <ListMusic className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 w-24">
            <Volume2 className="h-4 w-4 text-neutral-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
