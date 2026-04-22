import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Activity, 
  Brain, 
  BarChart3, 
  Settings, 
  Upload, 
  Zap, 
  Eye, 
  Layers,
  ChevronRight,
  TrendingUp,
  Target
} from 'lucide-react'
import BrainViewer from '@/components/BrainViewer'
import VideoCortex from '@/components/VideoCortex'

const SidebarItem = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
    active ? 'bg-seedtag-coral text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
  }`}>
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </div>
)

const StatCard = ({ title, value, unit, trend, icon: Icon }: { title: string, value: string, unit: string, trend?: string, icon?: any }) => (
  <div className="glass-card p-5 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
       {Icon && <Icon size={40} className="text-seedtag-coral" />}
    </div>
    <p className="text-gray-400 text-sm mb-1">{title}</p>
    <div className="flex items-baseline gap-2">
      <h3 className="text-2xl font-bold">{value}</h3>
      <span className="text-gray-500 text-sm font-medium">{unit}</span>
    </div>
    {trend && (
      <p className="text-xs mt-2 text-seedtag-coral font-medium flex items-center gap-1">
        <Activity size={12} /> {trend}
      </p>
    )}
  </div>
)

export default function DashboardPage() {
  const [activation, setActivation] = useState(0.4);
  const [region, setRegion] = useState<'frontal' | 'temporal' | 'visual' | 'all'>('all');

  const handleTimeUpdate = useCallback((progress: number) => {
    // Simulate neural flux during "playback"
    const newActivation = 0.3 + (Math.sin(progress / 5) * 0.3) + (Math.random() * 0.1);
    setActivation(newActivation);
    
    // Switch active regions based on progress
    if (progress < 30) setRegion('visual');
    else if (progress < 60) setRegion('temporal');
    else if (progress < 90) setRegion('frontal');
    else setRegion('all');
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black selection:bg-seedtag-coral/30">
      {/* 3D Background */}
      <BrainViewer activationLevel={activation} activeRegion={region} />

      {/* UI Overlay */}
      <div className="ui-layer flex w-full h-full">
        
        {/* Sidebar */}
        <motion.aside 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-64 glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5"
        >
          <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 bg-seedtag-coral rounded-xl flex items-center justify-center shadow-lg shadow-seedtag-coral/20">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">TRIBE <span className="text-seedtag-coral">v2</span></h1>
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1 block">Predictive Foundation</span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarItem icon={Activity} label="Diagnostics" active />
            <SidebarItem icon={BarChart3} label="Neural Insights" />
            <SidebarItem icon={Layers} label="Sample Registry" />
            <SidebarItem icon={Settings} label="System Config" />
          </nav>

          <div className="mt-auto">
            <div className="glass-card p-4 bg-seedtag-coral/10 border-seedtag-coral/20">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs text-seedtag-coral font-bold uppercase tracking-wider">Pro Engine</p>
                <TrendingUp size={14} className="text-seedtag-coral" />
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                Deploy multi-voxel analysis and deep creative heatmaps.
              </p>
              <button className="w-full text-xs font-bold py-2.5 bg-seedtag-coral rounded-lg text-white hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-seedtag-coral/20">
                UPGRADE ENGINE
              </button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-4 relative">
          
          {/* Header */}
          <header className="flex justify-between items-center mb-6 px-4">
            <div>
              <h2 className="text-3xl font-bold text-gradient">Visual Cortex Analysis</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm">Case Study:</span>
                <span className="text-white text-sm font-medium">Nissan Qashqai CTV Early Batch</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Inference Ready</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:border-seedtag-coral/50 transition-colors cursor-pointer">
                <Settings size={18} className="text-gray-400" />
              </div>
            </div>
          </header>

          {/* Video Central Area */}
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-3xl"
            >
              <VideoCortex onTimeUpdate={handleTimeUpdate} />
            </motion.div>
          </div>

          {/* Stats Grid at Bottom */}
          <div className="grid grid-cols-3 gap-6 mb-4 px-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <StatCard title="Attention Prediction" value={`${(activation * 100).toFixed(1)}`} unit="%" trend="+4.2% Peak" icon={Target} />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              <StatCard title="Neural Resonance" value={`${(0.8 + activation * 0.2).toFixed(2)}`} unit="Index" trend="High Impact" icon={Zap} />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              <StatCard title="Region Focus" value={region.toUpperCase()} unit="" trend="Processing" icon={Brain} />
            </motion.div>
          </div>

          {/* Bottom Toolbar */}
          <motion.footer 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="glass-panel p-5 flex items-center justify-between border-white/5"
          >
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Model Confidence</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[92%]" />
                  </div>
                  <span className="text-xs font-bold">92.4%</span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stimuli Resolution</span>
                <span className="text-xs font-medium text-white">4K Neural Tensor (Voxel-Based)</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all font-bold text-sm">
                <Eye size={16} />
                Toggle Voxel View
              </button>
              <button className="flex items-center gap-2 px-8 py-3 bg-seedtag-coral text-white rounded-xl font-bold shadow-lg shadow-seedtag-coral/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm">
                <Upload size={16} />
                Export Full Report
              </button>
            </div>
          </motion.footer>

        </section>

        {/* Right Info Panel */}
        <motion.aside 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-80 glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold flex items-center gap-2">
              <Activity size={18} className="text-seedtag-coral" />
              Live Brain Stream
            </h3>
            <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/10 text-gray-400 font-mono">ID: NZQ-88</span>
          </div>

          <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {['Visual (V1)', 'Temporal (Audio)', 'Frontal (Attention)'].map((name, i) => {
               const isActive = (i === 0 && region === 'visual') || (i === 1 && region === 'temporal') || (i === 2 && region === 'frontal') || region === 'all';
               return (
                <div key={name} className={`flex flex-col gap-3 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">{name}</span>
                    <span className="text-seedtag-coral font-bold font-mono text-xs">
                      {isActive ? (activation * 90 + 10).toFixed(1) : (10).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: isActive ? `${activation * 90 + 10}%` : '10%' }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${isActive ? 'bg-seedtag-coral' : 'bg-gray-600'}`}
                    />
                  </div>
                </div>
               );
            })}

            <div className="pt-8 border-t border-white/5 mt-auto">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Neural Log</h4>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 text-[10px] items-start group">
                    <div className="w-1 h-1 rounded-full bg-seedtag-coral mt-1.5 opacity-40 group-hover:opacity-100" />
                    <span className="text-gray-400 leading-tight">
                      {i === 0 ? "High frequency visual edges detected in V1 layer." : 
                       i === 1 ? "Predictive engagement spike in frontal lobe." :
                       i === 2 ? "Auditory synchronization confirmed at 22ms." :
                       "Neural feedback loop stabilization complete."}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button className="w-full flex items-center justify-center gap-3 py-4 glass-card hover:bg-seedtag-coral/5 hover:border-seedtag-coral/30 text-xs font-bold transition-all group">
              <Layers size={16} className="text-gray-400 group-hover:text-seedtag-coral" />
              Deep Voxel Analysis
            </button>
          </div>
        </motion.aside>

      </div>
    </main>
  )
}

