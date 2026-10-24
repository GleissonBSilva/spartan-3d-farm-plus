"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calculator, FileCode, FileText, TrendingUp, Clock3, ShoppingCart, Box, Package, Percent, Gift, Truck } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { ProjectMaterial, ProjetoImpressao3D } from '@/types/saas';
import { PricingService, PricingCalculationResult } from '@/services/pricingService';
import { PieceDetailsForm } from './calculator/PieceDetailsForm';
import { MultiMaterialSelector } from './calculator/MultiMaterialSelector';
import { ProductionCostParams } from './calculator/ProductionCostParams';
import { PricingSummaryCard } from './calculator/PricingSummaryCard';
import { VariationsGrid } from './calculator/VariationsGrid';
import { PaymentMethodSelector } from './calculator/PaymentMethodSelector';
import {
  PaymentMethodsService,
  PaymentMethodType,
  FarmPaymentSettings,
  PaymentCalculationResult,
} from '@/services/paymentMethodsService';
import { GcodeAnalyzerModal } from './GcodeAnalyzerModal';
import { OrcamentoPdfModal } from './OrcamentoPdfModal';
import { toast } from 'sonner';
import { uploadModelFile } from '@/services/fileService';
import { useAuth } from '@/context/AuthContext';

const parseTimeStringToDecimal = PricingService.parseTimeToDecimal;
const formatHours = PricingService.formatHours;

