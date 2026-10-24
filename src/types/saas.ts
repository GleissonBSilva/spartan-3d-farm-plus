export type UserRole = 'admin' | 'client' | 'manager';
export type PlatformRole = 'admin' | 'developer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  platformRoles?: PlatformRole[];
  avatar: string;
  companyId?: string;
  companyName?: string;
  companyPhone?: string;
  planId?: string;
  status: 'active' | 'trialing' | 'overdue' | 'canceled';
  mrr: number;
  joinedAt: string;
  trialEndsAt?: string;
  aiCreditsRemaining?: number;
}

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  popular?: boolean;
  maxPrinters: number;
  maxProjects: number;
  maxFilaments: number;
  maxUsers: number;
  badge?: string;
  creditsAI?: number;
}

export interface MovimentacaoEstoque {
  id: string;
  filamentoId: string;
  tipo: 'consumption' | 'return' | 'adjustment' | 'purchase';
  quantidadeGramas: number;
  projetoId?: string;
  data: string;
  motivo?: string;
}

export interface FilamentoEstoque {
  id: string;
  companyId?: string;
  tipo: 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'ASA' | 'RESINA' | 'NYLON' | 'PC';
  cor: string;
  corHex: string;
  marca: string;
  pesoTotalG: number;
  pesoRestanteG: number;
  precoKg: number;
  pesoMinimoG?: number;
  temperaturaBico?: string;
  temperaturaMesa?: string;
}

export interface Impressora3D {
  id: string;
  companyId?: string;
  nome: string;
  modelo: string;
  tipo: 'FDM' | 'Resina SLA';
  status: 'imprimindo' | 'pausada' | 'disponivel' | 'manutencao' | 'desconectada';
  potenciaWatts: number;
  bicoMm: number;
  horasUso: number;
  limiteHorasManutencao?: number;
  horasDesdeManutencao?: number;
  intervaloManutencaoHoras?: number;
  projetoAtualId?: string;
  projetoAtual?: string;
  progressoPercentual?: number;
  custoInvestimento?: number;
  vidaUtilHoras?: number;
  depreciacaoHora?: number;
}

export interface EventoImpressora {
  id: string;
  impressoraId: string;
  tipo: string;
  payload: Record<string, unknown>;
  data: string;
}

export interface ProjectMaterial {
  id: string;
  materialId?: string; // ID do filamento no estoque (se vinculado)
  materialName: string;
  color: string;
  colorHex?: string;
  filamentType: 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'ASA' | 'RESINA' | 'NYLON' | 'PC';
  weightGrams: number | string;
  costPerGram: number;
  totalCost: number;
}

export interface MaterialVariation {
  id: string;
  name: string;
  colorCount: number;
  materials: ProjectMaterial[];
  totalWeightGrams: number;
  materialsCost: number;
  energyCost: number;
  depreciationCost: number;
  laborCost: number;
  totalCost: number;
  suggestedPrice: number;
  estimatedProfit: number;
}

export interface ProjetoImpressao3D {
  id: string;
  companyId?: string;
  nomePeca: string;
  clienteNome: string;
  clienteContato?: string;
  impressoraId?: string;
  impressoraNome?: string;
  pesoEstimadoG: number;
  tempoEstimadoHoras: number;
  quantidade?: number;
  dataEntrega?: string;
  materials: ProjectMaterial[];
  filamentoUtilizado?: string; // Descrição textual consolidada
  custoMaterial: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoMaoDeObra?: number;
  outrosCustos?: number;
  custoTotal: number;
  margemLucroPercentual?: number;
  precoCobrado: number;
  lucroLiquido: number;
  status: 'orcamento' | 'aprovado' | 'em_impressao' | 'concluido' | 'cancelado';
  estoqueBaixado?: boolean; // Flag de idempotência para controle de estoque
  dataCriacao: string;
  observacoes?: string;
  arquivoPath?: string;
  imagemPath?: string;
  quantidadeLote?: number;
  modoVenda?: string;
  descontoAtacado?: number;
  custoEmbalagem?: number;
  custoBrinde?: number;
  valorFrete?: number;
  formaPagamento?: 'pix' | 'credito' | 'debito' | 'dinheiro';
  parcelasCartao?: number;
  detalhesPagamento?: string;
}

export interface Invoice {
  id: string;
  companyId?: string;
  clientId: string;
  clientName: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  dueDate: string;
  paidAt?: string;
  method: 'pix' | 'credit_card' | 'boleto';
}

export interface SaaSMetrics {
  mrr: number;
  arr: number;
  activeClients: number;
  churnRate: number;
  ltv: number;
  revenueHistory: { month: string; revenue: number }[];
  planDistribution: { name: string; value: number; color: string }[];
}
