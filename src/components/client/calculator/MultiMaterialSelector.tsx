"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layers, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { ProjectMaterial, FilamentoEstoque } from '@/types/saas';

interface MultiMaterialSelectorProps {
  materials: ProjectMaterial[];
  filamentos: FilamentoEstoque[];
  onAddMaterial: () => void;
  onRemoveMaterial: (matId: string) => void;
  onUpdateMaterial: (matId: string, field: 'materialId' | 'weightGrams', value: string | number) => void;
}

export const MultiMaterialSelector: React.FC<MultiMaterialSelectorProps> = ({
  materials,
  filamentos,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterial,
}) => {
  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <div>
            <h3 className="font-bold text-white text-sm">
              Materiais & Cores da Peça ({materials.length}/4 materiais selecionados)
            </h3>
            <p className="text-[11px] text-slate-400">
              Vincule carretéis do seu estoque de PLA, PETG, ABS, TPU ou Resina UV
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={materials.length >= 4}
          onClick={onAddMaterial}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-xl h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {materials.length >= 4 ? 'Limite de 4 Atingido' : '+ Adicionar Cor / Material'}
        </Button>
      </div>

      <div className="space-y-3">
        {materials.map((mat, index) => {
          const filamentoVisto = filamentos.find(f => f.id === mat.materialId);
          const currentWeight = Number(mat.weightGrams) || 0;
          const isEstoqueBaixo = currentWeight > 0 && filamentoVisto && filamentoVisto.pesoRestanteG < currentWeight;

          return (
            <div
              key={mat.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-black flex items-center justify-center border border-slate-700">
                    #{index + 1}
                  </span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: mat.colorHex || '#6366f1' }}
                  />
                  <span className="font-bold text-xs text-white">
                    Cor {index + 1}: {mat.color} ({mat.filamentType})
                  </span>
                </div>

                {materials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveMaterial(mat.id)}
                    className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                    title="Remover material"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                {/* Seletor de Carretel no Estoque */}
                <div className="sm:col-span-7">
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                    Carretel do Estoque (Tipo / Cor / Preço)
                  </label>
                  <select
                    value={mat.materialId || ''}
                    onChange={e => onUpdateMaterial(mat.id, 'materialId', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 text-white text-xs rounded-xl h-9 px-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {filamentos.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.tipo} • {f.cor} • R$ {f.precoKg.toFixed(2)}/kg [{f.pesoRestanteG}g livres]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Peso em gramas */}
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                    Peso Utilizado (g)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="0"
                    value={mat.weightGrams ?? ''}
                    onChange={e => onUpdateMaterial(mat.id, 'weightGrams', e.target.value)}
                    className="bg-slate-900 border-slate-750 text-white text-xs rounded-xl h-9 font-bold text-indigo-400"
                  />
                </div>

                {/* Subtotal do material */}
                <div className="sm:col-span-2 flex flex-col justify-end text-right">
                  <span className="text-[10px] text-slate-400">Subtotal:</span>
                  <span className="font-bold text-white text-xs">
                    R$ {(mat.totalCost || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {isEstoqueBaixo && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg flex items-center gap-1.5 font-medium mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Aviso: O carretel {filamentoVisto?.tipo} ({filamentoVisto?.cor}) possui apenas {filamentoVisto?.pesoRestanteG}g disponíveis para {currentWeight}g solicitados.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};