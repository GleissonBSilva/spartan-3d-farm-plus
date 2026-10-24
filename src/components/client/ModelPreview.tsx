import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { createModelSignedUrl } from '@/services/fileService';

export interface ModelGeometryInfo {
  sizeXmm: number;
  sizeYmm: number;
  sizeZmm: number;
  triangleCount: number;
}

interface ModelPreviewProps {
  filePath: string;
  onModelInfo?: (info: ModelGeometryInfo) => void;
  onLoadError?: () => void;
}

export const ModelPreview: React.FC<ModelPreviewProps> = ({ filePath, onModelInfo, onLoadError }) => {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    setObject(null);
    setError('');
    const load = async () => {
      try {
        const url = await createModelSignedUrl(filePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Não foi possível carregar a prévia do modelo.');
        const bytes = await response.arrayBuffer();
        const extension = filePath.split('.').pop()?.toLowerCase();
        let model: THREE.Object3D;
        if (extension === 'stl') {
          const geometry = new STLLoader().parse(bytes);
          geometry.computeVertexNormals();
          model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.1, roughness: 0.55 }));
        } else if (extension === '3mf') {
          model = new ThreeMFLoader().parse(bytes);
        } else return;

        model.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          child.visible = true;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          }
        });
        let meshCount = 0;
        model.traverse(child => { if (child instanceof THREE.Mesh) meshCount += 1; });
        if (!meshCount) throw new Error('Este arquivo não contém uma geometria 3D visualizável.');
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        if (bounds.isEmpty() || ![size.x, size.y, size.z].every(Number.isFinite) || Math.max(size.x, size.y, size.z) <= 0) {
          throw new Error('Não foi possível identificar a geometria 3D deste arquivo.');
        }
        let triangleCount = 0;
        model.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const geometry = child.geometry;
            triangleCount += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count || 0) / 3;
          }
        });
        onModelInfo?.({
          sizeXmm: Number(size.x.toFixed(2)),
          sizeYmm: Number(size.y.toFixed(2)),
          sizeZmm: Number(size.z.toFixed(2)),
          triangleCount: Math.round(triangleCount),
        });

        const center = bounds.getCenter(new THREE.Vector3());
        const largestAxis = Math.max(size.x, size.y, size.z) || 1;
        const normalized = new THREE.Group();
        normalized.add(model);
        normalized.scale.setScalar(2.4 / largestAxis);
        normalized.position.set(-center.x * normalized.scale.x, -center.y * normalized.scale.y, -center.z * normalized.scale.z);
        normalized.updateMatrixWorld(true);
        if (!disposed) setObject(normalized);
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : 'Falha na prévia do arquivo.');
          onLoadError?.();
        }
      }
    };
    void load();
    return () => { disposed = true; };
  }, [filePath, onModelInfo, onLoadError]);

  if (error) return <p className="rounded-lg bg-slate-950 p-3 text-xs text-rose-300" role="status">{error}</p>;
  if (!object) return <p className="rounded-lg bg-slate-950 p-3 text-xs text-slate-400" role="status">Carregando prévia 3D…</p>;
  return <div className="h-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-950" aria-label="Prévia 3D do arquivo">
    <Canvas camera={{ position: [3, 2.4, 3], fov: 45, near: 0.01, far: 100 }}>
      <color attach="background" args={['#030712']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 6, 5]} intensity={2} />
      <Bounds fit clip observe margin={1.35}>
        <primitive object={object} />
      </Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  </div>;
};
