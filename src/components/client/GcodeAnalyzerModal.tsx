"use client";

import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { Upload, FileCode, Sparkles, Clock, Scale, Thermometer, Layers, Box, Triangle } from 'lucide-react';
import { toast } from 'sonner';

const ModelPreview = lazy(() => import('./ModelPreview').then(module => ({ default: module.ModelPreview })));
import type { ModelGeometryInfo } from './ModelPreview';

interface ParsedGcodeData {
  fileName: string;
  estimatedTimeHours: number | null;
  filamentWeightG: number | null;
  layerCount: number | null;
  nozzleTemp: number | null;
  bedTemp: number | null;
  fileSizeBytes: number;
  slicer: string;
  filePath: string;
}

interface GcodeAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: { nome: string; peso: number; tempo: number; filePath?: string }) => void;
}

const formatFileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${(bytes / 1024).toFixed(0)} KB`
  : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

export const GcodeAnalyzerModal: React.FC<GcodeAnalyzerModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
}) => {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedGcodeData | null>(null);
  const [geometryInfo, setGeometryInfo] = useState<ModelGeometryInfo | null>(null);
  const handleModelInfo = useCallback((info: ModelGeometryInfo) => setGeometryInfo(info), []);

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.companyId) { toast.error('Sua conta ainda não está vinculada a uma empresa.'); return; }
    
    setAnalyzing(true);
    setParsedResult(null);
    setGeometryInfo(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let hours: number | null = null;
      let weight: number | null = null;
      let layers: number | null = null;
      let nozzle: number | null = null;
      let bed: number | null = null;
      let slicer = extension === 'gcode' || extension === 'gco' || extension === 'g' ? 'G-code' : 'Modelo 3D armazenado';

      if (['gcode', 'gco', 'g'].includes(extension || '')) {
        const content = await file.text(); 

        const secondsMatch = content.match(/(?:^|\n);?\s*TIME\s*:\s*(\d+)/i);
        const humanTime = content.match(/estimated printing time(?: \(normal mode\))?\s*=\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
        const printTimeAlt = content.match(/print time\s*[:=]\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);

        if (secondsMatch) {
          hours = Number((Number(secondsMatch[1]) / 3600).toFixed(4));
        } else if (humanTime) {
          const h = Number(humanTime[1] || 0);
          const m = Number(humanTime[2] || 0);
          const s = Number(humanTime[3] || 0);
          hours = Number(((h * 3600 + m * 60 + s) / 3600).toFixed(4));
        } else if (printTimeAlt) {
          const days = Number(printTimeAlt[1] || 0);
          const h = Number(printTimeAlt[2] || 0);
          const m = Number(printTimeAlt[3] || 0);
          const s = Number(printTimeAlt[4] || 0);
          hours = Number(((days * 86400 + h * 3600 + m * 60 + s) / 3600).toFixed(4));
        }

        const weightMatch = content.match(/(?:filament used|total filament weight|filament weight)\s*(?:\[g\])?\s*[:=]\s*([\d.]+)/i);
        const filamentGramMatch = content.match(/([\d.]+)\s*g\s*(?:of filament)?/i);
        
        if (weightMatch) {
          weight = Number(weightMatch[1]);
        } else if (filamentGramMatch && !weight) {
          const potentialWeight = Number(filamentGramMatch[1]);
          if (potentialWeight < 5000) weight = potentialWeight;
        }

        const layerMatch = content.match(/(?:LAYER_COUNT|total_layer_count)\s*[:=]\s*(\d+)/i);
        const nozzleMatch = content.match(/(?:nozzle_temperature|nozzle temp)\s*[:=]\s*([\d.]+)/i);
        const bedMatch = content.match(/(?:bed_temperature|bed temp)\s*[:=]\s*([\d.]+)/i);
        
        if (layerMatch) layers = Number(layerMatch[1]);
        if (nozzleMatch) nozzle = Number(nozzleMatch[1]);
        if (bedMatch) bed = Number(bedMatch[1]);

        if (content.includes('Cura_SteamEngine')) slicer = 'Ultimaker Cura';
        else if (content.includes('PrusaSlicer')) slicer = 'PrusaSlicer';
        else if (content.includes('BambuStudio')) slicer = 'Bambu Studio';
        else if (content.includes('OrcaSlicer')) slicer = 'OrcaSlicer';
      }

      const mockFilePath = `local-browser-parse/${file.name}`;

      setParsedResult({
        fileName: file.name.replace(/\.[^.]+$/, ''),
        estimatedTimeHours: hours,
        filamentWeightG: weight,
        layerCount: layers,
        nozzleTemp: nozzle,
        bedTemp: bed,
        fileSizeBytes: file.size,
        slicer,
        filePath: mockFilePath,
      });

      toast.success('Arquivo analisado com sucesso no navegador!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao analisar o arquivo.');
    } finally {
      setAnalyzing(false);
      event.target.value = '';
    }
  };

  const handleConfirm = () => {
    if (!parsedResult) return;
    if (parsedResult.filamentWeightG === null || parsedResult.filamentWeightG <= 0 || parsedResult.estimatedTimeHours === null || parsedResult.estimatedTimeHours <= 0) {
      toast.error('Informe peso e tempo estimado maiores que zero antes de preencher a calculadora.');
      return;
    }
    onApplyData({
      nome: parsedResult.fileName,
      peso: parsedResult.filamentWeightG,
      tempo: parsedResult.estimatedTimeHours,
      filePath: parsedResult.filePath,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Importar Dados do Fatiador</h3>
              <p className="text-xs text-slate-400">STL, 3MF e G-code · processamento local</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        {!parsedResult && (
          <label className="border-2 border-dashed border-slate-750 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60 group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3 transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-white">
              {analyzing ? 'Analisando arquivo...' : 'Selecione um modelo ou G-code'}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              OrcaSlicer, Bambu Studio, Cura, PrusaSlicer ou Simplify3D
            </span>
            <input
              type="file"
              accept=".stl,.3mf,.gcode,.gco,.g"
              onChange={handleFileUpload}
              className="hidden"
              disabled={analyzing}
            />
          </label>
        )}

        {parsedResult && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              {['stl', '3mf'].includes(parsedResult.filePath.split('.').pop()?.toLowerCase() || '') && <Suspense fallback={<p className="text-xs text-slate-400" role="status">Preparando prévia 3D…</p>}><ModelPreview filePath={parsedResult.filePath} onModelInfo={handleModelInfo} /></Suspense>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Tamanho do arquivo: <strong className="text-slate-200">{formatFileSize(parsedResult.fileSizeBytes)}</strong></span>
                {geometryInfo && <span>Dimensões (X × Y × Z): <strong className="text-slate-200">{geometryInfo.sizeXmm} × {geometryInfo.sizeYmm} × {geometryInfo.sizeZmm} mm</strong></span>}
              </div>
              {geometryInfo && <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-300"><Box className="h-4 w-4 text-indigo-400" /><span>Envelope máximo: <strong className="text-white">{(geometryInfo.sizeXmm * geometryInfo.sizeYmm * geometryInfo.sizeZmm).toLocaleString('pt-BR')} mm³</strong></span></div>
                <div className="flex items-center gap-2 text-xs text-slate-300"><Triangle className="h-4 w-4 text-cyan-400" /><span>Triângulos: <strong className="text-white">{geometryInfo.triangleCount.toLocaleString('pt-BR')}</strong></span></div>
              </div>}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-slate-400">Arquivo Detectado:</span>
                  <p className="text-sm font-bold text-white truncate max-w-[280px]">
                    {parsedResult.fileName}
                  </p>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                  {parsedResult.slicer}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 rounded-xl bg-slate-900/80 text-center">
                  <Scale className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 block">Peso Total</span>
                  <Input aria-label="Peso de filamento em gramas" type="number" min="0" step="0.1" placeholder="Sem dado" value={parsedResult.filamentWeightG ?? ''} onChange={event => setParsedResult(prev => prev && ({ ...prev, filamentWeightG: event.target.value === '' ? null : Number(event.target.value) }))} className="h-7 text-center text-xs font-bold bg-slate-950 border-slate-700" />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 text-center">
                  <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 block">Tempo Est. (h)</span>
                  <Input aria-label="Tempo estimado em horas" type="number" min="0" step="0.1" placeholder="Sem dado" value={parsedResult.estimatedTimeHours ?? ''} onChange={event => setParsedResult(prev => prev && ({ ...prev, estimatedTimeHours: event.target.value === '' ? null : Number(event.target.value) }))} className="h-7 text-center text-xs font-bold bg-slate-950 border-slate-700" />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 text-center">
                  <Layers className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 block">Camadas</span>
                  <span className="text-xs font-black text-white">{parsedResult.layerCount ?? '—'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 text-center">
                  <Thermometer className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 block">Bico / Mesa</span>
                  <span className="text-xs font-black text-white">{parsedResult.nozzleTemp !== null || parsedResult.bedTemp !== null ? `${parsedResult.nozzleTemp ?? '—'}° / ${parsedResult.bedTemp ?? '—'}°` : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setParsedResult(null)}
                className="w-1/3 bg-slate-950 border-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Outro Arquivo
              </Button>
              <Button
                onClick={handleConfirm}
                className="w-2/3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Preencher Calculadora
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};