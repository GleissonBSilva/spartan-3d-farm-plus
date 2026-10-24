"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Box, ImagePlus, X, Clock3 } from 'lucide-react';
import { Impressora3D } from '@/types/saas';
import { PricingService } from '@/services/pricingService';

interface PieceDetailsFormProps {
  nomePeca: string;
  setNomePeca: (val: string) => void;
  clienteNome: string;
  setClienteNome: (val: string) => void;
  clienteContato?: string;
  setClienteContato?: (val: string) => void;
  selectedImpressoraId: string;
  setSelectedImpressoraId: (val: string) => void;
  tempoHoras: number | string;
  setTempoHoras: (val: number | string) => void;
  impressoras: Impressora3D[];
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
}

export const PieceDetailsForm: React.FC<PieceDetailsFormProps> = ({
  nomePeca,
  setNomePeca,
  clienteNome,
  setClienteNome,
  clienteContato = '',
  setClienteContato,
  selectedImpressoraId,
  setSelectedImpressoraId,
  tempoHoras,
  setTempoHoras,
  impressoras,
  imageFile,
  setImageFile,
}) => {
  const [imagePreview, setImagePreview] = useState('');
  const [timeMode, setTimeMode] = useState<'hm' | 'text'>('hm');
  const [horasInput, setHorasInput] = useState<string>('');
  const [minutosInput, setMinutosInput] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');

  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Sincroniza os inputs internos quando tempoHoras for alterado de fora (ex: G-Code, edição ou reset)
  useEffect(() => {
    if (tempoHoras === '' || tempoHoras === 0 || tempoHoras === '0') {
      setHorasInput('');
      setMinutosInput('');
      setTextInput('');
      return;
    }

    const dec = PricingService.parseTimeToDecimal(tempoHoras);
    if (dec > 0) {
      const totalMinutes = Math.round(dec * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;

      const currentH = horasInput === '' ? 0 : parseInt(horasInput, 10) || 0;
      const currentM = minutosInput === '' ? 0 : parseInt(minutosInput, 10) || 0;
      const currentTotalMin = currentH * 60 + currentM;

      if (currentTotalMin !== totalMinutes) {
        setHorasInput(h === 0 ? '' : String(h));
        setMinutosInput(m === 0 ? '' : String(m));
        setTextInput(h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`);
      }
    }
  }, [tempoHoras]);

  const handleHorasChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setHorasInput(clean);

    const h = clean === '' ? 0 : parseInt(clean, 10) || 0;
    const m = minutosInput === '' ? 0 : parseInt(minutosInput, 10) || 0;

    if (clean === '' && minutosInput === '') {
      setTempoHoras('');
      setTextInput('');
    } else {
      const dec = h + (m / 60);
      setTempoHoras(dec);
      setTextInput(h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`);
    }
  };

  const handleMinutosChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setMinutosInput(clean);

    const m = clean === '' ? 0 : parseInt(clean, 10) || 0;
    const h = horasInput === '' ? 0 : parseInt(horasInput, 10) || 0;

    if (horasInput === '' && clean === '') {
      setTempoHoras('');
      setTextInput('');
    } else {
      const dec = h + (m / 60);
      setTempoHoras(dec);
      setTextInput(h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`);
    }
  };

  const handleTextChange = (val: string) => {
    setTextInput(val);
    if (!val.trim()) {
      setTempoHoras('');
      setHorasInput('');
      setMinutosInput('');
      return;
    }

    const dec = PricingService.parseTimeToDecimal(val);
    setTempoHoras(val === '' ? '' : dec);
    if (dec > 0) {
      const totalMin = Math.round(dec * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setHorasInput(h === 0 ? '' : String(h));
      setMinutosInput(m === 0 ? '' : String(m));
    }
  };

  const decimalHours = PricingService.parseTimeToDecimal(tempoHoras);
  const totalMinutes = Math.round(decimalHours * 60);
  const displayH = Math.floor(totalMinutes / 60);
  const displayM = totalMinutes % 60;

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Box className="w-4 h-4 text-indigo-400" />
        <h3 className="font-bold text-white text-sm">Dados da Peça & Cliente</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Nome da Peça / Arquivo STL
          </label>
          <Input
            required
            value={nomePeca}
            onChange={e => setNomePeca(e.target.value)}
            placeholder="Ex: Luminária Voronoi 4 Cores"
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Cliente / Solicitante <span className="text-[10px] font-normal text-slate-500">(Opcional)</span>
          </label>
          <Input
            value={clienteNome}
            onChange={e => setClienteNome(e.target.value)}
            placeholder="Ex: Mariana Silva Arquitetura"
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Contato do Cliente <span className="text-[10px] font-normal text-slate-500">(Opcional)</span>
          </label>
          <Input
            type="tel"
            value={clienteContato}
            onChange={e => setClienteContato?.(e.target.value)}
            placeholder="Ex: (11) 99999-9999"
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10"
          />
        </div>
      </div>

      <div>
        <label htmlFor="project-image" className="text-xs font-semibold text-slate-300 block mb-1.5">Imagem de referência do produto</label>
        <input id="project-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={event => { const file = event.target.files?.[0]; if (file) setImageFile(file); event.target.value = ''; }} />
        {imagePreview ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
            <img src={imagePreview} alt="Prévia do produto" className="h-20 w-20 rounded-lg object-cover" />
            <span className="flex-1 truncate text-xs text-slate-300">{imageFile?.name}</span>
            <label htmlFor="project-image" className="cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-xs text-indigo-200 hover:bg-slate-800">Trocar imagem</label>
            <button type="button" aria-label="Remover imagem" onClick={() => setImageFile(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label htmlFor="project-image" className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300 hover:border-indigo-500 hover:text-white">
            <ImagePlus className="h-5 w-5 text-indigo-400" />
            <span>Adicionar foto ou render do produto <span className="block text-xs text-slate-500">JPG, PNG ou WebP · até 50 MB</span></span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-300 block">
              Impressora Alocada na Farm
            </label>
            <span className="text-[10px] text-indigo-400 font-medium">
              (Opcional no orçamento)
            </span>
          </div>
          <select
            value={selectedImpressoraId}
            onChange={e => setSelectedImpressoraId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-750 text-white text-xs rounded-xl h-10 px-3 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Definir na aprovação (Estimativa padrão: 350W)</option>
            {impressoras.map(i => (
              <option key={i.id} value={i.id}>
                {i.nome} ({i.potenciaWatts}W · {i.status === 'disponivel' ? '🟢 Disponível' : i.status === 'imprimindo' ? '🟡 Em impressão' : '⚪ ' + i.status})
              </option>
            ))}
          </select>
        </div>

        {/* CAMPO DE TEMPO DE IMPRESSÃO / FATIAMENTO */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-300 block">
              Tempo Total de Fatiamento
            </label>
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setTimeMode('hm')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  timeMode === 'hm'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Horas + Min
              </button>
              <button
                type="button"
                onClick={() => setTimeMode('text')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  timeMode === 'text'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Livre (02:30)
              </button>
            </div>
          </div>

          {timeMode === 'hm' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={horasInput}
                  onChange={e => handleHorasChange(e.target.value)}
                  className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 font-bold text-amber-400 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                  h
                </span>
              </div>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={minutosInput}
                  onChange={e => handleMinutosChange(e.target.value)}
                  className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 font-bold text-amber-400 pr-10"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                  min
                </span>
              </div>
            </div>
          ) : (
            <Input
              type="text"
              placeholder="Ex: 02:30 ou 1h 45m ou 2.5"
              value={textInput}
              onChange={e => handleTextChange(e.target.value)}
              className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 font-bold text-amber-400"
            />
          )}

          {/* Prévia amigável e confirmação visual em tempo real */}
          {decimalHours > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">
              <Clock3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Tempo: <strong className="text-white">{displayH > 0 ? `${displayH}h ` : ''}{displayM}m</strong>{' '}
                <span className="text-slate-400 text-[11px]">({decimalHours.toFixed(2)}h de máquina)</span>
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 block mt-1">
              Informe as horas e minutos estimados pelo fatiador
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
