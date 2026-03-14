import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function FloatingSigils() {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.2
      groupRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.5) * 0.1
      groupRef.current.position.y = Math.sin(clock.getElapsedTime()) * 0.5
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -5]}>
      <mesh>
        <torusGeometry args={[3, 0.02, 16, 100]} />
        <meshBasicMaterial color={[0.62, 0.5, 1]} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.01, 16, 100]} />
        <meshBasicMaterial color={[0.48, 0.9, 1]} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, Math.PI / 4, Math.PI / 4]}>
        <torusGeometry args={[1.8, 0.015, 16, 100]} />
        <meshBasicMaterial color={[1, 0.53, 0.8]} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Center glowing core */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color={[0.62, 0.5, 1]} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

// Ensure the 3D canvas does not intercept pointer events meant for editor selection unless it needs to 
export function StageThreeBackdrop() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
      <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <FloatingSigils />
      </Canvas>
    </div>
  )
}
