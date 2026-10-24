import { describe, it, expect } from 'vitest';
import { AiDiagnosticService } from './aiDiagnosticService';

describe('AiDiagnosticService', () => {
  it('detecta perguntas fora do escopo de 3D e não responde sem fundo', () => {
    const answer = AiDiagnosticService.getExpertAnswer('como cortar cabelo');
    expect(answer).toContain('Fora do Escopo de Manufatura Aditiva 3D');
    expect(answer).not.toContain('Temperatura e Fluidez');
    expect(answer).not.toContain('calibrada para a velocidade de fluxo');
  });

  it('detecta outras perguntas aleatórias (ex: culinária) e informa o escopo correto', () => {
    const answer = AiDiagnosticService.getExpertAnswer('como fazer receita de bolo de chocolate');
    expect(answer).toContain('Fora do Escopo de Manufatura Aditiva 3D');
  });

  it('responde corretamente e detalhadamente à pergunta de misturar PLA com PTEG', () => {
    const answer = AiDiagnosticService.getExpertAnswer('pode misturar filamento PLA com PTEG?');
    expect(answer).toContain('Misturar Filamento PLA com PETG');
    expect(answer).toContain('NÃO FUNCIONA');
    expect(answer).toContain('Zero-Gap Support');
    expect(answer).toContain('Suporte');
  });

  it('responde com parâmetros exatos sobre stringing em PETG', () => {
    const answer = AiDiagnosticService.getExpertAnswer('como tirar stringing e fiapos de PETG no orcaslicer');
    expect(answer).toContain('Stringing');
    expect(answer).toContain('Retração');
    expect(answer).toContain('Wipe');
  });

  it('responde com comparativo técnico entre Direct Drive e Bowden', () => {
    const answer = AiDiagnosticService.getExpertAnswer('qual a diferenca entre direct drive e bowden');
    expect(answer).toContain('Direct Drive');
    expect(answer).toContain('Bowden');
    expect(answer).toContain('flexíveis');
  });

  it('responde com procedimento de calibração para Klipper (Input Shaping & Pressure Advance)', () => {
    const answer = AiDiagnosticService.getExpertAnswer('como calibrar input shaping no klipper');
    expect(answer).toContain('Input Shaping');
    expect(answer).toContain('Klipper');
  });

  it('responde com parâmetros para evitar warping em ABS', () => {
    const answer = AiDiagnosticService.getExpertAnswer('minha peca de ABS esta descolando com warping da mesa');
    expect(answer).toContain('Warping');
    expect(answer).toContain('100°C a 110°C');
    expect(answer).toContain('Enclosure');
  });

  it('responde com guia acolhedor para quem está aprendendo e começando do zero', () => {
    const answer = AiDiagnosticService.getExpertAnswer('estou aprendendo, por onde comeco?');
    expect(answer).toContain('Guia Spartan 3D para Iniciantes');
    expect(answer).toContain('PLA');
    expect(answer).toContain('Fatiador');
    expect(answer).not.toContain('Fora do Escopo');
  });

  it('reconhece dúvidas cotidianas de iniciantes descritas sem jargões técnicos', () => {
    // Sintoma: Barulho tec tec
    const answerTecTec = AiDiagnosticService.getExpertAnswer('a impressora ta fazendo barulho de estalo tec tec e nao sai plastico');
    expect(answerTecTec).toContain('Barulho de Estalo');
    expect(answerTecTec).toContain('Z-Offset');

    // Sintoma: Peça soltou da mesa
    const answerSoltou = AiDiagnosticService.getExpertAnswer('a peca soltou da mesa no meio da impressao');
    expect(answerSoltou).toContain('Peça Não Gruda ou Soltou da Mesa');
    expect(answerSoltou).toContain('detergente');

    // Sintoma: Teia de aranha
    const answerTeia = AiDiagnosticService.getExpertAnswer('minha peca ficou parecendo cheia de teia de aranha');
    expect(answerTeia).toContain('Teia de Aranha');
    expect(answerTeia).toContain('Retração');
  });
});

