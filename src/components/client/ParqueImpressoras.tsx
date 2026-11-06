"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, CirclePower, Clock3, Cpu, History, Pause, Play, Plus, Wrench, X, DollarSign, Trash2, Edit2, Wifi, Radio, Eye, EyeOff, RefreshCw, Thermometer, Fan, Layers, Disc, Package, FileText } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { Impressora3D, FilamentoEstoque, ProjectMaterial, ProjetoImpressao3D } from '@/types/saas';
import { toast } from 'sonner';
import { ModalRegistrarFalha } from './ModalRegistrarFalha';

const MAINTENANCE_TASKS = ['Desentupir bico / Cold pull', 'Trocar bico', 'Limpar bico', 'Lubrificar eixos', 'Limpar mesa', 'Verificar correias', 'Verificar ventiladores'];
const STATUS: Record<Impressora3D['status'], { label: string; badge: string; dot: string }> = {
  disponivel: { label: 'Disponível', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  imprimindo: { label: 'Imprimindo', badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400' },
  pausada: { label: 'Pausada', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  manutencao: { label: 'Manutenção', badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300', dot: 'bg-orange-400' },
  desconectada: { label: 'Offline', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
};

const parseAndSanitizeEstimatedSeconds = (inputTime: number | string): number => {
  let totalSeconds = 0;
  if (typeof inputTime === 'string' && inputTime.includes(':')) {
    const parts = inputTime.split(':').map(Number);
    totalSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else {
    const numericValue = Number(inputTime) || 0;
    totalSeconds = numericValue > 1000 && !String(inputTime).includes('.') ? numericValue : Math.round(numericValue * 3600);
  }
  return totalSeconds > 720 * 3600 || isNaN(totalSeconds) || totalSeconds < 0 ? 18 * 3600 : totalSeconds;
};

const formatSecondsToTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
};

const formatHours = (inputTime: number | string) => formatSecondsToTime(parseAndSanitizeEstimatedSeconds(inputTime));

interface AmsTray {
  id: string;
  color: string;
  type: string;
  subBrand: string;
  remain: number;
  active: boolean;
  loaded: boolean;
}

interface AmsUnit {
  id: string;
  humidity?: string;
  temp?: string;
  trays: AmsTray[];
}

interface PrinterTelemetry {
  gcodeState: string;
  nozzleTemp: number | null;
  nozzleTargetTemp: number | null;
  bedTemp: number | null;
  bedTargetTemp: number | null;
  progressPercent: number | null;
  remainingTimeMinutes: number | null;
  subtaskName: string | null;
  layerNum: number | null;
  totalLayerNum: number | null;
  fanSpeed?: number | null;
  ams?: AmsUnit[];
  activeTray?: string | null;
  lastUpdated: number;
}

import { useAuth } from '@/context/AuthContext';

export const ParqueImpressoras: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    impressoras: rawImpressoras,
    projetos,
    filamentos,
    movimentacoes,
    consumirFilamento,
    consumirMultiplosFilamentos,
    historicoImpressoras,
    addImpressora,
    updateImpressora,
    deleteImpressora,
    updateImpressoraStatus,
    updatePrinterProgress,
    recordMaintenance,
    updateProjetoStatus,
    refreshFarmData,
  } = useSaaSData();
  
  // Mapa de telemetria ao vivo da impressora (Bambu Lab / Klipper)
  const [telemetryMap, setTelemetryMap] = useState<Record<string, PrinterTelemetry>>({});

  // Estado local para exclusão manual garantida e metadados customizados (estritamente isolados por user.id)
  const [deletedPrinterIds, setDeletedPrinterIds] = useState<string[]>([]);
  const [customInvestments, setCustomInvestments] = useState<Record<string, { custoInvestimento: number; vidaUtilHoras: number; depreciacaoHora: number }>>({});
  const [customConnections, setCustomConnections] = useState<Record<string, { tipoConexao?: Impressora3D['tipoConexao']; ipRede?: string; serialNumber?: string; accessCode?: string }>>({});

  useEffect(() => {
    if (!user?.id) {
      setDeletedPrinterIds([]);
      setCustomInvestments({});
      setCustomConnections({});
      return;
    }
    try {
      const savedDel = localStorage.getItem(`ph3d_deleted_printers_${user.id}`);
      setDeletedPrinterIds(savedDel ? JSON.parse(savedDel) : []);

      const savedInv = localStorage.getItem(`ph3d_printer_investments_v2_${user.id}`);
      setCustomInvestments(savedInv ? JSON.parse(savedInv) : {});

      const savedConn = localStorage.getItem(`ph3d_printer_connections_${user.id}`);
      setCustomConnections(savedConn ? JSON.parse(savedConn) : {});
    } catch (e) {
      console.error('Erro ao carregar dados do parque de impressoras do localStorage:', e);
    }
  }, [user?.id]);

  // Filtra as impressoras removendo as que foram marcadas como deletadas localmente
  // e garante vínculo automático caso haja um projeto 'em_impressao' alocado para a máquina
  const impressoras = useMemo(() => {
    return rawImpressoras
      .filter(p => !deletedPrinterIds.includes(p.id))
      .map(p => {
        const custom = customInvestments[p.id];
        const conn = customConnections[p.id];
        const isBambu = (conn?.tipoConexao || p.tipoConexao) === 'bambu_lab';
        const liveT = telemetryMap[p.id];
        const liveGState = isBambu && liveT?.gcodeState ? liveT.gcodeState.toUpperCase() : null;

        const isPhysicallyIdle = liveGState === 'IDLE' || liveGState === 'FAILED' || liveGState === 'FINISH';
        const isPhysicallyPrinting = liveGState === 'RUNNING' || liveGState === 'PREPARE';
        const isPhysicallyPaused = liveGState === 'PAUSE';

        const activeProjForPrinter = isPhysicallyIdle
          ? undefined
          : (projetos.find(
              proj =>
                proj.status === 'em_impressao' &&
                (proj.id === p.projetoAtualId || proj.impressoraId === p.id)
            ) ||
            (p.status === 'imprimindo' || p.status === 'pausada'
              ? projetos.find(proj => proj.status === 'em_impressao' && proj.impressoraId === p.id)
              : undefined));

        let effectiveStatus: Impressora3D['status'] = p.status;
        if (isPhysicallyIdle) {
          effectiveStatus = p.status === 'manutencao' ? 'manutencao' : 'disponivel';
        } else if (isPhysicallyPrinting) {
          effectiveStatus = 'imprimindo';
        } else if (isPhysicallyPaused) {
          effectiveStatus = 'pausada';
        } else if (activeProjForPrinter && p.status === 'disponivel') {
          effectiveStatus = 'imprimindo';
        }

        const resolvedProjectId = isPhysicallyIdle
          ? undefined
          : (activeProjForPrinter?.id || p.projetoAtualId || ((effectiveStatus === 'imprimindo' || effectiveStatus === 'pausada') ? `bambu_${p.id}` : undefined));

        const resolvedProjectName = isPhysicallyIdle
          ? undefined
          : (liveT?.subtaskName || activeProjForPrinter?.nomePeca || p.projetoAtual || (resolvedProjectId ? 'Projeto em produção' : undefined));

        const basePrinter: Impressora3D = {
          ...p,
          status: effectiveStatus,
          projetoAtualId: resolvedProjectId,
          projetoAtual: resolvedProjectName,
          tipoConexao: conn?.tipoConexao || p.tipoConexao || 'manual',
          ipRede: conn?.ipRede || p.ipRede,
          serialNumber: conn?.serialNumber || p.serialNumber,
          accessCode: conn?.accessCode || p.accessCode,
        };

        if (custom && custom.custoInvestimento > 0) {
          return {
            ...basePrinter,
            custoInvestimento: custom.custoInvestimento,
            vidaUtilHoras: custom.vidaUtilHoras,
            depreciacaoHora: custom.depreciacaoHora
          };
        }
        return basePrinter;
      });
  }, [rawImpressoras, deletedPrinterIds, customInvestments, customConnections, projetos, telemetryMap]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [tipoConexao, setTipoConexao] = useState<Impressora3D['tipoConexao']>('manual');
  const [ipRede, setIpRede] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);

  const [maintenancePrinter, setMaintenancePrinter] = useState<string | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<string[]>([]);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({});
  const [failureModalPrinter, setFailureModalPrinter] = useState<Impressora3D | null>(null);
  
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editPotencia, setEditPotencia] = useState<number | string>(350);
  const [editBico, setEditBico] = useState<number | string>(0.4);
  const [editPrecoCompra, setEditPrecoCompra] = useState<number | string>(5000);
  const [editVidaUtil, setEditVidaUtil] = useState<number | string>(5000);
  const [editIntervaloManutencao, setEditIntervaloManutencao] = useState<number | string>(100);
  const [editHorasUso, setEditHorasUso] = useState<number | string>(0);
  const [editTipoConexao, setEditTipoConexao] = useState<Impressora3D['tipoConexao']>('manual');
  const [editIpRede, setEditIpRede] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editAccessCode, setEditAccessCode] = useState('');
  const [editShowAccessCode, setEditShowAccessCode] = useState(false);
  const [editTab, setEditTab] = useState<'geral' | 'rede'>('geral');

  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [printerOnlineMap, setPrinterOnlineMap] = useState<Record<string, boolean>>({});

  const handleTestConnection = async (printerId: string, ip: string, tipo: string = 'bambu_lab', code?: string) => {
    if (!ip.trim()) {
      toast.error('Informe o IP da impressora para testar a comunicação.');
      return;
    }
    setTestingPrinterId(printerId);
    try {
      const cleanIp = ip.replace(/^https?:\/\//, '').split(':')[0].trim();
      const res = await fetch(`/api/printer/ping?ip=${encodeURIComponent(cleanIp)}&type=${encodeURIComponent(tipo)}&accessCode=${encodeURIComponent(code || '')}`);
      const data = await res.json();
      if (data.success) {
        setPrinterOnlineMap(prev => ({ ...prev, [printerId]: true }));
        toast.success(`✅ ${data.message || `A impressora (${cleanIp}) está respondendo perfeitamente na rede!`}`);
      } else {
        setPrinterOnlineMap(prev => ({ ...prev, [printerId]: false }));
        toast.error(`❌ ${data.error || `Não foi possível comunicar com o IP ${cleanIp}`}`);
      }
    } catch (error) {
      setPrinterOnlineMap(prev => ({ ...prev, [printerId]: false }));
      toast.error(`Falha ao testar conexão: ${error instanceof Error ? error.message : 'Erro inesperado'}`);
    } finally {
      setTestingPrinterId(null);
    }
  };

  const [remainingSecondsMap, setRemainingSecondsMap] = useState<Record<string, number>>({});
  const completingPrintersRef = React.useRef<Set<string>>(new Set());
  const lastSyncedStatusRef = React.useRef<Record<string, string>>({});

  const getTimerStorageKey = () => (user?.id ? `ph3d_active_print_timers_${user.id}` : null);

  const readStoredTimers = (): Record<string, { projectId: string; targetEndMs: number; pausedRemainingSecs?: number; totalSecs: number }> => {
    const key = getTimerStorageKey();
    if (!key) return {};
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const writeStoredTimers = (timers: Record<string, { projectId: string; targetEndMs: number; pausedRemainingSecs?: number; totalSecs: number }>) => {
    const key = getTimerStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(timers));
    } catch {
      // ignore storage quota errors
    }
  };

  const handleConcluirTrabalho = async (printer: Impressora3D, isAuto = false, telemetryPayload?: PrinterTelemetry) => {
    if (completingPrintersRef.current.has(printer.id)) return;
    completingPrintersRef.current.add(printer.id);

    const rawProjectId = printer.projetoAtualId && !printer.projetoAtualId.startsWith('active_') && !printer.projetoAtualId.startsWith('bambu_')
      ? printer.projetoAtualId
      : projetos.find(proj => (proj.impressoraId === printer.id || !proj.impressoraId) && proj.status === 'em_impressao')?.id;
    const currentProject = projetos.find(proj => proj.id === rawProjectId);
    const projectName = currentProject?.nomePeca || printer.projetoAtual || telemetryPayload?.subtaskName || 'Impressão 3D';

    try {
      // 1. Zera e limpa do mapa de contagem local e do localStorage
      setRemainingSecondsMap(prev => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });
      setProgressDraft(prev => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });
      const stored = readStoredTimers();
      if (stored[printer.id]) {
        delete stored[printer.id];
        writeStoredTimers(stored);
      }

      // 2. BAIXA AUTOMÁTICA NO CONSUMO DE ESTOQUE
      let stockDeductedGrams = 0;
      let stockFilamentLabel = '';

      if (currentProject?.materials && currentProject.materials.length > 0) {
        // Se o projeto possui lista de materiais definidos
        consumirMultiplosFilamentos(currentProject.materials);
        stockDeductedGrams = currentProject.materials.reduce((acc, m) => acc + (m.weightGrams || 0), 0);
        stockFilamentLabel = currentProject.materials.map(m => `${m.filamentType} ${m.color || ''}`).join(', ');
      } else if (currentProject && currentProject.pesoEstimadoG > 0) {
        // Projeto com peso estimado sem materials detalhados
        const targetSpool = filamentos.find(f => f.tipo.toUpperCase() === 'PLA') || filamentos[0];
        if (targetSpool) {
          consumirFilamento(targetSpool.id, currentProject.pesoEstimadoG);
          stockDeductedGrams = currentProject.pesoEstimadoG;
          stockFilamentLabel = `${targetSpool.tipo} ${targetSpool.cor}`;
        }
      } else {
        // Impressão direta do Bambu Studio (via AMS Lite ou carretel avulso)
        const activeTrayId = telemetryPayload?.activeTray;
        const activeTray = telemetryPayload?.ams?.[0]?.trays?.find(t => String(t.id) === String(activeTrayId) || t.active);
        
        const matchingSpool = activeTray
          ? filamentos.find(f => 
              f.tipo.toUpperCase() === (activeTray.type || 'PLA').toUpperCase() && 
              (activeTray.color ? f.corHex?.toLowerCase().replace('#', '') === activeTray.color.toLowerCase().replace('#', '').slice(0, 6) : true)
            ) || filamentos.find(f => f.tipo.toUpperCase() === (activeTray.type || 'PLA').toUpperCase())
          : filamentos[0];

        if (matchingSpool) {
          const autoWeight = currentProject?.pesoEstimadoG && currentProject.pesoEstimadoG > 0
            ? currentProject.pesoEstimadoG
            : (telemetryPayload?.totalLayerNum ? Math.max(15, Math.round(telemetryPayload.totalLayerNum * 0.6)) : 45);
          consumirFilamento(matchingSpool.id, autoWeight);
          stockDeductedGrams = autoWeight;
          stockFilamentLabel = `${matchingSpool.tipo} ${matchingSpool.cor}`;
        }
      }

      // 3. Dá baixa no projeto e libera a impressora para 'disponivel'
      lastSyncedStatusRef.current[printer.id] = 'disponivel';
      if (rawProjectId && !rawProjectId.startsWith('bambu_') && !rawProjectId.startsWith('active_')) {
        await updateProjetoStatus(rawProjectId, 'concluido');
      } else {
        updateImpressoraStatus(printer.id, 'disponivel');
      }

      await refreshFarmData();

      const stockNotice = stockDeductedGrams > 0 
        ? ` · 📦 Baixa no estoque: -${stockDeductedGrams}g (${stockFilamentLabel})` 
        : '';

      if (isAuto) {
        toast.success(
          `⏰ Impressão concluída! A peça "${projectName}" foi finalizada na impressora ${printer.nome}.${stockNotice}`,
          { duration: 6000 }
        );
      } else {
        toast.success(
          `✅ Impressão de "${projectName}" concluída com sucesso! Impressora ${printer.nome} liberada.${stockNotice}`,
          { duration: 5000 }
        );
      }
    } catch (e) {
      console.error('Erro ao concluir trabalho da impressora:', e);
      toast.error('Erro ao registrar a conclusão da impressão e baixa de estoque.');
    } finally {
      setTimeout(() => {
        completingPrintersRef.current.delete(printer.id);
      }, 3000);
    }
  };

  const handleCriarOrcamento = (
    printer: Impressora3D,
    rawPieceName?: string | null,
    spool?: FilamentoEstoque | null,
    weightGrams?: number,
    estimatedSeconds?: number
  ) => {
    const cleanName = (rawPieceName || 'Peça Bambu Studio').replace(/\.(gcode|3mf|stl)$/i, '').trim();
    const durationHours = estimatedSeconds ? Number((estimatedSeconds / 3600).toFixed(2)) : 1.5;
    const finalWeight = weightGrams && weightGrams > 0 ? weightGrams : 45;

    const materialsList: ProjectMaterial[] = spool ? [{
      id: crypto.randomUUID(),
      materialId: spool.id,
      materialName: `${spool.tipo} - ${spool.cor}`,
      filamentType: spool.tipo,
      color: spool.cor,
      colorHex: spool.corHex,
      weightGrams: finalWeight,
      costPerGram: Number((spool.precoKg / 1000).toFixed(4)),
      totalCost: Number(((spool.precoKg / 1000) * finalWeight).toFixed(2)),
    }] : (filamentos[0] ? [{
      id: crypto.randomUUID(),
      materialId: filamentos[0].id,
      materialName: `${filamentos[0].tipo} - ${filamentos[0].cor}`,
      filamentType: filamentos[0].tipo,
      color: filamentos[0].cor,
      colorHex: filamentos[0].corHex,
      weightGrams: finalWeight,
      costPerGram: Number((filamentos[0].precoKg / 1000).toFixed(4)),
      totalCost: Number(((filamentos[0].precoKg / 1000) * finalWeight).toFixed(2)),
    }] : []);

    const projectData: Partial<ProjetoImpressao3D> = {
      nomePeca: cleanName,
      clienteNome: '',
      clienteContato: '',
      impressoraId: printer.id,
      tempoEstimadoHoras: durationHours,
      pesoEstimadoG: finalWeight,
      materials: materialsList,
      quantidadeLote: 1,
      modoVenda: 'varejo',
      status: 'orcamento',
      observacoes: `Orçamento gerado a partir da impressão direta na impressora ${printer.nome} (Arquivo: ${rawPieceName || cleanName})`,
    };

    navigate('/cliente/calculadora', {
      state: {
        copyProject: projectData,
      },
    });

    toast.info(`Calculadora aberta com os dados da peça "${cleanName}".`);
  };

  const bambuPrintersConfigKey = useMemo(() => {
    return impressoras
      .filter(p => p.tipoConexao === 'bambu_lab')
      .map(p => `${p.id}:${p.ipRede}:${p.accessCode}`)
      .join('|');
  }, [impressoras]);

  // Polling em tempo real de telemetria via MQTT para impressoras Bambu Lab
  useEffect(() => {
    const bambuPrinters = impressoras.filter(p => p.tipoConexao === 'bambu_lab' && p.ipRede && p.accessCode);
    if (bambuPrinters.length === 0) return;

    let mounted = true;

    const pollTelemetry = async () => {
      for (const printer of bambuPrinters) {
        if (!mounted || !printer.ipRede || !printer.accessCode) continue;
        try {
          const cleanIp = printer.ipRede.replace(/^https?:\/\//, '').split(':')[0].trim();
          const params = new URLSearchParams({
            ip: cleanIp,
            serial: printer.serialNumber || '',
            accessCode: printer.accessCode,
          });
          const res = await fetch(`/api/printer/telemetry?${params.toString()}`);
          if (!res.ok) {
            setPrinterOnlineMap(prev => ({ ...prev, [printer.id]: false }));
            continue;
          }
          const data = await res.json();
          if (data.success && data.data && mounted) {
            const telemetry: PrinterTelemetry = {
              ...data.data,
              lastUpdated: Date.now(),
            };
            setTelemetryMap(prev => ({ ...prev, [printer.id]: telemetry }));
            setPrinterOnlineMap(prev => ({ ...prev, [printer.id]: true }));

            // ATUALIZAÇÃO DO STATUS DA IMPRESSORA CONFORME A CONEXÃO E O ESTADO REAL (GCODE_STATE):
            const gState = (telemetry.gcodeState || '').toUpperCase();

            // Sincroniza progresso real da máquina apenas quando estiver em execução
            if (telemetry.progressPercent !== null && telemetry.progressPercent >= 0 && (gState === 'RUNNING' || gState === 'PREPARE' || gState === 'PAUSE')) {
              setProgressDraft(prev => ({ ...prev, [printer.id]: telemetry.progressPercent! }));
            }

            let targetStatus: Impressora3D['status'] | null = null;
            if (gState === 'RUNNING' || gState === 'PREPARE') {
              targetStatus = 'imprimindo';
            } else if (gState === 'PAUSE') {
              targetStatus = 'pausada';
            } else if (gState === 'FINISH' || gState === 'IDLE' || gState === 'FAILED') {
              if (printer.status === 'imprimindo' || printer.status === 'pausada' || printer.projetoAtualId) {
                // Finalizou, cancelou ou terminou o trabalho: conclui e dá baixa no estoque
                void handleConcluirTrabalho(printer, true, telemetry);
              } else if (printer.status !== 'disponivel' && printer.status !== 'manutencao') {
                targetStatus = 'disponivel';
              }
            }

            if (targetStatus && printer.status !== targetStatus && printer.status !== 'manutencao' && lastSyncedStatusRef.current[printer.id] !== targetStatus) {
              lastSyncedStatusRef.current[printer.id] = targetStatus;
              updateImpressoraStatus(printer.id, targetStatus);
            }
          } else if (!data.success && mounted) {
            setPrinterOnlineMap(prev => ({ ...prev, [printer.id]: false }));
          }
        } catch {
          setPrinterOnlineMap(prev => ({ ...prev, [printer.id]: false }));
        }
      }
    };

    void pollTelemetry();
    const interval = setInterval(pollTelemetry, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [bambuPrintersConfigKey]);

  const [nome, setNome] = useState('');
  const [modelo, setModelo] = useState('');
  const [potencia, setPotencia] = useState(350);
  const [bico, setBico] = useState(0.4);
  const [serviceInterval, setServiceInterval] = useState(100);
  const [precoCompra, setPrecoCompra] = useState<number | string>(5000); 
  const [vidaUtilHoras, setVidaUtilHoras] = useState<number | string>(5000); 

  useEffect(() => {
    // Sincronização de timer estimada APENAS para impressoras manuais (sem telemetria de rede)
    const activePrinters = impressoras.filter(p => 
      (p.status === 'imprimindo' || p.status === 'pausada') && 
      p.projetoAtualId &&
      p.tipoConexao === 'manual'
    );
    if (activePrinters.length === 0) return;

    const syncTick = () => {
      const now = Date.now();
      const stored = readStoredTimers();
      let storedChanged = false;
      const nextSecs: Record<string, number> = {};
      const nextProgress: Record<string, number> = {};

      activePrinters.forEach(p => {
        const projectId = p.projetoAtualId!;
        const currentProject = projetos.find(proj => proj.id === projectId);
        const rawTempo = currentProject?.tempoEstimadoHoras ?? 18;
        const totalSecs = Math.max(1, parseAndSanitizeEstimatedSeconds(rawTempo));
        const dbProgress = Math.min(100, Math.max(0, Number(p.progressoPercentual ?? 0)));
        const defaultRemaining = Math.max(1, Math.round(totalSecs * (1 - dbProgress / 100)));

        let entry = stored[p.id];
        if (!entry || entry.projectId !== projectId || entry.totalSecs !== totalSecs) {
          entry = {
            projectId,
            totalSecs,
            targetEndMs: now + defaultRemaining * 1000,
            pausedRemainingSecs: p.status === 'pausada' ? defaultRemaining : undefined,
          };
          stored[p.id] = entry;
          storedChanged = true;
        } else if (p.status === 'pausada' && entry.pausedRemainingSecs === undefined) {
          entry.pausedRemainingSecs = Math.max(0, Math.round((entry.targetEndMs - now) / 1000));
          storedChanged = true;
        } else if (p.status === 'imprimindo' && entry.pausedRemainingSecs !== undefined) {
          entry.targetEndMs = now + entry.pausedRemainingSecs * 1000;
          delete entry.pausedRemainingSecs;
          storedChanged = true;
        }

        const remaining =
          p.status === 'pausada'
            ? (entry.pausedRemainingSecs ?? defaultRemaining)
            : Math.max(0, Math.round((entry.targetEndMs - now) / 1000));

        nextSecs[p.id] = remaining;
        const calcProgress = Number((((totalSecs - remaining) / totalSecs) * 100).toFixed(2));
        nextProgress[p.id] = Math.min(100, Math.max(0, calcProgress));

        if (p.status === 'imprimindo' && remaining <= 0) {
          void handleConcluirTrabalho(p, true);
        }
      });

      if (storedChanged) {
        writeStoredTimers(stored);
      }

      setRemainingSecondsMap(prev => ({ ...prev, ...nextSecs }));
      setProgressDraft(prev => ({ ...prev, ...nextProgress }));
    };

    syncTick();
    const interval = setInterval(syncTick, 1000);
    return () => clearInterval(interval);
  }, [impressoras, projetos, user?.id]);

  const counts = useMemo(() => {
    const printing = impressoras.filter(item => item.status === 'imprimindo').length;
    const available = impressoras.filter(item => item.status === 'disponivel').length;
    const paused = impressoras.filter(item => item.status === 'pausada').length;
    const offline = impressoras.filter(item => item.status === 'desconectada').length;
    const maintenance = impressoras.filter(item => item.status === 'manutencao').length;

    const totalConsumoGrams = movimentacoes
      .filter(m => m.tipo === 'consumption')
      .reduce((sum, m) => sum + (m.quantidadeGramas || 0), 0) ||
      projetos
        .filter(p => p.status === 'concluido' || p.estoqueBaixado)
        .reduce((sum, p) => sum + (p.pesoEstimadoG || 0), 0);

    const livePrintingGrams = impressoras
      .filter(p => p.status === 'imprimindo')
      .reduce((sum, p) => {
        const live = telemetryMap[p.id];
        const proj = projetos.find(item => item.id === p.projetoAtualId);
        const estWeight = proj?.pesoEstimadoG && proj.pesoEstimadoG > 0
          ? proj.pesoEstimadoG
          : (live?.totalLayerNum ? Math.max(15, Math.round(live.totalLayerNum * 0.6)) : 45);
        const prog = live?.progressPercent ?? (p.progressoPercentual ?? 0);
        return sum + Math.round(estWeight * (prog / 100));
      }, 0);

    return {
      printing,
      available,
      paused,
      offline,
      maintenance,
      totalConsumoKg: (totalConsumoGrams / 1000).toFixed(2),
      totalConsumoGrams,
      livePrintingGrams,
    };
  }, [impressoras, movimentacoes, projetos, telemetryMap]);

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nome.trim() || potencia <= 0 || bico <= 0 || serviceInterval <= 0) return;
    
    const valorInvestimento = Number(precoCompra) || 0;
    const horasVidaUtil = Number(vidaUtilHoras) || 5000;
    const depreciacaoCalculada = horasVidaUtil > 0 ? Number((valorInvestimento / horasVidaUtil).toFixed(2)) : 0.50;

    const saved = addImpressora({ 
      nome: nome.trim(), 
      modelo: modelo.trim() || 'Impressora 3D', 
      tipo: 'FDM', 
      status: 'disponivel', 
      potenciaWatts: potencia, 
      bicoMm: bico, 
      horasUso: 0, 
      horasDesdeManutencao: 0, 
      intervaloManutencaoHoras: serviceInterval,
      custoInvestimento: valorInvestimento,
      vidaUtilHoras: horasVidaUtil,
      depreciacaoHora: depreciacaoCalculada,
      tipoConexao,
      ipRede: tipoConexao !== 'manual' ? ipRede.trim() : undefined,
      serialNumber: tipoConexao === 'bambu_lab' ? serialNumber.trim() : undefined,
      accessCode: tipoConexao === 'bambu_lab' ? accessCode.trim() : undefined,
    });

    if (saved) { 
      setNome(''); 
      setModelo(''); 
      setTipoConexao('manual');
      setIpRede('');
      setSerialNumber('');
      setAccessCode('');
      setShowAddForm(false); 
      toast.success(`Impressora cadastrada! Depreciação: R$ ${depreciacaoCalculada.toFixed(2)}/h`);
    }
  };

  const handleOpenEdit = (printer: Impressora3D, initialTab: 'geral' | 'rede' = 'geral') => {
    setEditingPrinterId(printer.id);
    setEditTab(initialTab);
    setEditNome(printer.nome || '');
    setEditModelo(printer.modelo || '');
    setEditPotencia(printer.potenciaWatts || 350);
    setEditBico(printer.bicoMm || 0.4);
    setEditIntervaloManutencao(printer.intervaloManutencaoHoras || 100);
    setEditHorasUso(printer.horasUso ?? 0);
    
    const currentCustom = customInvestments[printer.id];
    setEditPrecoCompra(currentCustom && currentCustom.custoInvestimento > 0 ? currentCustom.custoInvestimento : (printer.custoInvestimento || 5000));
    setEditVidaUtil(currentCustom && currentCustom.vidaUtilHoras > 0 ? currentCustom.vidaUtilHoras : (printer.vidaUtilHoras || 5000));

    const currentConn = customConnections[printer.id];
    setEditTipoConexao(currentConn?.tipoConexao || printer.tipoConexao || 'manual');
    setEditIpRede(currentConn?.ipRede || printer.ipRede || '');
    setEditSerialNumber(currentConn?.serialNumber || printer.serialNumber || '');
    setEditAccessCode(currentConn?.accessCode || printer.accessCode || '');
  };

  const handleUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!editingPrinterId) return;

    const valorInvestimento = parseFloat(String(editPrecoCompra)) || 0;
    const horasVidaUtil = parseFloat(String(editVidaUtil)) || 5000;
    const depreciacaoCalculada = horasVidaUtil > 0 ? Number((valorInvestimento / horasVidaUtil).toFixed(2)) : 0.50;
    const novoIntervaloManutencao = Math.max(1, Number(editIntervaloManutencao) || 100);
    const novasHorasUso = Math.max(0, Number(editHorasUso) || 0);

    const printerToUpdate = impressoras.find(p => p.id === editingPrinterId);
    if (!printerToUpdate) return;

    const updatedCustoms = {
      ...customInvestments,
      [editingPrinterId]: {
        custoInvestimento: valorInvestimento,
        vidaUtilHoras: horasVidaUtil,
        depreciacaoHora: depreciacaoCalculada
      }
    };

    setCustomInvestments(updatedCustoms);

    const updatedConnections = {
      ...customConnections,
      [editingPrinterId]: {
        tipoConexao: editTipoConexao,
        ipRede: editTipoConexao !== 'manual' ? editIpRede.trim() : undefined,
        serialNumber: editTipoConexao === 'bambu_lab' ? editSerialNumber.trim() : undefined,
        accessCode: editTipoConexao === 'bambu_lab' ? editAccessCode.trim() : undefined,
      }
    };
    setCustomConnections(updatedConnections);

    if (user?.id) {
      try {
        localStorage.setItem(`ph3d_printer_investments_v2_${user.id}`, JSON.stringify(updatedCustoms));
        localStorage.setItem(`ph3d_printer_connections_${user.id}`, JSON.stringify(updatedConnections));
      } catch (e) {
        console.error('Erro ao salvar dados no localStorage:', e);
      }
    }

    void updateImpressora(editingPrinterId, {
      nome: editNome.trim(),
      modelo: editModelo.trim(),
      potenciaWatts: Number(editPotencia) || 350,
      bicoMm: Number(editBico) || 0.4,
      intervaloManutencaoHoras: novoIntervaloManutencao,
      horasUso: novasHorasUso,
      custoInvestimento: valorInvestimento,
      vidaUtilHoras: horasVidaUtil,
      depreciacaoHora: depreciacaoCalculada,
      tipoConexao: editTipoConexao,
      ipRede: editTipoConexao !== 'manual' ? editIpRede.trim() : undefined,
      serialNumber: editTipoConexao === 'bambu_lab' ? editSerialNumber.trim() : undefined,
      accessCode: editTipoConexao === 'bambu_lab' ? editAccessCode.trim() : undefined,
    });

    toast.success('Dados, investimento e comunicação salvos com sucesso!');
    setEditingPrinterId(null);
  };

  const handleDelete = async (id: string, nomeImpressora: string) => {
    if (confirm(`Tem certeza que deseja excluir a impressora "${nomeImpressora}"?`)) {
      // 1. Apaga no Supabase / contexto global
      await deleteImpressora(id);

      // 2. Remove dos investimentos locais
      const newDeleted = [...deletedPrinterIds, id];
      setDeletedPrinterIds(newDeleted);

      const updatedCustoms = { ...customInvestments };
      delete updatedCustoms[id];
      setCustomInvestments(updatedCustoms);

      const updatedConnections = { ...customConnections };
      delete updatedConnections[id];
      setCustomConnections(updatedConnections);

      if (user?.id) {
        try {
          localStorage.setItem(`ph3d_deleted_printers_${user.id}`, JSON.stringify(newDeleted));
          localStorage.setItem(`ph3d_printer_investments_v2_${user.id}`, JSON.stringify(updatedCustoms));
          localStorage.setItem(`ph3d_printer_connections_${user.id}`, JSON.stringify(updatedConnections));
        } catch (e) {
          console.error(e);
        }
      }

      toast.success('Impressora excluída com sucesso.');
    }
  };

  const submitMaintenance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!maintenancePrinter || !maintenanceTasks.length) { toast.error('Marque pelo menos uma tarefa realizada.'); return; }
    setSavingMaintenance(true);
    try {
      if (await recordMaintenance(maintenancePrinter, maintenanceTasks, maintenanceNote.trim())) {
        setMaintenancePrinter(null); setMaintenanceTasks([]); setMaintenanceNote('');
      }
    } finally { setSavingMaintenance(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><Cpu className="h-5 w-5 text-indigo-400" />Parque de Impressoras 3D</h2><p className="mt-1 text-sm text-slate-400">Acompanhe suas impressoras, produção e manutenções.</p></div>
      <Button onClick={() => setShowAddForm(value => !value)} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">{showAddForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{showAddForm ? 'Fechar' : 'Adicionar impressora'}</Button>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <SummaryCard 
        label="Em Produção" 
        value={counts.printing} 
        tone={counts.printing > 0 ? "sky" : "slate"} 
        icon={Play} 
        badge={counts.printing > 0 ? `${counts.printing} imprimindo` : "Parque ocioso"}
        detail={counts.printing > 0 ? "Peças sendo impressas agora" : "Nenhum trabalho rodando"}
      />
      <SummaryCard 
        label="Disponíveis" 
        value={counts.available} 
        tone="emerald" 
        icon={CirclePower} 
        badge={counts.available > 0 ? `${counts.available} prontas` : "Ocupadas"}
        detail="Máquinas livres para nova produção"
      />
      <SummaryCard 
        label="Consumo Filamento" 
        value={`${counts.totalConsumoKg} kg`} 
        tone="amber" 
        icon={Disc} 
        badge={counts.livePrintingGrams > 0 ? `+${counts.livePrintingGrams}g em uso` : "Estoque da Farm"}
        detail={`${counts.totalConsumoGrams}g baixados no histórico`}
      />
      <SummaryCard 
        label="Rede & Comunicação" 
        value={counts.offline > 0 ? `${counts.offline} Offline` : "100% Online"} 
        tone={counts.offline > 0 ? "rose" : "emerald"} 
        icon={Wifi} 
        badge={counts.offline > 0 ? "Falha de sinal" : "Bambu Lab conectada"}
        detail={counts.offline > 0 ? "Verifique o IP local" : "Telemetria ativa em tempo real"}
      />
    </section>

    {showAddForm && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
      <h3 className="mb-4 font-bold text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400"/> Cadastrar Impressora & Custo de Investimento</h3>
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome da impressora"><Input required maxLength={100} placeholder="Ex.: BambuLab A1 Combo" value={nome} onChange={event => setNome(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Fabricante / modelo"><Input maxLength={120} placeholder="Ex.: Bambu Lab A1" value={modelo} onChange={event => setModelo(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Potência (W)"><Input type="number" min="1" value={potencia} onChange={event => setPotencia(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Bico (mm)"><Input type="number" min="0.1" step="0.1" value={bico} onChange={event => setBico(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Preço de Investimento / Compra (R$)"><Input type="number" min="0" step="0.01" placeholder="Ex: 5000.00" value={precoCompra} onChange={event => setPrecoCompra(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Vida útil estimada (Horas de uso)"><Input type="number" min="100" step="100" placeholder="Ex: 5000" value={vidaUtilHoras} onChange={event => setVidaUtilHoras(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Manutenção a cada (h)"><Input type="number" min="1" step="1" value={serviceInterval} onChange={event => setServiceInterval(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        
        {/* SEÇÃO DE COMUNICAÇÃO E INTEGRAÇÃO POR IMPRESSORA */}
        <div className="lg:col-span-4 rounded-xl border border-indigo-500/30 bg-slate-950/70 p-4 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-indigo-400" /> Integração de Rede & Fatiador (Bambu Lab / Klipper)
            </span>
            <span className="text-[11px] text-slate-400">Configure os dados individuais desta impressora</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo de Conexão">
              <select
                value={tipoConexao}
                onChange={e => setTipoConexao(e.target.value as Impressora3D['tipoConexao'])}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manual">Manual (Sem conexão de rede)</option>
                <option value="bambu_lab">Bambu Lab (Modo LAN / Bambu Studio)</option>
                <option value="klipper">Klipper / Moonraker</option>
                <option value="octoprint">OctoPrint</option>
              </select>
            </Field>

            {tipoConexao === 'bambu_lab' && (
              <>
                <Field label="IP Local da Impressora">
                  <Input
                    placeholder="Ex.: 192.168.0.102"
                    value={ipRede}
                    onChange={e => setIpRede(e.target.value)}
                    className="border-slate-700 bg-slate-900 text-white font-mono text-xs"
                  />
                </Field>
                <Field label="Nº de Série (Serial)">
                  <Input
                    placeholder="Ex.: 03919D520905950"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    className="border-slate-700 bg-slate-900 text-white font-mono text-xs"
                  />
                </Field>
                <Field label="Código de Acesso LAN (Access Code)">
                  <div className="relative">
                    <Input
                      type={showAccessCode ? "text" : "password"}
                      placeholder="Ex.: 8 dígitos da tela"
                      value={accessCode}
                      onChange={e => setAccessCode(e.target.value)}
                      className="border-slate-700 bg-slate-900 text-white font-mono text-xs pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessCode(prev => !prev)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </>
            )}

            {tipoConexao === 'klipper' && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="URL do Moonraker / Klipper">
                  <Input
                    placeholder="Ex.: http://192.168.0.105:7125"
                    value={ipRede}
                    onChange={e => setIpRede(e.target.value)}
                    className="border-slate-700 bg-slate-900 text-white font-mono text-xs"
                  />
                </Field>
              </div>
            )}

            {tipoConexao === 'octoprint' && (
              <>
                <Field label="URL do OctoPrint">
                  <Input
                    placeholder="Ex.: http://192.168.0.105:5000"
                    value={ipRede}
                    onChange={e => setIpRede(e.target.value)}
                    className="border-slate-700 bg-slate-900 text-white font-mono text-xs"
                  />
                </Field>
                <Field label="API Key">
                  <Input
                    type="password"
                    placeholder="API Key do OctoPrint"
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value)}
                    className="border-slate-700 bg-slate-900 text-white font-mono text-xs"
                  />
                </Field>
              </>
            )}
          </div>

          {tipoConexao !== 'manual' && ipRede && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80 mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testingPrinterId === 'new'}
                onClick={() => handleTestConnection('new', ipRede, tipoConexao)}
                className="h-7 text-xs border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testingPrinterId === 'new' ? 'animate-spin' : ''}`} />
                {testingPrinterId === 'new' ? 'Testando sinal com o IP...' : 'Testar Conexão Local com a Impressora'}
              </Button>
              <span className="text-[11px] text-slate-400">Verifica se a impressora responde na rede antes de salvar.</span>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 lg:col-span-4 mt-2">
          <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-500">Salvar impressora com ROI</Button>
          <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button>
        </div>
      </form>
    </Card>}

    {!impressoras.length && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-8 text-center"><Cpu className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-sm text-slate-300">Adicione sua primeira impressora para acompanhar a produção.</p></Card>}

    <section className="grid gap-4 xl:grid-cols-2">
      {impressoras.map(printer => {
        const status = STATUS[printer.status];
        const currentProject = projetos.find(project => project.id === printer.projetoAtualId);
        const liveTelemetry = telemetryMap[printer.id];
        const hasLiveTelemetry = Boolean(liveTelemetry && printer.tipoConexao === 'bambu_lab');

        // Progresso 100% sincronizado com a impressora Bambu Lab
        const progress = hasLiveTelemetry && liveTelemetry.progressPercent !== null && liveTelemetry.progressPercent !== undefined
          ? liveTelemetry.progressPercent
          : (progressDraft[printer.id] ?? printer.progressoPercentual ?? 0);
        
        const rawTempoEstimado = currentProject?.tempoEstimadoHoras ?? 18;
        const totalSecondsEstimated = parseAndSanitizeEstimatedSeconds(rawTempoEstimado);
        
        // Tempo restante 100% sincronizado com a máquina Bambu Lab
        const remainingPrintSeconds = hasLiveTelemetry && liveTelemetry.remainingTimeMinutes !== null && liveTelemetry.remainingTimeMinutes !== undefined
          ? Math.max(0, liveTelemetry.remainingTimeMinutes * 60)
          : (remainingSecondsMap[printer.id] ?? Math.round(totalSecondsEstimated * (1 - (Math.min(100, Math.max(0, progress)) / 100))));
        const elapsedPrintSeconds =
          printer.projetoAtualId && (printer.status === 'imprimindo' || printer.status === 'pausada')
            ? Math.max(0, totalSecondsEstimated - remainingPrintSeconds)
            : 0;

        const baseUsageSeconds = parseAndSanitizeEstimatedSeconds(printer.horasUso);
        const effectiveUsageSeconds = baseUsageSeconds + elapsedPrintSeconds;

        const baseRemainingServiceSecs = Math.max(0, ((printer.intervaloManutencaoHoras || 100) - (printer.horasDesdeManutencao || 0)) * 3600);
        const effectiveRemainingServiceSecs = Math.max(0, baseRemainingServiceSecs - elapsedPrintSeconds);
        const remainingServiceHours = effectiveRemainingServiceSecs / 3600;
        const serviceDue = remainingServiceHours <= 0;
        const serviceSoon = remainingServiceHours > 0 && remainingServiceHours <= 10;

        const events = historicoImpressoras.filter(event => event.impressoraId === printer.id).slice(0, 5);
        const lastMaintenance = historicoImpressoras.find(event => event.impressoraId === printer.id && event.tipo === 'maintenance_completed');
        
        const customMeta = customInvestments[printer.id];
        const custoInvestimento = customMeta && customMeta.custoInvestimento > 0 ? customMeta.custoInvestimento : (printer.custoInvestimento && printer.custoInvestimento > 0 ? printer.custoInvestimento : 5000);
        const vidaUtil = customMeta && customMeta.vidaUtilHoras > 0 ? customMeta.vidaUtilHoras : (printer.vidaUtilHoras && printer.vidaUtilHoras > 0 ? printer.vidaUtilHoras : 5000);
        const depreciacaoH = customMeta && customMeta.depreciacaoHora > 0 ? customMeta.depreciacaoHora : (printer.depreciacaoHora && printer.depreciacaoHora > 0 ? printer.depreciacaoHora : (vidaUtil > 0 ? custoInvestimento / vidaUtil : 1.00));

        // Identificação da Bobina Ativa e Cálculo de Consumo de Filamento em Tempo Real
        const activeTrayId = liveTelemetry?.activeTray;
        const activeAmsTray = liveTelemetry?.ams?.[0]?.trays?.find(
          t => String(t.id) === String(activeTrayId) || t.active
        );

        const matchingSpool = (() => {
          if (activeAmsTray) {
            const trayType = (activeAmsTray.type || 'PLA').toUpperCase();
            const match = filamentos.find(f => {
              if (f.tipo.toUpperCase() !== trayType) return false;
              if (activeAmsTray.color && f.corHex) {
                const hex1 = f.corHex.replace('#', '').toLowerCase();
                const hex2 = activeAmsTray.color.replace('#', '').toLowerCase().slice(0, 6);
                return hex1 === hex2;
              }
              return true;
            });
            if (match) return match;
            const typeMatch = filamentos.find(f => f.tipo.toUpperCase() === trayType);
            if (typeMatch) return typeMatch;
          }
          if (currentProject?.materials && currentProject.materials.length > 0) {
            const mat = currentProject.materials[0];
            const found = filamentos.find(f => f.id === mat.materialId || f.tipo.toUpperCase() === mat.filamentType?.toUpperCase());
            if (found) return found;
          }
          return filamentos.find(f => f.tipo.toUpperCase() === 'PLA') || filamentos[0] || null;
        })();

        const estimatedWeightGrams = currentProject?.pesoEstimadoG && currentProject.pesoEstimadoG > 0
          ? currentProject.pesoEstimadoG
          : (liveTelemetry?.totalLayerNum ? Math.max(15, Math.round(liveTelemetry.totalLayerNum * 0.6)) : 45);

        const consumedSoFarGrams = Number(((estimatedWeightGrams * Math.min(100, Math.max(0, progress))) / 100).toFixed(1));

        const spoolRemainingGrams = matchingSpool
          ? Math.max(0, Math.round(matchingSpool.pesoRestanteG - consumedSoFarGrams))
          : null;

        return <Card key={printer.id} className="space-y-4 rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">🖨 {printer.nome}</h3>
              <p className="mt-1 text-xs text-slate-400">{printer.modelo} <span className="px-1">·</span> Bico {printer.bicoMm} mm <span className="px-1">·</span> {printer.potenciaWatts} W</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenEdit(printer)} className="h-8 border-slate-700 bg-slate-950 text-indigo-300 hover:bg-indigo-950/40 text-xs">
                <Edit2 className="w-3.5 h-3.5 mr-1"/> Editar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(printer.id, printer.nome)} className="h-8 border-slate-700 bg-slate-950 text-rose-400 hover:bg-rose-950/40 text-xs">
                <Trash2 className="w-3.5 h-3.5"/>
              </Button>
              <Badge variant="outline" className={`shrink-0 ${status.badge}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-indigo-950/20 border border-indigo-500/20 px-4 py-2.5 text-xs">
            <span className="text-indigo-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Investimento: <strong className="text-white">R$ {Number(custoInvestimento).toFixed(2)}</strong> ({vidaUtil}h úteis)
            </span>
            <span className="text-slate-300">Depreciação: <strong className="text-emerald-400">R$ {depreciacaoH.toFixed(2)}/h</strong></span>
          </div>

          {/* BADGE DE COMUNICAÇÃO DE REDE DA IMPRESSORA */}
          {printer.tipoConexao && printer.tipoConexao !== 'manual' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/70 border border-slate-800 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-slate-200">
                  {printer.tipoConexao === 'bambu_lab' ? 'Bambu Lab (Modo LAN)' : printer.tipoConexao === 'klipper' ? 'Klipper / Moonraker' : 'OctoPrint'}
                </span>
                {printer.ipRede && <span className="font-mono text-[11px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">{printer.ipRede}</span>}
                {printer.serialNumber && <span className="font-mono text-[11px] text-slate-500 hidden sm:inline">S/N: {printer.serialNumber}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${printerOnlineMap[printer.id] ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                  <span className={`mr-1 h-1.5 w-1.5 rounded-full inline-block ${printerOnlineMap[printer.id] ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {printerOnlineMap[printer.id] ? 'Online (Ativa)' : 'Conectada'}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingPrinterId === printer.id}
                  onClick={() => handleTestConnection(printer.id, printer.ipRede || '', printer.tipoConexao, printer.accessCode)}
                  className="h-6 px-2 text-[10px] font-semibold border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${testingPrinterId === printer.id ? 'animate-spin' : ''}`} />
                  {testingPrinterId === printer.id ? 'Verificando...' : 'Testar Conexão'}
                </Button>
              </div>
            </div>
          )}

          {/* PAINEL DE TELEMETRIA AO VIVO (MQTT) */}
          {printer.tipoConexao === 'bambu_lab' && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${telemetryMap[printer.id] ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  Telemetria ao Vivo (Bambu Lab)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Estado: <strong className="text-white uppercase">{telemetryMap[printer.id]?.gcodeState || 'AGUARDANDO SINAL'}</strong>
                </span>
              </div>

              {telemetryMap[printer.id] ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {/* Temperatura do Bico */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400">
                        <Thermometer className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Bico (Hotend)</span>
                        <strong className="text-white text-xs">
                          {telemetryMap[printer.id].nozzleTemp !== null ? `${telemetryMap[printer.id].nozzleTemp}°C` : '--'}
                        </strong>
                        {telemetryMap[printer.id].nozzleTargetTemp ? (
                          <span className="text-[10px] text-slate-500 ml-1">/{telemetryMap[printer.id].nozzleTargetTemp}°</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Temperatura da Mesa */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                        <Thermometer className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Mesa (Bed)</span>
                        <strong className="text-white text-xs">
                          {telemetryMap[printer.id].bedTemp !== null ? `${telemetryMap[printer.id].bedTemp}°C` : '--'}
                        </strong>
                        {telemetryMap[printer.id].bedTargetTemp ? (
                          <span className="text-[10px] text-slate-500 ml-1">/{telemetryMap[printer.id].bedTargetTemp}°</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Camada Atual */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Camadas</span>
                        <strong className="text-white text-xs">
                          {telemetryMap[printer.id].layerNum !== null ? telemetryMap[printer.id].layerNum : '--'}
                        </strong>
                        {telemetryMap[printer.id].totalLayerNum ? (
                          <span className="text-[10px] text-slate-500 ml-1">/{telemetryMap[printer.id].totalLayerNum}</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Tempo Restante Real */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Clock3 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Tempo Restante</span>
                        <strong className="text-white text-xs">
                          {telemetryMap[printer.id].remainingTimeMinutes !== null
                            ? `${telemetryMap[printer.id].remainingTimeMinutes} min`
                            : '--'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {telemetryMap[printer.id].subtaskName && (
                    <div className="text-[11px] text-slate-400 truncate pt-1 flex items-center gap-1.5">
                      <span className="text-slate-500">Arquivo Bambu Studio:</span>
                      <span className="font-mono text-white text-xs">{telemetryMap[printer.id].subtaskName}</span>
                    </div>
                  )}

                  {/* Visualizador de AMS / AMS Lite (Carrossel de Filamentos) */}
                  {telemetryMap[printer.id].ams && telemetryMap[printer.id].ams!.length > 0 && (
                    <div className="pt-2 border-t border-indigo-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                          <Disc className="w-3.5 h-3.5 text-indigo-400" />
                          Sistema AMS ({telemetryMap[printer.id].ams!.length > 1 ? `${telemetryMap[printer.id].ams!.length} Unidades` : 'AMS Lite / 4 Slots'})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Carretel Ativo:{' '}
                          <strong className="text-white">
                            {telemetryMap[printer.id].activeTray !== null && telemetryMap[printer.id].activeTray !== undefined
                              ? `Slot ${Number(telemetryMap[printer.id].activeTray) + 1}`
                              : 'Nenhum'}
                          </strong>
                        </span>
                      </div>

                      {telemetryMap[printer.id].ams!.map((unit, unitIdx) => (
                        <div key={unit.id || unitIdx} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {unit.trays.map((tray, trayIdx) => {
                            const isCurrent = tray.active || String(telemetryMap[printer.id].activeTray) === String(tray.id);
                            return (
                              <div
                                key={tray.id || trayIdx}
                                className={`relative rounded-lg p-2 border transition-all flex flex-col justify-between ${
                                  isCurrent
                                    ? 'bg-indigo-950/70 border-indigo-400/90 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                                    : 'bg-slate-950/80 border-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="text-[10px] font-mono font-bold text-slate-400">
                                    SLOT {Number(tray.id) + 1}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                      NO BICO
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 my-1">
                                  <span
                                    className="w-5 h-5 rounded-full border-2 border-white/40 shadow shrink-0"
                                    style={{ backgroundColor: tray.color || '#FFFFFF' }}
                                    title={`Cor: ${tray.color}`}
                                  />
                                  <div className="min-w-0">
                                    <strong className="text-xs text-white block truncate leading-tight">
                                      {tray.type || 'Vazio'}
                                    </strong>
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {tray.remain !== undefined ? `${tray.remain}% rest.` : 'Pronto'}
                                    </span>
                                  </div>
                                </div>

                                {/* Barra indicadora da cor e do filamento restante */}
                                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                  <div
                                    className="h-1.5 rounded-full transition-all"
                                    style={{
                                      width: `${tray.remain ?? 100}%`,
                                      backgroundColor: tray.color || '#6366f1',
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="text-slate-300 text-xs">
                    <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <span>⚠️</span> Aguardando Código de Acesso LAN da Bambu Lab
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      IP: <code className="text-indigo-300 bg-indigo-950/50 px-1.5 py-0.5 rounded">{printer.ipRede || '192.168.0.102'}</code> · Para liberar temperaturas em tempo real e tempo restante, digite o código de 8 dígitos exibido na tela da impressora.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleOpenEdit(printer, 'rede')}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 rounded-lg shadow"
                  >
                    🔑 Inserir Código de Acesso
                  </Button>
                </div>
              )}
            </div>
          )}

          {(printer.projetoAtualId || (hasLiveTelemetry && (liveTelemetry.gcodeState === 'RUNNING' || liveTelemetry.gcodeState === 'PREPARE' || liveTelemetry.gcodeState === 'PAUSE'))) ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Impressão / Peça Atual</p>
                  <p className="mt-1 font-semibold text-white">{liveTelemetry?.subtaskName || currentProject?.nomePeca || printer.projetoAtual || 'Impressão em andamento'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-right text-xs text-slate-400">
                    <Clock3 className="mr-1 inline h-3.5 w-3.5 text-sky-400" />
                    ~{formatSecondsToTime(remainingPrintSeconds)} restantes
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCriarOrcamento(printer, liveTelemetry?.subtaskName || printer.projetoAtual, matchingSpool, estimatedWeightGrams, remainingPrintSeconds || totalSecondsEstimated)}
                    title="Criar Orçamento ou Projeto formal no Spartan a partir desta impressão"
                    className="h-7 px-2.5 text-[11px] font-semibold border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-white rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    Criar Orçamento
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleConcluirTrabalho(printer, false, telemetryMap[printer.id])}
                    title="Zerar tempo e concluir projeto agora"
                    className="h-7 px-2.5 text-[11px] font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Zerar tempo & Dar baixa
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">Progresso informado</span>
                  <strong className="text-sky-300">{Number(progress).toFixed(1)}%</strong>
                </div>
                <Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-sky-500" />
                <input
                  aria-label={`Progresso de ${printer.nome}`}
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progress}
                  onChange={event => {
                    const val = Number(event.target.value);
                    const newRemaining = Math.max(0, Math.round(totalSecondsEstimated * (1 - (val / 100))));
                    setProgressDraft(previous => ({ ...previous, [printer.id]: val }));
                    setRemainingSecondsMap(previous => ({ ...previous, [printer.id]: newRemaining }));
                    if (printer.projetoAtualId) {
                      const stored = readStoredTimers();
                      stored[printer.id] = {
                        projectId: printer.projetoAtualId,
                        totalSecs: Math.max(1, totalSecondsEstimated),
                        targetEndMs: Date.now() + newRemaining * 1000,
                        pausedRemainingSecs: printer.status === 'pausada' ? newRemaining : undefined,
                      };
                      writeStoredTimers(stored);
                    }
                  }}
                  onPointerUp={event => {
                    const value = Number(event.currentTarget.value);
                    if (value >= 100) {
                      void handleConcluirTrabalho(printer, false, telemetryMap[printer.id]);
                    } else {
                      void updatePrinterProgress(printer.id, Math.round(value));
                    }
                  }}
                  onKeyUp={event => {
                    const value = Number(event.currentTarget.value);
                    if (value >= 100) {
                      void handleConcluirTrabalho(printer, false, telemetryMap[printer.id]);
                    } else {
                      void updatePrinterProgress(printer.id, Math.round(value));
                    }
                  }}
                  disabled={!['imprimindo', 'pausada'].includes(printer.status)}
                  className="mt-2 w-full accent-sky-500 disabled:opacity-40"
                />
              </div>
              {currentProject && <p className="text-xs text-slate-400">Tempo previsto do projeto: {formatHours(currentProject.tempoEstimadoHoras)}</p>}

              {/* WIDGET DE CONSUMO DE FILAMENTO EM TEMPO REAL */}
              <div className="rounded-xl bg-slate-900/90 border border-amber-500/20 p-3 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-amber-500/10 text-amber-400">
                      <Package className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      Consumo de Filamento & Estoque
                    </span>
                  </div>
                  {matchingSpool && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block border border-white/20" style={{ backgroundColor: matchingSpool.corHex || '#fff' }} />
                      <strong className="text-white">{matchingSpool.tipo} {matchingSpool.cor}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Consumido Agora</span>
                    <span className="text-xs font-bold text-amber-400">
                      ~{consumedSoFarGrams}g
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Total Previsto</span>
                    <span className="text-xs font-bold text-white">
                      ~{estimatedWeightGrams}g
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Saldo no Estoque</span>
                    <span className={`text-xs font-bold ${matchingSpool && matchingSpool.pesoRestanteG < 150 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {matchingSpool ? `${spoolRemainingGrams}g` : '--'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                  <span className="truncate">
                    {matchingSpool ? `${matchingSpool.marca || 'Spartan'} · ${activeAmsTray ? `AMS Slot ${Number(activeAmsTray.id) + 1}` : 'Carretel Avulso'}` : 'Carretel avulso'}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    Baixa automática no término
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-400">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-slate-300 font-medium">Nenhum trabalho em produção. Máquina livre.</span>
                  {liveTelemetry?.subtaskName && (
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                      Último arquivo: <strong className="text-slate-400">{liveTelemetry.subtaskName}</strong>
                    </span>
                  )}
                </div>
                {liveTelemetry?.subtaskName && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCriarOrcamento(printer, liveTelemetry.subtaskName, matchingSpool, estimatedWeightGrams, totalSecondsEstimated)}
                    className="h-7 px-2.5 text-[11px] font-semibold border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-white rounded-lg transition-colors shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    Gerar Orçamento de &quot;{liveTelemetry.subtaskName.replace(/\.(gcode|3mf|stl)$/i, '')}&quot;
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-3"><p className="text-[11px] text-slate-500">Horas de impressão</p><p className="mt-1 font-semibold text-white">{formatSecondsToTime(effectiveUsageSeconds)}</p><p className="text-[10px] text-slate-500">{elapsedPrintSeconds > 0 ? 'Em produção + concluídos' : 'Estimadas em projetos concluídos'}</p></div><div className={`rounded-xl p-3 ${serviceDue ? 'bg-orange-500/10' : serviceSoon ? 'bg-amber-500/10' : 'bg-slate-950'}`}><p className="text-[11px] text-slate-500">Próxima manutenção</p><p className={`mt-1 font-semibold ${serviceDue ? 'text-orange-300' : serviceSoon ? 'text-amber-300' : 'text-white'}`}>{serviceDue ? 'Manutenção necessária' : `Em ${formatSecondsToTime(effectiveRemainingServiceSecs)}`}</p><p className="text-[10px] text-slate-500">Intervalo: {printer.intervaloManutencaoHoras || 100} h · Última: {lastMaintenance ? new Date(lastMaintenance.data).toLocaleDateString('pt-BR') : 'sem registro'}</p></div></div>

          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
            {printer.status === 'imprimindo' && (
              <>
                <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'pausada')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800">
                  <Pause className="mr-1.5 h-3.5 w-3.5" />Pausar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCriarOrcamento(printer, liveTelemetry?.subtaskName || printer.projetoAtual, matchingSpool, estimatedWeightGrams, remainingPrintSeconds || totalSecondsEstimated)}
                  className="border-indigo-500/40 bg-indigo-950/40 text-xs text-indigo-300 hover:bg-indigo-900/60"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
                  Gerar Orçamento
                </Button>
                <Button size="sm" onClick={() => handleConcluirTrabalho(printer, false, telemetryMap[printer.id])} className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Concluir & Liberar Máquina
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFailureModalPrinter(printer)}
                  className="border-rose-500/50 bg-rose-950/30 text-xs text-rose-300 hover:bg-rose-900/50 hover:text-white font-semibold"
                  title="Interromper ou cancelar no meio da impressão e contabilizar o desperdício proporcional"
                >
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-rose-400" />
                  Cancelar / Registrar Perda
                </Button>
              </>
            )}
            {printer.status === 'pausada' && (
              <>
                <Button size="sm" onClick={() => updateImpressoraStatus(printer.id, 'imprimindo')} className="bg-sky-600 text-xs text-white hover:bg-sky-500">
                  <Play className="mr-1.5 h-3.5 w-3.5" />Retomar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCriarOrcamento(printer, liveTelemetry?.subtaskName || printer.projetoAtual, matchingSpool, estimatedWeightGrams, remainingPrintSeconds || totalSecondsEstimated)}
                  className="border-indigo-500/40 bg-indigo-950/40 text-xs text-indigo-300 hover:bg-indigo-900/60"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
                  Gerar Orçamento
                </Button>
                <Button size="sm" onClick={() => handleConcluirTrabalho(printer, false, telemetryMap[printer.id])} className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Concluir & Liberar Máquina
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFailureModalPrinter(printer)}
                  className="border-rose-500/50 bg-rose-950/30 text-xs text-rose-300 hover:bg-rose-900/50 hover:text-white font-semibold"
                  title="Interromper ou cancelar no meio da impressão e contabilizar o desperdício proporcional"
                >
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-rose-400" />
                  Cancelar / Registrar Perda
                </Button>
              </>
            )}
            {printer.status === 'disponivel' && <Link to="/cliente/projetos"><Button size="sm" className="bg-indigo-600 text-xs text-white hover:bg-indigo-500"><Play className="mr-1.5 h-3.5 w-3.5" />Iniciar impressão</Button></Link>}
            {printer.status === 'disponivel' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'desconectada')} className="border-slate-700 bg-slate-950 text-xs text-slate-200 hover:bg-slate-800 hover:text-white">Marcar offline</Button>}
            {printer.status === 'disponivel' && <Button size="sm" variant="ghost" onClick={() => updateImpressoraStatus(printer.id, 'manutencao')} className="text-xs text-slate-300 hover:text-orange-300"><Wrench className="mr-1.5 h-3.5 w-3.5" />Iniciar manutenção</Button>}
            {printer.status === 'desconectada' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'disponivel')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800">Marcar disponível</Button>}
            {!printer.projetoAtualId && printer.status !== 'manutencao' && printer.status !== 'disponivel' && <Button size="sm" variant="ghost" onClick={() => updateImpressoraStatus(printer.id, 'manutencao')} className="text-xs text-slate-300 hover:text-orange-300"><Wrench className="mr-1.5 h-3.5 w-3.5" />Iniciar manutenção</Button>}
            {!printer.projetoAtualId && printer.status === 'manutencao' && <Button size="sm" variant="ghost" onClick={() => setMaintenancePrinter(printer.id)} className="text-xs text-orange-300 hover:text-orange-200"><Wrench className="mr-1.5 h-3.5 w-3.5" />Registrar manutenção concluída</Button>}
            {printer.projetoAtualId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFailureModalPrinter(printer)}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                title="Registrar interrupção por falha e contabilizar perda de material"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Interromper por Falha / Bico Entupido
              </Button>
            )}
          </div>

          {events.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                <History className="h-3.5 w-3.5" />Histórico recente
              </p>
              <div className="space-y-2">
                {events.map(event => (
                  <div key={event.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-slate-300">
                        {event.tipo === 'project_completed' ? (
                          `Concluiu: ${String(event.payload.project_name || 'Projeto')}`
                        ) : event.tipo === 'print_failure' ? (
                          <span className="text-rose-300 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                            Falha: {String(event.payload.motivo || 'Erro de impressão')} ({Number(event.payload.gramas_perdidas || 0)}g perdidas aos {Number(event.payload.progresso || 0)}%)
                          </span>
                        ) : event.tipo === 'maintenance_completed' ? (
                          'Manutenção registrada'
                        ) : (
                          `Status: ${STATUS[String(event.payload.to) as Impressora3D['status']]?.label || event.payload.to || 'atualizado'}${event.payload.project ? ` (${String(event.payload.project)})` : ''}`
                        )}
                      </span>
                      {event.tipo === 'print_failure' && event.payload.projeto_nome && (
                        <p className="truncate text-[10px] text-slate-400">
                          Peça: {String(event.payload.projeto_nome)} · Prejuízo: R$ {Number(event.payload.custo_prejuizo || 0).toFixed(2)}
                        </p>
                      )}
                      {event.tipo === 'maintenance_completed' && Array.isArray(event.payload.tasks) && (
                        <p className="truncate text-[10px] text-slate-500">{(event.payload.tasks as string[]).join(' · ')}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-slate-500">
                      {new Date(event.data).toLocaleDateString('pt-BR')}
                      {event.tipo === 'project_completed' ? ` · ${formatHours(Number(event.payload.hours || 0))}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(serviceDue || serviceSoon) && <p className={`flex items-center gap-2 text-xs ${serviceDue ? 'text-orange-300' : 'text-amber-300'}`}><AlertTriangle className="h-4 w-4" />{serviceDue ? 'Manutenção no intervalo atingido.' : 'Manutenção próxima.'}</p>}
        </Card>;
      })}
    </section>

    {/* MODAL DE EDIÇÃO DA IMPRESSORA (COMPACTO COM ABAS E ALTURA MÁXIMA CONTROLADA) */}
    {editingPrinterId && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm" onClick={() => setEditingPrinterId(null)}>
        <div
          className="w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header fixo */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>🖨️</span> Configurar Impressora
              </h3>
              <p className="text-[11px] text-slate-400">Ajuste os parâmetros operacionais ou dados de rede</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setEditingPrinterId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Abas Superiores para Reduzir Altura Vertical */}
          <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 pt-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditTab('rede')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                editTab === 'rede'
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Rede & Bambu Studio
              {editTipoConexao === 'bambu_lab' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditTab('geral')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                editTab === 'geral'
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Especificações & ROI
            </button>
          </div>

          {/* Conteúdo com Scroll Controlado */}
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            {editTab === 'rede' ? (
              <div className="space-y-3">
                <Field label="Tipo de Conexão">
                  <select
                    value={editTipoConexao}
                    onChange={e => setEditTipoConexao(e.target.value as Impressora3D['tipoConexao'])}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="manual">Manual (Sem conexão de rede)</option>
                    <option value="bambu_lab">Bambu Lab (Modo LAN / Bambu Studio)</option>
                    <option value="klipper">Klipper / Moonraker</option>
                    <option value="octoprint">OctoPrint</option>
                  </select>
                </Field>

                {editTipoConexao === 'bambu_lab' && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 space-y-2.5">
                    <Field label="IP Local da Impressora na Rede">
                      <Input
                        placeholder="Ex.: 192.168.0.102"
                        value={editIpRede}
                        onChange={e => setEditIpRede(e.target.value)}
                        className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs"
                      />
                    </Field>
                    <Field label="Nº de Série da Impressora (Serial)">
                      <Input
                        placeholder="Ex.: 03919D520905950"
                        value={editSerialNumber}
                        onChange={e => setEditSerialNumber(e.target.value)}
                        className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs"
                      />
                    </Field>
                    <Field label="Código de Acesso LAN (Access Code)">
                      <div className="relative">
                        <Input
                          type={editShowAccessCode ? "text" : "password"}
                          placeholder="Ex.: 28161068"
                          value={editAccessCode}
                          onChange={e => setEditAccessCode(e.target.value)}
                          className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setEditShowAccessCode(prev => !prev)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                          tabIndex={-1}
                        >
                          {editShowAccessCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </Field>

                    {editIpRede && (
                      <div className="pt-1 flex items-center justify-between">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={testingPrinterId === editingPrinterId}
                          onClick={() => handleTestConnection(editingPrinterId, editIpRede, editTipoConexao, editAccessCode)}
                          className="h-7 text-[11px] border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${testingPrinterId === editingPrinterId ? 'animate-spin' : ''}`} />
                          {testingPrinterId === editingPrinterId ? 'Verificando sinal...' : 'Testar Comunicação'}
                        </Button>
                        <span className="text-[10px] text-slate-400">Porta 8883 MQTT</span>
                      </div>
                    )}
                  </div>
                )}

                {editTipoConexao === 'klipper' && (
                  <Field label="URL do Moonraker / Klipper">
                    <Input
                      placeholder="Ex.: http://192.168.0.105:7125"
                      value={editIpRede}
                      onChange={e => setEditIpRede(e.target.value)}
                      className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs"
                    />
                  </Field>
                )}

                {editTipoConexao === 'octoprint' && (
                  <div className="space-y-2.5">
                    <Field label="URL do OctoPrint">
                      <Input
                        placeholder="Ex.: http://192.168.0.105:5000"
                        value={editIpRede}
                        onChange={e => setEditIpRede(e.target.value)}
                        className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs"
                      />
                    </Field>
                    <Field label="API Key">
                      <Input
                        type="password"
                        placeholder="API Key do OctoPrint"
                        value={editAccessCode}
                        onChange={e => setEditAccessCode(e.target.value)}
                        className="h-8 border-slate-700 bg-slate-950 text-white font-mono text-xs"
                      />
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                <Field label="Nome da impressora">
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Fabricante / Modelo">
                  <Input value={editModelo} onChange={e => setEditModelo(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Potência (W)">
                  <Input type="number" value={editPotencia} onChange={e => setEditPotencia(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Bico (mm)">
                  <Input type="number" step="0.1" value={editBico} onChange={e => setEditBico(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Preço Compra (R$)">
                  <Input type="number" step="0.01" value={editPrecoCompra} onChange={e => setEditPrecoCompra(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Vida útil (Horas)">
                  <Input type="number" step="100" value={editVidaUtil} onChange={e => setEditVidaUtil(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Manutenção a cada (h)">
                  <Input type="number" min="1" step="1" value={editIntervaloManutencao} onChange={e => setEditIntervaloManutencao(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
                <Field label="Horas acumuladas">
                  <Input type="number" min="0" step="0.5" value={editHorasUso} onChange={e => setEditHorasUso(e.target.value)} className="h-8 bg-slate-950 text-white border-slate-700 text-xs" />
                </Field>
              </div>
            )}
          </div>

          {/* Footer fixo */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-900/90 shrink-0">
            <span className="text-[10px] text-slate-500">
              {editTab === 'rede' ? 'Configuração de comunicação' : 'Cálculo de depreciação horária'}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingPrinterId(null)} className="h-7 text-xs border-slate-700 bg-slate-950 text-slate-300">
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleUpdate} className="h-7 text-xs bg-indigo-600 text-white hover:bg-indigo-500">
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {maintenancePrinter && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !savingMaintenance) setMaintenancePrinter(null); }}><form onSubmit={submitMaintenance} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-bold text-white">Registrar manutenção</h3><p className="text-sm text-slate-400">{impressoras.find(item => item.id === maintenancePrinter)?.nome}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setMaintenancePrinter(null)}><X className="h-4 w-4" /></Button></div><fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-slate-300">O que foi feito?</legend>{MAINTENANCE_TASKS.map(task => <label key={task} className="flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-2.5 text-sm text-slate-200"><input type="checkbox" checked={maintenanceTasks.includes(task)} onChange={event => setMaintenanceTasks(previous => event.target.checked ? [...previous, task] : previous.filter(value => value !== task))} className="accent-indigo-500" />{task}</label>)}</fieldset><label className="block text-xs text-slate-300">Observação<textarea rows={3} value={maintenanceNote} onChange={event => setMaintenanceNote(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" placeholder="Detalhes opcionais" /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMaintenancePrinter(null)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button><Button type="submit" disabled={savingMaintenance} className="bg-indigo-600 text-white hover:bg-indigo-500">{savingMaintenance ? 'Salvando…' : 'Registrar manutenção'}</Button></div></form></div>}

    {/* MODAL DE REGISTRO DE FALHA & CONTABILIZAÇÃO DE PERDA */}
    <ModalRegistrarFalha
      isOpen={Boolean(failureModalPrinter)}
      onClose={() => setFailureModalPrinter(null)}
      printer={failureModalPrinter}
      initialProgress={
        failureModalPrinter
          ? (telemetryMap[failureModalPrinter.id]?.progressPercent ?? failureModalPrinter.progressoPercentual ?? 30)
          : 30
      }
    />
  </div>;
};

interface SummaryCardProps {
  label: string;
  value: number | string;
  tone: 'emerald' | 'amber' | 'rose' | 'orange' | 'sky' | 'indigo' | 'slate';
  icon: any;
  badge?: string;
  detail?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, tone, icon: Icon, badge, detail }) => {
  const toneMap = {
    emerald: {
      border: 'border-emerald-500/30 hover:border-emerald-500/60',
      iconBox: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
    amber: {
      border: 'border-amber-500/30 hover:border-amber-500/60',
      iconBox: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
    rose: {
      border: 'border-rose-500/30 hover:border-rose-500/60',
      iconBox: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      badge: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    },
    orange: {
      border: 'border-orange-500/30 hover:border-orange-500/60',
      iconBox: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      badge: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    },
    sky: {
      border: 'border-sky-500/30 hover:border-sky-500/60',
      iconBox: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
      badge: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    },
    indigo: {
      border: 'border-indigo-500/30 hover:border-indigo-500/60',
      iconBox: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      badge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    },
    slate: {
      border: 'border-slate-800 hover:border-slate-700',
      iconBox: 'bg-slate-800 text-slate-400',
      badge: 'border-slate-700 bg-slate-800 text-slate-300',
    },
  };
  const theme = toneMap[tone];

  return (
    <Card className={`bg-slate-900 border ${theme.border} rounded-2xl shadow-lg transition-all`}>
      <div className="p-5 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${theme.iconBox}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          </div>
          {badge && (
            <Badge className={`${theme.badge} text-[10px] px-2 py-0.5 font-bold`}>
              {badge}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-2xl lg:text-3xl font-black text-white tracking-tight">{value}</p>
        </div>
        {detail && (
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{detail}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-1 text-xs text-slate-300">{label}{children}</label>;