export const Calculadora3D: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const recalculateProject = location.state?.recalculateProject as ProjetoImpressao3D | undefined;
  const copyProject = location.state?.copyProject as ProjetoImpressao3D | undefined;
  const sourceProject = recalculateProject || copyProject;
  const { filamentos, impressoras, addProjeto, updateProjeto } = useSaaSData();
  const { user } = useAuth();

  // Dados Gerais do Projeto (Campos de simulação da peça iniciam vazios)
  const [nomePeca, setNomePeca] = useState(sourceProject?.nomePeca || '');
  const [clienteNome, setClienteNome] = useState(recalculateProject ? recalculateProject.clienteNome : '');
  const [clienteContato, setClienteContato] = useState(recalculateProject ? (recalculateProject.clienteContato || '') : '');
  const [tempoHoras, setTempoHoras] = useState<number | string>(sourceProject?.tempoEstimadoHoras || '');
  const [selectedImpressoraId, setSelectedImpressoraId] = useState(sourceProject?.impressoraId || '');
  const [observacoes] = useState(sourceProject?.observacoes || '');

  // Escala, Comercial e Extras (Com suporte a string para permitir apagar livremente)
  const [quantidadeLote, setQuantidadeLote] = useState<number | string>(sourceProject?.quantidadeLote ?? sourceProject?.quantidade ?? 1);
  const [modoVenda, setModoVenda] = useState<string>(sourceProject?.modoVenda ?? 'varejo');
  const [descontoAtacado, setDescontoAtacado] = useState<number | string>(sourceProject?.descontoAtacado ?? 13);
  const [custoEmbalagem, setCustoEmbalagem] = useState<number | string>(sourceProject?.custoEmbalagem ?? '');
  const [custoBrinde, setCustoBrinde] = useState<number | string>(sourceProject?.custoBrinde ?? '');
  const [valorFrete, setValorFrete] = useState<number | string>(sourceProject?.valorFrete ?? '');

  // Forma de Pagamento e Condições Comerciais (Crédito, Dinheiro, Pix, Débito)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>(
    sourceProject?.formaPagamento || 'pix'
  );
  const [selectedInstallments, setSelectedInstallments] = useState<number>(
    sourceProject?.parcelasCartao || 1
  );
  const [paymentSettings, setPaymentSettings] = useState<FarmPaymentSettings>(() =>
    PaymentMethodsService.getSettings(user?.id)
  );

  const refreshPaymentSettings = () => {
    setPaymentSettings(PaymentMethodsService.getSettings(user?.id ?? null));
  };

  useEffect(() => {
    let cancelled = false;
    setPaymentSettings(PaymentMethodsService.getSettings(user?.id ?? null));
    if (user?.id) {
      void PaymentMethodsService.syncFromSupabase(user.id).then(synced => {
        if (!cancelled) {
          setPaymentSettings(synced);
        }
      });
    }
    const handleSettingsUpdated = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ userId?: string | null }>;
      if (customEvt.detail?.userId && customEvt.detail.userId !== user?.id) {
        return;
      }
      if (!cancelled) {
        setPaymentSettings(PaymentMethodsService.getSettings(user?.id ?? null));
      }
    };
    window.addEventListener('spartan_payment_settings_updated', handleSettingsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('spartan_payment_settings_updated', handleSettingsUpdated);
    };
  }, [user?.id]);

  // Parâmetros Financeiros e Operacionais (Mantidos os padrões operacionais da farm)
  const [tarifaKwh, setTarifaKwh] = useState(0.85);
  const [depreciacaoHora, setDepreciacaoHora] = useState(0.50);
  const [taxaFalhaPorcento, setTaxaFalhaPorcento] = useState(10);
  const [custoMaoDeObra, setCustoMaoDeObra] = useState<number | string>(sourceProject?.custoMaoDeObra ?? 15.0);
  const [outrosCustos] = useState(sourceProject?.outrosCustos ?? 0.0);
  const [margemLucroPorcento, setMargemLucroPorcento] = useState(sourceProject?.margemLucroPercentual ?? 140);

  // Modais e Abas
  const [gcodeModal, setGcodeModal] = useState(false);
  const [pdfModal, setPdfModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'calculadora' | 'variacoes'>('calculadora');

  // MATERIAIS SELECIONADOS (Até 4 cores/materiais)
  const [materials, setMaterials] = useState<ProjectMaterial[]>(sourceProject?.materials || []);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | undefined>(sourceProject?.arquivoPath);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    if (materials.length || !filamentos.length) return;
    const filament = filamentos[0];
    const costPerGram = filament.precoKg / 1000;
    const initialWeight = sourceProject?.materials?.[0]?.weightGrams ?? '';
    const initialCost = typeof initialWeight === 'number' ? Number((initialWeight * costPerGram).toFixed(2)) : 0;
    setMaterials([{
      id: crypto.randomUUID(),
      materialId: filament.id,
      materialName: `${filament.tipo} - ${filament.cor}`,
      color: filament.cor,
      colorHex: filament.colorHex,
      filamentType: filament.tipo,
      weightGrams: initialWeight,
      costPerGram,
      totalCost: initialCost,
    }]);
  }, [filamentos, materials.length, sourceProject]);
  
  const impressoraAtual = selectedImpressoraId ? impressoras.find(i => i.id === selectedImpressoraId) : undefined;

  const totalGrams = useMemo(() => {
    return materials.reduce((acc, m) => acc + (Number(m.weightGrams) || 0), 0);
  }, [materials]);

  const safeTempoDecimal = useMemo(() => {
    return parseTimeStringToDecimal(tempoHoras);
  }, [tempoHoras]);

  const hasSimulationData = totalGrams > 0 && safeTempoDecimal > 0;

  // Cálculo de Preço Avançado Corrigido
  const calculationResult: PricingCalculationResult = useMemo(() => {
    const safeLote = quantidadeLote === '' ? 1 : Number(quantidadeLote) || 1;
    const safeEmbalagem = custoEmbalagem === '' ? 0 : Number(custoEmbalagem) || 0;
    const safeBrinde = custoBrinde === '' ? 0 : Number(custoBrinde) || 0;
    const safeFrete = valorFrete === '' ? 0 : Number(valorFrete) || 0;
    const safeMaoDeObra = custoMaoDeObra === '' ? 0 : Number(custoMaoDeObra) || 0;
    const safeDesconto = descontoAtacado === '' ? 0 : Number(descontoAtacado) || 0;

    // 1. Calcula o custo de 1 UNIDADE padrão
    const unitBaseResult = PricingService.calculateProjectPricing({
      materials,
      printTimeHours: safeTempoDecimal,
      printerPowerWatts: impressoraAtual?.potenciaWatts || 350,
      kwhEnergyRate: tarifaKwh,
      depreciationHourlyRate: depreciacaoHora,
      failureRatePercent: taxaFalhaPorcento,
      laborCost: safeMaoDeObra,
      otherCosts: outrosCustos,
      profitMarginPercent: margemLucroPorcento,
    });

    // Se ainda não foram preenchidos os dados de simulação (tempo ou peso), mantém os custos e preços zerados até o fatiamento
    if (!hasSimulationData) {
      return {
        ...unitBaseResult,
        totalWeightGrams: 0,
        materialsBaseCost: 0,
        materialsWithFailureCost: 0,
        kwhTotal: 0,
        energyCost: 0,
        depreciationCost: 0,
        laborCost: 0,
        otherCosts: 0,
        totalProductionCost: 0,
        suggestedPrice: 0,
        estimatedProfit: 0,
        marginRealPercent: 0,
        valorFrete: safeFrete,
      };
    }

    // 2. Aplica multiplicador do Lote aos custos operacionais de fabricação
    const lotMaterialsCost = unitBaseResult.materialsWithFailureCost * safeLote;
    const lotEnergyCost = unitBaseResult.energyCost * safeLote;
    const lotDepreciationCost = unitBaseResult.depreciationCost * safeLote;
    const lotLaborCost = safeMaoDeObra * safeLote;
    const lotWeight = unitBaseResult.totalWeightGrams * safeLote;

    const lotCostFabrication = lotMaterialsCost + lotEnergyCost + lotDepreciationCost + lotLaborCost;
    
    // Custos extras variáveis (embalagem e brinde somados ao custo total)
    const extraVariableCosts = safeEmbalagem + safeBrinde;
    const finalLotCost = lotCostFabrication + extraVariableCosts;

    // 3. Preço Final = Custo Total de Fabricação * (1 + margem/100) + Frete
    let totalBatchSuggestedPrice = finalLotCost * (1 + (Number(margemLucroPorcento) || 0) / 100);

    // Verifica Modo de Venda (Atacado x Varejo) sobre o preço sugerido do lote
    if (modoVenda === 'atacado') {
      totalBatchSuggestedPrice = totalBatchSuggestedPrice * (1 - (safeDesconto / 100));
    }

    const finalLotPrice = totalBatchSuggestedPrice + safeFrete;
    const finalLotProfit = finalLotPrice - finalLotCost - safeFrete;
    const realMargin = finalLotPrice > 0 ? (finalLotProfit / finalLotPrice) * 100 : 0;

    // 4. Retorna o objeto consolidado para alimentar o PricingSummaryCard
    return {
      ...unitBaseResult,
      totalWeightGrams: lotWeight,
      materialsWithFailureCost: lotMaterialsCost,
      energyCost: lotEnergyCost,
      depreciationCost: lotDepreciationCost,
      laborCost: lotLaborCost,
      totalProductionCost: Number(finalLotCost.toFixed(2)),
      suggestedPrice: Number(finalLotPrice.toFixed(2)),
      estimatedProfit: Number(finalLotProfit.toFixed(2)),
      marginRealPercent: Number(realMargin.toFixed(2)),
      valorFrete: safeFrete,
    };
  }, [
    materials, safeTempoDecimal, hasSimulationData, impressoraAtual, tarifaKwh, depreciacaoHora, 
    taxaFalhaPorcento, custoMaoDeObra, outrosCustos, margemLucroPorcento,
    quantidadeLote, modoVenda, descontoAtacado, custoEmbalagem, custoBrinde, valorFrete
  ]);

  // Impacto da Forma de Pagamento (Desconto ou Taxa) sobre o Preço Final
  const paymentResult: PaymentCalculationResult = useMemo(() => {
    return PaymentMethodsService.calculatePaymentEffect(
      calculationResult.suggestedPrice,
      selectedPaymentMethod,
      selectedInstallments,
      paymentSettings
    );
  }, [calculationResult.suggestedPrice, selectedPaymentMethod, selectedInstallments, paymentSettings]);

  // Simulação de Variações de 1 a 4 Cores
  const variations = useMemo(() => {
    const safeMaoDeObra = custoMaoDeObra === '' ? 0 : Number(custoMaoDeObra) || 0;
    const safeTempoDecimal = parseTimeStringToDecimal(tempoHoras);
    return PricingService.generateMaterialVariations(materials, {
      printTimeHours: safeTempoDecimal,
      printerPowerWatts: impressoraAtual?.potenciaWatts || 350,
      kwhEnergyRate: tarifaKwh,
      depreciationHourlyRate: depreciacaoHora,
      failureRatePercent: taxaFalhaPorcento,
      laborCost: safeMaoDeObra,
      otherCosts: outrosCustos,
      profitMarginPercent: margemLucroPorcento,
    });
  }, [
    materials, tempoHoras, impressoraAtual, tarifaKwh, depreciacaoHora, 
    taxaFalhaPorcento, custoMaoDeObra, outrosCustos, margemLucroPorcento
  ]);

  // Adicionar novo material (Máx 4)
  const handleAddMaterial = () => {
    if (!filamentos.length) {
      toast.error('Cadastre pelo menos um carretel no estoque antes de montar um orçamento.');
      return;
    }
    if (materials.length >= 4) {
      toast.warning('Limite de até 4 materiais/cores por projeto atingido para esta simulação.');
      return;
    }

    const availableFil = filamentos[materials.length] || filamentos[0];
    const newMat: ProjectMaterial = {
      id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      materialId: availableFil?.id,
      materialName: `${availableFil?.tipo || 'PLA'} - ${availableFil?.cor || 'Cor'}`,
      color: availableFil?.cor || 'Padrão',
      colorHex: availableFil?.colorHex || '#6366f1',
      filamentType: availableFil?.tipo || 'PLA',
      weightGrams: '',
      costPerGram: (availableFil?.precoKg || 100) / 1000,
      totalCost: 0,
    };

    setMaterials(prev => [...prev, newMat]);
    toast.success(`Material ${materials.length + 1} adicionado ao projeto.`);
  };

  // Remover material
  const handleRemoveMaterial = (matId: string) => {
    if (materials.length <= 1) {
      toast.error('O projeto precisa de pelo menos 1 material cadastrado.');
      return;
    }
    setMaterials(prev => prev.filter(m => m.id !== matId));
  };

  // Atualizar campo de um material
  const handleUpdateMaterial = (matId: string, field: 'materialId' | 'weightGrams', value: string | number) => {
    setMaterials(prev =>
      prev.map(m => {
        if (m.id === matId) {
          if (field === 'materialId') {
            const found = filamentos.find(f => f.id === value);
            if (found) {
              const costPerG = found.precoKg / 1000;
              return {
                ...m,
                materialId: found.id,
                materialName: `${found.tipo} - ${found.cor}`,
                color: found.cor,
                colorHex: found.colorHex,
                filamentType: found.tipo,
                costPerGram: costPerG,
                totalCost: Number((Number(m.weightGrams || 0) * costPerG).toFixed(2)),
              };
            }
          } else if (field === 'weightGrams') {
            const w = value === '' ? '' : Math.max(0, Number(value) || 0);
            return {
              ...m,
              weightGrams: w,
              totalCost: Number(((typeof w === 'number' ? w : 0) * m.costPerGram).toFixed(2)),
            };
          }
        }
        return m;
      })
    );
  };

  // Aplicar dados do G-code importado
  const handleApplyGcodeData = (data: { nome: string; peso: number; tempo: number; filePath?: string }) => {
    setNomePeca(data.nome);
    setTempoHoras(data.tempo);
    setUploadedFilePath(data.filePath);

    if (materials.length === 1) {
      setMaterials(prev => [
        {
          ...prev[0],
          weightGrams: data.peso,
          totalCost: Number((data.peso * prev[0].costPerGram).toFixed(2)),
        },
      ]);
    } else {
      const splitWeight = Math.round(data.peso / materials.length);
      setMaterials(prev =>
        prev.map(m => ({
          ...m,
          weightGrams: splitWeight,
          totalCost: Number((splitWeight * m.costPerGram).toFixed(2)),
        }))
      );
    }
    toast.success('Parâmetros de G-Code integrados à calculadora multimaterial!');
  };

  // Salvar Projeto corrigido (Atualiza se for recalculateProject, caso contrário cria um novo orçamento)
  const handleSalvarProjeto = async (status: 'orcamento' | 'em_impressao') => {
    if (!nomePeca.trim()) {
      toast.error('Informe o nome da peça ou arquivo STL.');
      return;
    }
    if (!materials.length) {
      toast.error('Adicione um filamento real do seu estoque antes de salvar o orçamento.');
      return;
    }
    if (safeTempoDecimal <= 0) {
      toast.error('Informe o tempo estimado de impressão da peça.');
      return;
    }
    if (totalGrams <= 0) {
      toast.error('Informe o peso em gramas do filamento a ser utilizado.');
      return;
    }

    if (status === 'em_impressao') {
      if (!selectedImpressoraId) {
        toast.error('Selecione uma impressora antes de aprovar e iniciar a produção.');
        return;
      }
      const printer = impressoras.find(i => i.id === selectedImpressoraId);
      if (!printer || printer.status !== 'disponivel') {
        toast.error(`A impressora ${printer?.nome || ''} não está disponível no momento. Para iniciar a produção agora, escolha uma máquina livre ou salve como Orçamento.`);
        return;
      }
    }

    const matSummary = materials.map(m => `${m.filamentType} ${m.color} (${Number(m.weightGrams) || 0}g)`).join(' + ');
    setSavingProject(true);
    
    try {
      if (imageFile && !user?.companyId) throw new Error('Sua conta não está vinculada a uma empresa.');
      const imagePath = imageFile && user?.companyId ? await uploadModelFile(imageFile, user.companyId) : undefined;
      
      const finalPriceToSave = hasSimulationData ? paymentResult.finalPrice : calculationResult.suggestedPrice;
      const finalProfitToSave = hasSimulationData
        ? Number((finalPriceToSave - calculationResult.totalProductionCost - (Number(valorFrete) || 0)).toFixed(2))
        : 0;

      const projectData = {
        nomePeca,
        clienteNome,
        clienteContato: clienteContato.trim() || undefined,
        impressoraId: selectedImpressoraId || undefined,
        impressoraNome: impressoraAtual?.nome || 'A definir na aprovação',
        pesoEstimadoG: calculationResult.totalWeightGrams,
        tempoEstimadoHoras: safeTempoDecimal,
        materials: materials.map(m => ({
          ...m,
          weightGrams: Number(m.weightGrams) || 0,
        })),
        filamentoUtilizado: matSummary,
        custoMaterial: calculationResult.materialsWithFailureCost,
        custoEnergia: calculationResult.energyCost,
        custoDepreciacao: calculationResult.depreciationCost,
        custoMaoDeObra: custoMaoDeObra === '' ? 0 : Number(custoMaoDeObra) || 0,
        outrosCustos,
        custoTotal: calculationResult.totalProductionCost,
        margemLucroPercentual: margemLucroPorcento,
        precoCobrado: finalPriceToSave,
        lucroLiquido: finalProfitToSave,
        status: recalculateProject ? status : status,
        observacoes,
        arquivoPath: uploadedFilePath || sourceProject?.arquivoPath,
        imagemPath: imagePath || sourceProject?.imagemPath,
        quantidade: quantidadeLote === '' ? 1 : Number(quantidadeLote) || 1,
        quantidadeLote: quantidadeLote === '' ? 1 : Number(quantidadeLote) || 1,
        modoVenda,
        descontoAtacado: descontoAtacado === '' ? 0 : Number(descontoAtacado) || 0,
        custoEmbalagem: custoEmbalagem === '' ? 0 : Number(custoEmbalagem) || 0,
        custoBrinde: custoBrinde === '' ? 0 : Number(custoBrinde) || 0,
        valorFrete: valorFrete === '' ? 0 : Number(valorFrete) || 0,
        formaPagamento: selectedPaymentMethod,
        parcelasCartao: selectedPaymentMethod === 'credito' ? selectedInstallments : 1,
        detalhesPagamento: paymentResult.summaryText,
      };

      let success = false;
      if (recalculateProject) {
        success = await updateProjeto(recalculateProject.id, projectData);
      } else {
        success = await addProjeto(projectData);
      }
        
      if (success) {
        setImageFile(null);
        toast.success(
          recalculateProject
            ? 'Projeto atualizado com sucesso!'
            : status === 'em_impressao'
            ? 'Projeto aprovado e produção iniciada com sucesso!'
            : 'Novo orçamento salvo com sucesso!'
        );
        navigate('/cliente/projetos', { replace: true, state: null });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o projeto.');
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Selector Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => setActiveTab('calculadora')}
            className={`text-xs rounded-xl h-9 px-4 font-bold ${
              activeTab === 'calculadora'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4 mr-1.5"/> Calculadora & Multimaterial (Até 4 Cores)
          </Button>

          <Button 
            size="sm" 
            onClick={() => setActiveTab('variacoes')}
            className={`text-xs rounded-xl h-9 px-4 font-bold ${
              activeTab === 'variacoes'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 mr-1.5 text-amber-400"/> Simular Variações (1 a 4 Cores)
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            type="button" 
            onClick={() => setGcodeModal(true)}
            className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs rounded-xl h-9"
          >
            <FileCode className="w-3.5 h-3.5 mr-1 text-cyan-400"/>
            Importar G-Code / .3MF
          </Button>
          <Button 
            size="sm" 
            type="button" 
            onClick={() => setPdfModal(true)}
            variant="outline"
            className="bg-slate-950 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/30 text-xs rounded-xl h-9"
          >
            <FileText className="w-3.5 h-3.5 mr-1"/>
            Gerar Proposta PDF
          </Button>
        </div>
      </div>

      {recalculateProject && <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100"><strong>Recalculando projeto existente:</strong> {recalculateProject.nomePeca}. Ao salvar, o sistema atualiza os custos e o preço deste projeto sem criar uma cópia.</div>}
      {copyProject && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"><strong>Novo orçamento baseado em:</strong> {copyProject.nomePeca}. O projeto original será mantido; informe o cliente e ajuste os dados antes de salvar.</div>}

      {activeTab === 'calculadora' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal dos Formulários */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. DADOS DA PEÇA & CLIENTE */}
            <div className="relative">
              <PieceDetailsForm 
                clienteNome={clienteNome} 
                clienteContato={clienteContato}
                imageFile={imageFile} 
                impressoras={impressoras} 
                nomePeca={nomePeca} 
                selectedImpressoraId={selectedImpressoraId} 
                setClienteNome={setClienteNome} 
                setClienteContato={setClienteContato}
                setImageFile={setImageFile} 
                setNomePeca={setNomePeca} 
                setSelectedImpressoraId={setSelectedImpressoraId} 
                setTempoHoras={setTempoHoras} 
                tempoHoras={tempoHoras}
              />
            </div>

            {/* ========================================== */}
            {/* 2. COMERCIAL, ESCALA & EXTRAS            */}
            {/* ========================================== */}
            <div className="bg-[hsla(222,47%,11%,0.95)] rounded-2xl p-5 border border-slate-800 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <ShoppingCart className="w-4 h-4 text-emerald-400"/> Comercial, Escala & Extras
                </h3>
                
                {/* STATUS DO MODO DE VENDA */}
                <div
                  className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    modoVenda === 'atacado'
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-700 bg-[rgb(210, 216, 226)] text-slate-400'
                  }`}
                >
                  <ShoppingCart className="h-3 w-3" />
                  {modoVenda === 'atacado' ? 'Venda em atacado' : 'Venda em varejo'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Lote */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    QUANTIDADE (LOTE)
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={quantidadeLote} 
                    onChange={(e) => setQuantidadeLote(e.target.value === '' ? '' : e.target.value)}
                    className="bg-[rgb(8,11,19)] text-white rounded-xl border border-white p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>

                {/* Modo de Venda */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    MODO DE VENDA
                  </label>
                  <select 
                    value={modoVenda}
                    onChange={(e) => setModoVenda(e.target.value)}
                    className="bg-[rgb(8,11,19)] text-white rounded-xl border border-white p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="varejo" className="bg-[rgb(19,22,34)] text-white">Varejo (Padrão)</option>
                    <option value="atacado" className="bg-[rgb(19,22,34)] text-white">Atacado</option>
                  </select>
                </div>

                {/* Desconto Atacado */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    DESC. ATACADO (%)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={descontoAtacado}
                      onChange={(e) => setDescontoAtacado(e.target.value === '' ? '' : e.target.value)}
                      disabled={modoVenda === 'varejo'}
                      className={`bg-[rgb(8,11,19)] text-white rounded-xl border border-slate-200/90 p-2.5 text-sm w-full focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${modoVenda === 'varejo' ? 'opacity-100 cursor-not-allowed' : ''}`} 
                    />
                    <span className="absolute right-3.5 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>

                {/* Embalagem */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    EMBALAGEM (R$)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01" 
                    value={custoEmbalagem}
                    onChange={(e) => setCustoEmbalagem(e.target.value === '' ? '' : e.target.value)}
                    className="bg-[rgb(8,11,19)] text-white rounded-xl border border-white p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>

                {/* Brinde */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    CARTÃO/BRINDE (R$)
                  </label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01"
                    value={custoBrinde}
                    onChange={(e) => setCustoBrinde(e.target.value === '' ? '' : e.target.value)}
                    className="bg-[rgb(8,11,19)] text-white rounded-xl border border-white p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>

                {/* Frete */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    FRETE (R$)
                  </label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01"
                    value={valorFrete}
                    onChange={(e) => setValorFrete(e.target.value === '' ? '' : e.target.value)}
                    className="bg-[rgb(8,11,19)] text-white rounded-xl border border-white p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>
              </div>
            </div>
            {/* ========================================== */}

            {/* ========================================== */}
            {/* 3. FORMA DE PAGAMENTO & CONDIÇÕES COMERCIAIS */}
            {/* ========================================== */}
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              selectedInstallments={selectedInstallments}
              paymentResult={paymentResult}
              basePrice={calculationResult.suggestedPrice}
              paymentSettings={paymentSettings}
              onSelectMethod={setSelectedPaymentMethod}
              onSelectInstallments={setSelectedInstallments}
              onUpdateSettings={(newSettings) => {
                setPaymentSettings(newSettings);
                PaymentMethodsService.savePaymentSettings(newSettings, user?.id);
              }}
            />

            {/* 4. MATERIAIS & CORES */}
            <MultiMaterialSelector 
              filamentos={filamentos} 
              materials={materials} 
              onAddMaterial={handleAddMaterial} 
              onRemoveMaterial={handleRemoveMaterial} 
              onUpdateMaterial={handleUpdateMaterial}
            />

            {/* 5. CUSTOS OPERACIONAIS */}
            <ProductionCostParams 
              custoMaoDeObra={custoMaoDeObra} 
              depreciacaoHora={depreciacaoHora} 
              margemLucroPorcento={margemLucroPorcento} 
              marginRealPercent={calculationResult.marginRealPercent} 
              setCustoMaoDeObra={setCustoMaoDeObra} 
              setDepreciacaoHora={setDepreciacaoHora} 
              setMargemLucroPorcento={setMargemLucroPorcento} 
              setTarifaKwh={setTarifaKwh} 
              setTaxaFalhaPorcento={setTaxaFalhaPorcento} 
              tarifaKwh={tarifaKwh} 
              taxaFalhaPorcento={taxaFalhaPorcento}
            />
          </div>

          {/* Coluna Lateral: Resumo de Custos e Ações */}
          <div>
            <PricingSummaryCard 
              calculationResult={calculationResult} 
              paymentResult={paymentResult}
              nomePeca={nomePeca} 
              taxaFalhaPorcento={taxaFalhaPorcento}
              hasSimulationData={hasSimulationData}
              onSalvarOrcamento={() => handleSalvarProjeto('orcamento')}
              onAprovarProducao={() => handleSalvarProjeto('em_impressao')}
              saving={savingProject}
              recalculating={Boolean(recalculateProject)}
              copying={Boolean(copyProject)}
            />
          </div>
        </div>
      )}

      {/* ABA: SIMULADOR DE VARIAÇÕES (1 A 4 CORES) */}
      {activeTab === 'variacoes' && (
        <VariationsGrid 
          nomePeca={nomePeca} 
          variations={variations}
          onSelectVariation={(selectedMats, count) => {
            setMaterials(selectedMats);
            setActiveTab('calculadora');
            toast.success(`Configuração de ${count} cores carregada na calculadora principal!`);
          }}
        />
      )}

      {/* Modais Integrados */}
      <GcodeAnalyzerModal 
        isOpen={gcodeModal} 
        onClose={() => setGcodeModal(false)}
        onApplyData={handleApplyGcodeData}
      />

      <OrcamentoPdfModal 
        isOpen={pdfModal} 
        onClose={() => setPdfModal(false)}
        projeto={{
          nomePeca,
          clienteNome,
          clienteContato: clienteContato.trim() || undefined,
          materials,
          filamentoUtilizado: materials.map(m => `${m.filamentType} ${m.color} (${m.weightGrams}g)`).join(' + '),
          pesoEstimadoG: calculationResult.totalWeightGrams,
          tempoEstimadoHoras: parseTimeStringToDecimal(tempoHoras),
          precoCobrado: hasSimulationData ? paymentResult.finalPrice : calculationResult.suggestedPrice,
          formaPagamento: selectedPaymentMethod,
          parcelasCartao: selectedPaymentMethod === 'credito' ? selectedInstallments : 1,
          detalhesPagamento: paymentResult.summaryText,
        }}
      />
    </div>
  );
};