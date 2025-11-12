import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Save, Undo2, Redo2, Download } from 'lucide-react'
import Spline from '@splinetool/react-spline'
import GestureCanvas from './components/GestureCanvas'

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-slate-950 text-white">
      <header className="relative z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-600 shadow-lg shadow-cyan-500/30" />
          <div className="text-lg font-semibold tracking-wide">Gestural Font Lab</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"><Undo2 size={16}/>Undo</button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"><Redo2 size={16}/>Redo</button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"><Save size={16}/>Save</button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-semibold shadow-lg shadow-cyan-500/30"><Download size={16}/>Export</button>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-16">
        <section className="relative h-[48vh] rounded-3xl overflow-hidden mb-8">
          <Spline scene="https://prod.spline.design/EF7JOSsHLk16Tlw9/scene.splinecode" style={{ width: '100%', height: '100%' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 pointer-events-none" />
          <div className="absolute bottom-6 left-6">
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl font-bold tracking-tight">3D Gestural Font Editor</motion.h1>
            <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="text-white/80 mt-2">Pinch + rotate to change modes and tweak your glyph. Feels like a virtual knob.</motion.p>
          </div>
        </section>

        <GestureCanvas />
      </main>

      <div className="fixed inset-x-0 bottom-0 pointer-events-none">
        <div className="mx-auto h-32 w-[90%] rounded-full bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/20 to-cyan-500/20 blur-3xl" />
      </div>
    </div>
  )
}
