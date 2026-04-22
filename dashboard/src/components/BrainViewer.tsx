'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface BrainProps {
  activationLevel?: number; // 0 to 1
  activeRegion?: 'frontal' | 'temporal' | 'visual' | 'all';
}

function BrainPoints({ activationLevel = 0.5, activeRegion = 'all' }: BrainProps) {
  const pointsRef = useRef<THREE.Points>(null!)
  
  const count = 6000
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const cols = new Float32Array(count * 3)
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      // Sphere distribution
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      
      const r = 3 + Math.random() * 0.4
      const x = r * Math.cos(theta) * Math.sin(phi)
      const y = r * Math.sin(theta) * Math.sin(phi)
      const z = r * Math.cos(phi)

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      // Heatmap logic based on position
      // Frontal (x > 1), Visual (x < -1), Temporal (y around 0, lateral)
      let intensity = 0.1
      
      if (activeRegion === 'all' || 
         (activeRegion === 'frontal' && x > 1.5) ||
         (activeRegion === 'visual' && x < -1.5) ||
         (activeRegion === 'temporal' && Math.abs(y) < 1 && Math.abs(z) > 2)) {
        intensity = activationLevel + Math.random() * 0.2
      }

      // Mix Seedtag Coral (#E85D64) with white/blue for intensity
      if (intensity > 0.6) {
        color.setHSL(0.98, 0.8, 0.5 + intensity * 0.2) // Coral/Red hot
      } else {
        color.setHSL(0.6, 0.2, 0.1 + intensity * 0.2) // Muted blue/grey cold
      }
      
      cols[i * 3] = color.r
      cols[i * 3 + 1] = color.g
      cols[i * 3 + 2] = color.b
    }
    return [pos, cols]
  }, [count, activationLevel, activeRegion])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    pointsRef.current.rotation.y = time * 0.05
    // Add pulsing effect to active areas
    const pulse = Math.sin(time * 2) * 0.02
    pointsRef.current.scale.set(1 + pulse, 1 + pulse, 1 + pulse)
  })

  return (
    <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.06}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

function CentralCore({ activationLevel = 0.5 }: { activationLevel?: number }) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh>
        <sphereGeometry args={[2.2, 64, 64]} />
        <MeshDistortMaterial
          color={activationLevel > 0.7 ? "#E85D64" : "#212121"}
          speed={activationLevel * 5}
          distort={0.3 + activationLevel * 0.2}
          radius={1}
          emissive="#E85D64"
          emissiveIntensity={activationLevel}
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  )
}

export default function BrainViewer({ activationLevel, activeRegion }: BrainProps) {
  return (
    <div id="brain-canvas-container">
      <Canvas camera={{ position: [0, 0, 10], fov: 40 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#E85D64" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#444" />
        
        <BrainPoints activationLevel={activationLevel} activeRegion={activeRegion} />
        <CentralCore activationLevel={activationLevel} />
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate 
          autoRotateSpeed={0.3} 
        />
      </Canvas>
    </div>
  )
}
