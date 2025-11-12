import React, { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Spline from '@splinetool/react-spline'
import { Hands } from '@mediapipe/hands'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { Camera } from '@mediapipe/camera_utils'
import * as THREE from 'three'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import SimplexNoise from 'simplex-noise'

const MODES = ['Shape', 'Stroke', 'Handles', 'Interpolate', 'Noise', 'Texture']

function KnobOverlay({ angle, activeMode, confidence }) {
  const pct = (angle % (2 * Math.PI)) / (2 * Math.PI)
  const arc = pct * 360
  return (
    <div className="absolute top-4 right-4 w-40 h-40 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-300">
        <div className="text-xs uppercase tracking-widest opacity-80">Mode</div>
        <div className="text-lg font-semibold text-white drop-shadow">{activeMode} </div>
        <div className="mt-2 text-[10px] text-white/70">Confidence {Math.round(confidence * 100)}%</div>
      </div>
      <svg className="absolute inset-0" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r="44" stroke="url(#g)" strokeLinecap="round" strokeWidth="8" fill="none" strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${(1 - pct) * 2 * Math.PI * 44}`}/>
        </g>
        <circle cx={50 + 44 * Math.cos(angle - Math.PI / 2)} cy={50 + 44 * Math.sin(angle - Math.PI / 2)} r="4" fill="#22d3ee" />
      </svg>
    </div>
  )
}

function GlowTrail({ points }) {
  return (
    <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 1280 720" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#db2777"/>
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <polyline
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="url(#trail)"
        strokeWidth="3"
        opacity="0.9"
        filter="url(#glow)"
      />
    </svg>
  )
}

function Glyph3D({ params, mode }) {
  const mesh = useRef()
  const noise = useMemo(() => new SimplexNoise('glyph'), [])

  useFrame((state, delta) => {
    if (!mesh.current) return
    mesh.current.rotation.y += 0.2 * delta
    mesh.current.rotation.x += 0.1 * delta
  })

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const w = 1, h = 1.4
    shape.moveTo(-w, -h)
    shape.lineTo(-w, h)
    shape.lineTo(w, h)
    shape.lineTo(w, -h)
    shape.lineTo(-w, -h)

    // Simple inner counterform for an "O"-like shape
    const hole = new THREE.Path()
    hole.absellipse(0, 0, 0.6, 0.9, 0, Math.PI * 2, false, 0)
    shape.holes.push(hole)

    const extrudeSettings = {
      depth: 0.4 + params.stroke * 0.2,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 2,
      bevelSize: 0.08 + params.texture * 0.04,
      bevelThickness: 0.08 + params.texture * 0.04,
      curveSegments: 64
    }

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)

    if (mode === 'Noise' || params.noise > 0.01) {
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const nx = noise.noise3D(pos.getX(i) * 0.5, pos.getY(i) * 0.5, pos.getZ(i) * 0.5)
        pos.setXYZ(i,
          pos.getX(i) + nx * params.noise * 0.12,
          pos.getY(i) + nx * params.noise * 0.12,
          pos.getZ(i) + nx * params.noise * 0.12
        )
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
    }

    return geo
  }, [params.stroke, params.texture, params.noise, mode])

  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(0.58 + params.texture * 0.1, 0.7, 0.55),
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2
  }), [params.texture])

  return (
    <mesh ref={mesh} geometry={geometry} castShadow receiveShadow>
      <primitive attach="material" object={material} />
    </mesh>
  )
}

export default function GestureCanvas() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [angle, setAngle] = useState(0)
  const [activeMode, setActiveMode] = useState(MODES[0])
  const [confidence, setConfidence] = useState(0)
  const [trail, setTrail] = useState([])
  const [params, setParams] = useState({ stroke: 0.5, noise: 0.0, texture: 0.3 })
  const [message, setMessage] = useState('')

  const updateModeByRotation = (delta) => {
    const threshold = Math.PI / 4 // 45 degrees per step
    const newAngle = angle + delta
    setAngle(newAngle)
    if (Math.abs(newAngle) >= threshold) {
      const steps = Math.floor(newAngle / threshold)
      setAngle(newAngle - steps * threshold)
      setActiveMode(prev => {
        const idx = MODES.indexOf(prev)
        const next = (idx + steps + MODES.length) % MODES.length
        return MODES[next]
      })
    }
  }

  useEffect(() => {
    let camera = null
    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` })
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    })

    hands.onResults((results) => {
      const ctx = canvasRef.current.getContext('2d')
      ctx.save()
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height)
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0]
        drawConnectors(ctx, lm, Hands.CONNECTIONS, { color: '#22d3ee', lineWidth: 3 })
        drawLandmarks(ctx, lm, { color: '#f472b6', lineWidth: 1 })

        const thumb = lm[4]
        const index = lm[8]
        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y)
        const isPinching = pinchDist < 0.05

        const centerX = (thumb.x + index.x) / 2
        const centerY = (thumb.y + index.y) / 2
        const prev = trail[trail.length - 1]
        const px = centerX * canvasRef.current.width
        const py = centerY * canvasRef.current.height

        const newTrail = [...trail, { x: px, y: py }].slice(-60)
        setTrail(newTrail)

        // Compute angle between thumb and index as knob
        const ang = Math.atan2(index.y - thumb.y, index.x - thumb.x)

        // Map rotation to params per mode
        if (isPinching) {
          setConfidence(0.9)
          const delta = ang - (prev?.ang || ang)
          updateModeByRotation(delta)

          setParams(p => {
            switch (activeMode) {
              case 'Stroke':
                return { ...p, stroke: Math.min(1, Math.max(0, p.stroke + delta)) }
              case 'Noise':
                return { ...p, noise: Math.min(1, Math.max(0, p.noise + delta)) }
              case 'Texture':
                return { ...p, texture: Math.min(1, Math.max(0, p.texture + delta)) }
              default:
                return p
            }
          })
        } else {
          setConfidence(0.6)
        }

        setMessage(isPinching ? 'pinchMove' : 'handTracking')
      } else {
        setConfidence(0)
        setMessage('No hands detected')
      }

      ctx.restore()
    })

    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current })
        },
        width: 1280,
        height: 720,
      })
      camera.start()
    }

    return () => {
      if (camera) camera.stop()
      hands.close()
    }
  }, [activeMode, angle, trail])

  return (
    <div className="relative w-full h-[80vh] rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-black to-slate-950">
      <div className="absolute inset-0 pointer-events-none">
        <Spline scene="https://prod.spline.design/EF7JOSsHLk16Tlw9/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />

      <div className="absolute inset-0 grid grid-cols-12 gap-6 p-6">
        <div className="col-span-8 relative rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden">
          <Canvas shadows camera={{ position: [2.5, 2, 5], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight castShadow intensity={1.2} position={[5, 5, 5]} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <group position={[0, 0, 0]}>
              <Glyph3D params={params} mode={activeMode} />
              <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
                <planeGeometry args={[10, 10]} />
                <meshPhysicalMaterial color="#0b0f1a" roughness={0.8} metalness={0.2} />
              </mesh>
            </group>
            <OrbitControls enablePan={false} />
          </Canvas>
          <div className="absolute left-3 top-3 text-xs text-white/70 bg-black/40 rounded-full px-2 py-1">{message}</div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="relative h-40 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" playsInline muted></video>
            <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full" />
            <GlowTrail points={trail} />
            <KnobOverlay angle={angle} activeMode={activeMode} confidence={confidence} />
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 text-white/90">
            <div className="text-sm mb-2">Parameters</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-black/30">
                <div className="opacity-70">Stroke</div>
                <div className="text-cyan-300 font-mono">{params.stroke.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30">
                <div className="opacity-70">Noise</div>
                <div className="text-fuchsia-300 font-mono">{params.noise.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30">
                <div className="opacity-70">Texture</div>
                <div className="text-emerald-300 font-mono">{params.texture.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 text-white/90">
            <div className="text-sm mb-2">Creative Console</div>
            <Console params={params} setParams={setParams} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Console({ params, setParams }) {
  const [code, setCode] = useState("// Try: p => ({...p, noise: Math.min(1, p.noise + 0.1)})\n(p) => ({ ...p, noise: Math.abs(Math.sin(Date.now()/1000))*0.7 })")
  const [error, setError] = useState('')

  const run = () => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = eval(code)
      const next = fn(params)
      if (typeof next === 'object') setParams(next)
      setError('')
    } catch (e) {
      setError(String(e.message))
    }
  }

  useEffect(() => {
    const id = setInterval(run, 1000)
    return () => clearInterval(id)
  }, [code, params])

  return (
    <div>
      <textarea value={code} onChange={e => setCode(e.target.value)} className="w-full h-28 rounded-xl bg-black/40 border border-white/10 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={run} className="px-3 py-1.5 rounded-lg bg-cyan-500/80 hover:bg-cyan-400 text-black font-semibold">Run</button>
        {error && <div className="text-rose-400 text-xs">{error}</div>}
      </div>
    </div>
  )
}
