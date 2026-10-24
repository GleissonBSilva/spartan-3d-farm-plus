/**
 * Spartan 3D — Motor Especialista de Diagnóstico Técnico & IA
 * Garante respostas aprofundadas, exatas e personalizadas para qualquer dúvida de manufatura aditiva 3D
 */

import { supabase } from '@/lib/supabase';

export interface AiDiagnosticResult {
  answer: string;
  model: string;
  source: 'supabase_edge' | 'direct_llm' | 'spartan_expert_engine';
}

const CUSTOM_AI_KEY_STORAGE_PREFIX = 'spartan_custom_ai_key_';
const CUSTOM_AI_PROVIDER_STORAGE_PREFIX = 'spartan_custom_ai_provider_';

export class AiDiagnosticService {
  private static currentUserId: string | null = null;

  public static setCurrentUser(userId: string | null): void {
    this.currentUserId = userId;
    try {
      localStorage.removeItem('spartan_custom_ai_key');
      localStorage.removeItem('spartan_custom_ai_provider');
    } catch {
      // Ignore storage access errors
    }
  }

  /**
   * Obtém chave personalizada configurada pelo usuário (Groq, OpenAI, etc.)
   */
  public static getCustomApiKey(userId?: string | null): string {
    const uid = userId ?? this.currentUserId;
    if (!uid) return '';
    return localStorage.getItem(`${CUSTOM_AI_KEY_STORAGE_PREFIX}${uid}`)?.trim() || '';
  }

  public static getCustomProvider(userId?: string | null): 'groq' | 'openai' {
    const uid = userId ?? this.currentUserId;
    if (!uid) return 'groq';
    const p = localStorage.getItem(`${CUSTOM_AI_PROVIDER_STORAGE_PREFIX}${uid}`);
    return p === 'openai' ? 'openai' : 'groq';
  }

  public static saveCustomAiConfig(key: string, provider: 'groq' | 'openai', userId?: string | null): void {
    const uid = userId ?? this.currentUserId;
    if (!uid) return;
    if (key.trim()) {
      localStorage.setItem(`${CUSTOM_AI_KEY_STORAGE_PREFIX}${uid}`, key.trim());
      localStorage.setItem(`${CUSTOM_AI_PROVIDER_STORAGE_PREFIX}${uid}`, provider);
    } else {
      localStorage.removeItem(`${CUSTOM_AI_KEY_STORAGE_PREFIX}${uid}`);
      localStorage.removeItem(`${CUSTOM_AI_PROVIDER_STORAGE_PREFIX}${uid}`);
    }
  }

  /**
   * Normaliza termos técnicos, gírias e erros comuns de digitação em impressão 3D
   */
  public static normalizeQuestion(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/pteg/g, 'petg')
      .replace(/pétg/g, 'petg')
      .replace(/pla\+/g, 'pla plus')
      .replace(/abs\+/g, 'abs plus')
      .replace(/orcaslicer/g, 'orca')
      .replace(/bambu studio/g, 'bambu')
      .replace(/bambustudio/g, 'bambu')
      .replace(/cura slicer/g, 'cura')
      .replace(/prusaslicer/g, 'prusa')
      .replace(/z offset/g, 'z-offset')
      .replace(/hot end/g, 'hotend')
      .trim();
  }

  /**
   * Valida se a pergunta está relacionada ao ecossistema de manufatura aditiva, impressão 3D ou farms
   */
  public static isRelevant3DTopic(question: string): boolean {
    const q = this.normalizeQuestion(question);

    const keywords = [
      // Materiais e Polímeros
      'pla', 'petg', 'abs', 'asa', 'tpu', 'nylon', 'resina', 'resinas', 'pc', 'policarbonato',
      'pvb', 'pva', 'hips', 'carbono', 'wood', 'madeira', 'silk', 'filamento', 'filamentos',
      'carretel', 'bobina', 'polimero', 'material', 'materiais',
      // Termos de Impressão e Fatiamento
      'impressora', 'impressoras', 'impressao', 'imprimir', 'fatiador', 'fatiamento', 'fatiar',
      'orca', 'cura', 'bambu', 'prusa', 'creality', 'ender', 'k1', 'voron', 'klipper', 'marlin',
      'gcode', 'stl', '3mf', 'cad', 'cam',
      // Hardware e Componentes
      'bico', 'nozzle', 'hotend', 'heatbreak', 'garganta', 'dissipador', 'bloco', 'mesa', 'bed',
      'chapa', 'pei', 'extrusor', 'extrusora', 'direct drive', 'bowden', 'eixo', 'correia',
      'motor', 'nivelamento', 'bltouch', 'sensor',
      // Falhas e Parâmetros Operacionais
      'stringing', 'fiapo', 'fiapos', 'teia', 'teias', 'warping', 'descol', 'empen', 'delamin',
      'entup', 'clog', 'clogging', 'cold pull', 'subextrus', 'superextrus', 'z-hop', 'retra',
      'camada', 'primeira camada', 'z-offset', 'brim', 'skirt', 'raft', 'infill', 'preenchimento',
      'gyroid', 'parede', 'paredes', 'perimetro', 'suporte', 'suportes', 'velocidade', 'aceleracao',
      'resfriamento', 'ventoinha', 'fan', 'temperatura', 'fluxo', 'flow rate', 'pressure advance',
      'linear advance', 'input shaping',
      // Termos de Aprendizado, Iniciantes e Descrições Cotidianas
      'iniciante', 'iniciantes', 'aprender', 'aprendendo', 'comecar', 'comeco', 'iniciar',
      'primeira impressao', 'dicas', 'passo a passo', 'guia', 'tutorial', 'ajuda', 'socorro',
      'grud', 'grudar', 'soltou', 'soltando', 'descolou', 'solta', 'caiu',
      'tec tec', 'tac tac', 'estalo', 'estalos', 'barulho', 'estalando', 'clique',
      'nao sai', 'parou de sair', 'nao derrete', 'parou',
      'teia', 'aranha', 'cabelo de anjo', 'fiozinhos', 'fios',
      'quebrando', 'fraca', 'rachando', 'rachadura', 'quebra facil',
      'plastico', 'plasticos',
      // Negócio e Gestão de Farm
      'farm', 'orcamento', 'precific', 'cobrar', 'preco', 'custo', 'mrr', 'manutencao', 'producao',
    ];

    return keywords.some(k => q.includes(k));
  }

  /**
   * Resposta para perguntas fora do escopo de impressão 3D
   */
  public static getOutOfScopeResponse(question: string): string {
    return `### ⚠️ Consulta Fora do Escopo de Manufatura Aditiva 3D

Identifiquei que sua pergunta:
> **"${question}"**

não se refere a **impressão 3D, fatiamento, polímeros ou gestão de farms**.

---

#### 🎯 Em que o Spartan 3D Copilot é especializado:
1. **Engenharia de Materiais:** Compatibilidade, temperaturas e secagem de **PLA, PETG, ABS, ASA, TPU, Nylon, Resinas e Compósitos**.
2. **Resolução de Falhas Críticas:** Correção de *warping* (descolamento), *stringing* (fiapos/teias), entupimentos (*clogging*), delaminação entre camadas e calibração de Z-offset.
3. **Parâmetros de Fatiamento:** Perfis otimizados para **OrcaSlicer, Bambu Studio, Ultimaker Cura e PrusaSlicer**.
4. **Hardware & Firmwares:** Otimização de Klipper (*Input Shaping e Pressure Advance*), sistemas Direct Drive vs Bowden e bicos especiais (*0.2mm a 0.8mm em aço endurecido*).
5. **Comercial & Farm:** Precificação de peças, cálculo de consumo de filamento, depreciação de máquinas e estimativa de lucro por lote.

💡 *Por favor, digite uma dúvida técnica sobre sua impressora, material ou projeto de impressão 3D!*`;
  }

  /**
   * Gera resposta técnica especializada diretamente baseada no assunto perguntado
   */
  public static getExpertAnswer(question: string): string {
    const q = this.normalizeQuestion(question);

    // Validação de Escopo: se não for sobre 3D, não gera resposta alucinatória
    if (!this.isRelevant3DTopic(question)) {
      return this.getOutOfScopeResponse(question);
    }

    // 0. Guia Acolhedor para Iniciantes e Quem Está Aprendendo do Zero
    if (
      q.includes('iniciante') ||
      q.includes('aprend') ||
      (q.includes('comec') && !q.includes('comeco a precific')) ||
      q.includes('primeira impressao') ||
      q.includes('passo a passo') ||
      q.includes('por onde comeco') ||
      q.includes('como funciona') ||
      q.includes('dicas para comecar')
    ) {
      return `### 🔰 Guia Spartan 3D para Iniciantes: Como Começar do Zero com Sucesso!

Seja muito bem-vindo ao mundo da impressão 3D! Você **não precisa** decorar nomes técnicos nem configurações difíceis para começar a imprimir peças de altíssima qualidade.

---

#### 1. Os 3 Pilares Simples da Impressão 3D
1. **O Modelo 3D (.STL ou .3MF):** É o arquivo digital da peça que você pode baixar gratuitamente em sites como *Printables, MakerWorld ou Thingiverse*.
2. **O Programa Fatiador (Ex: OrcaSlicer, Bambu Studio ou Ultimaker Cura):** É o aplicativo no seu computador onde você abre a peça e ele a fatia em centenas de camadas horizontais para a impressora entender.
3. **O Filamento:** O carretel de plástico que a impressora derrete e deposita camada por camada.

---

#### 2. O Melhor Filamento para Quem Está Começando: PLA
* **Por que o PLA?** É o plástico mais amigável do mercado: não solta cheiro ruim, não deforma as pontas da peça e não necessita de impressora fechada.
* **Configuração básica recomendada para PLA:**
  * **Temperatura do Bico:** \`200°C a 210°C\`
  * **Temperatura da Mesa:** \`55°C a 60°C\`
  * **Velocidade Inicial:** \`40 a 50 mm/s\`

---

#### 3. As 3 Regras de Ouro para a Peça não Dar Errado
1. **Mesa Limpa:** Antes de imprimir, lave a mesa com detergente de cozinha neutro e água morna. A gordura dos dedos é o principal motivo de peças soltarem.
2. **Primeira Camada (Z-Offset):** A primeira linha de plástico que sai deve ficar levemente achatada na mesa (não pode ficar solta como um fio redondo e nem esmagada transparente).
3. **Fique de Olho nos Primeiros 5 Minutos:** A imensa maioria dos erros acontece na primeira camada. Esperar a base terminar garante 90% do sucesso!

---

💡 **Dica de Ouro do Copilot:**
Quando você tiver qualquer dúvida ou problema, **você não precisa saber o nome técnico**. Pode perguntar com suas próprias palavras:
* *"a peça soltou da mesa"*
* *"a impressora está fazendo barulho de estalo tec tec"*
* *"ficou parecendo uma teia de aranha"*
* *"minha peça quebrou fácil"*

O Spartan 3D Copilot entende a sua descrição e te dá a solução exata passo a passo!`;
    }

    // 0.1 Sintoma Popular: Barulho de Estalo (Tec Tec) e Não Sai Plástico
    if (
      q.includes('tec tec') ||
      q.includes('tac tac') ||
      q.includes('estalo') ||
      q.includes('estalando') ||
      (q.includes('barulho') && (q.includes('motor') || q.includes('extrusor') || q.includes('filamento'))) ||
      ((q.includes('nao sai') || q.includes('parou de sair')) && (q.includes('filamento') || q.includes('plastico') || q.includes('bico')))
    ) {
      return `### ⚙️ Diagnóstico: Barulho de Estalo ("Tec-Tec") e Bico sem Sair Plástico

Esse barulho clássico de *"tec-tec-tec"* ocorre quando o motor do extrusor tenta empurrar o filamento para o bico quente, mas encontra uma resistência maior do que consegue vencer. As engrenagens começam a "patinar" no plástico.

---

#### 1. As 3 Causas Mais Comuns (e como resolver agora):
1. **Bico Colado Demais na Mesa (Primeira Camada):**
   * Se o barulho começa logo na primeira camada, o bico está tão encostado na chapa que o plástico derretido não tem espaço físico para sair.
   * **Solução:** Suba o Z-Offset em \`+0.05 mm\` no painel da impressora para dar respiro ao fluxo.
2. **Bico Frio Demais para o Filamento:**
   * Se o plástico não estiver suficientemente aquecido, ele fica duro demais para passar pelo orifício de 0.4 mm.
   * **Solução:** Aumente a temperatura do bico em **\`+5°C ou +10°C\`** (ex: no PLA, suba para 205°C ou 210°C).
3. **Entupimento Parcial ou Total (*Clog*):**
   * Poeira ou pedaço de filamento carbonizado acumulou dentro da ponta metálica.
   * **Solução:** Aqueça o bico a 230°C e use a agulha de desentupimento de 0.4 mm vinda de baixo para cima, ou faça um procedimento de *Cold Pull*.

---

#### 2. Dica de Prevenção
* Nunca deixe o bico aquecido acima de 200°C parado por mais de 10 minutos sem imprimir, pois o filamento parado cozinha e vira carvão dentro da garganta do bico.`;
    }

    // 0.2 Sintoma Popular: Não Gruda na Mesa ou Soltou no Meio
    if (
      (q.includes('grud') || q.includes('soltou') || q.includes('soltando') || q.includes('caiu') || q.includes('descolou')) &&
      !q.includes('abs') && !q.includes('asa') && !q.includes('warping')
    ) {
      return `### 🧲 Diagnóstico: Peça Não Gruda ou Soltou da Mesa Durante a Impressão

Não se preocupe: esse é o problema mais frequente de quem está imprimindo em 3D e é fácil de resolver!

---

#### 1. Passo a Passo Rápido para Grudar Perfeitamente:
1. **Lave a Mesa com Detergente:**
   * Retire a chapa flexível e lave na pia com água morna e 3 gotas de **detergente de louça neutro**. Use o lado macio (amarelo) da esponja.
   * A oleosidade invisível dos dedos impede o plástico quente de aderir.
2. **Aproxime o Bico da Mesa (Z-Offset):**
   * Se a primeira camada está saindo redonda como um fio solto de linha, o bico está alto demais.
   * Durante a impressão da borda inicial (*skirt/brim*), vá no menu da sua impressora em **Z-Offset (ou Babystep Z)** e diminua o valor em \`-0.02 mm\` ou \`-0.05 mm\` até a linha ficar achatada na mesa.
3. **Temperatura da Mesa:**
   * **PLA:** Use a mesa entre **\`55°C e 60°C\`**.
   * **PETG:** Use a mesa entre **\`75°C e 80°C\`**.
4. **Adicione uma Borda (Brim) no Fatiador:**
   * No seu fatiador, ative a opção **Brim (Aba)** com 5 mm de largura. Isso cria uma "aba" ao redor da peça que aumenta muito a área de contato com a mesa.`;
    }

    // 0.3 Sintoma Popular: Fios e "Teia de Aranha"
    if (
      (q.includes('teia') || q.includes('aranha') || q.includes('cabelo de anjo')) ||
      (q.includes('fios') && !q.includes('perfil') && !q.includes('retra'))
    ) {
      return `### 🕸️ Diagnóstico: Peça com Fios Finos ("Teia de Aranha")

Esses fiozinhos chatos entre uma coluna e outra da peça acontecem quando o bico está se deslocando no ar e o plástico derretido continua gotejando da ponta.

---

#### 1. Como Resolver em 3 Passos Simples:
1. **Abaixe um pouco a Temperatura:**
   * Quando o plástico fica quente demais, ele vira quase líquido e pinga no ar.
   * Reduza a temperatura do bico em **\`5°C\`** (ex: se estava em 215°C no PLA, coloque em 205°C ou 200°C).
2. **Verifique a Retração (Puxada do Filamento):**
   * A "Retração" é o movimento onde a impressora dá um leve puxão no filamento para trás antes de se mover pelo ar.
   * Se sua impressora tiver o motor direto em cima do bico (*Direct Drive*): configure a retração entre **\`0.8 mm e 1.2 mm\`**.
   * Se o motor fica preso no chassi com tubo de teflon longo (*Bowden*): configure entre **\`4.5 mm e 5.5 mm\`**.
3. **Cuidado com a Umidade:**
   * Filamentos que ficam abertos expostos ao ar absorvem água e pipocam no bico, criando fiapos. Se ouvir pequenos estalinhos enquanto imprime, o carretel precisa ser desumidificado.`;
    }

    // 0.4 Sintoma Popular: Peça Fraca / Quebrando Fácil entre Camadas
    if (
      q.includes('quebrando') ||
      q.includes('quebra facil') ||
      q.includes('fraca') ||
      q.includes('camadas soltando')
    ) {
      return `### 🧱 Diagnóstico: Peça Fraca que Quebra Fácil na Mão

Se a sua peça quebra facilmente ao longo das linhas horizontais, significa que a camada de cima não conseguiu se fundir termicamente com a camada de baixo.

---

#### 1. As 3 Soluções Mais Rápidas:
1. **Aumente a Temperatura do Bico:**
   * A causa número 1 de peça fraca é bico frio. O plástico sai sem calor suficiente para derreter a camada anterior.
   * Suba a temperatura em **\`+10°C\`** (exemplo: se estiver em 195°C no PLA, suba para 205°C a 210°C).
2. **Reduza a Ventoinha de Resfriamento:**
   * Se a ventoinha sopra vento forte demais na ponta, o plástico gela antes de colar na camada de baixo.
   * No fatiador, reduza a ventoinha (*Part Cooling*) para **\`60% a 70%\`**.
3. **Aumente o Número de Paredes:**
   * Por padrão muitas peças vêm com apenas 2 paredes. No fatiador, configure **\`3 ou 4 paredes\`** (Wall Loops) e preenchimento de **\`15% a 25%\`** com padrão Giroide (*Gyroid*). A peça fica muito mais resistente!`;
    }

    // 1. Misturar Filamentos: PLA com PETG / Suportes Multimateriais
    if (
      (q.includes('pla') && q.includes('petg')) ||
      (q.includes('mistur') && (q.includes('filamento') || q.includes('material') || q.includes('cor')))
    ) {
      return `### 🔬 Análise Técnica Especializada: Misturar Filamento PLA com PETG

A resposta direta é: **Depende da aplicação.** Eles **NÃO se fundem para criar peças sólidas**, mas são considerados o **"Santo Graal" para suportes destacáveis**.

---

#### 1. Para Peças Sólidas Estruturais (Mesma Peça): ❌ NÃO FUNCIONA
* **Incompatibilidade Química:** O PLA (*ácido polilático*) e o PETG (*polietileno tereftalato glicol*) possuem estruturas moleculares completamente distintas que **não criam adesão intermolecular**.
* Se você tentar imprimir camadas alternadas ou fundi-los na mesma peça, ela **delaminará e se partirá com o menor esforço manual**, pois a adesão entre as camadas de PLA e PETG é praticamente nula.
* **Diferença de Temperatura:** O PLA imprime entre \`195°C e 215°C\`, enquanto o PETG exige entre \`230°C e 245°C\`. Isso causa degradação térmica do PLA e subextrusão do PETG se tentados na mesma faixa.

---

#### 2. Para Interface de Suporte (Zero-Gap Support): ✅ É A MELHOR COMBINAÇÃO DO MERCADO!
* Como o PLA e o PETG não aderem entre si, essa é uma das técnicas mais avançadas da impressão 3D em impressoras com troca de filamento (*Bambu Lab AMS, ERCF, Prusa MMU, Dual Extruder*)!
* **Como configurar no OrcaSlicer / Bambu Studio:**
  1. No menu de **Suportes (Support)**, configure o corpo principal do suporte com o mesmo material da peça (para economizar trocas de carretel).
  2. Configure apenas a **"Camada de Interface do Suporte" (Support Interface)** com o outro material (exemplo: Peça em PETG com Interface em PLA, ou Peça em PLA com Interface em PETG).
  3. Ajuste a **Distância Z Superior (Top Z-Distance)** para **\`0.0 mm\` (Zero Gap)**.
* **Resultado:** A parte inferior suspensa da peça fica com acabamento de primeira camada perfeitamente lisa e o suporte se solta inteiro com a mão ou uma espátula, sem deixar nenhuma cicatriz na peça!

---

#### 3. Cuidados Críticos na Troca (Torre de Purga)
* Ao alternar entre PLA e PETG no mesmo bico:
  * Aumente o **Volume de Purga (Flushing Volume)** na troca para pelo menos **\`380 a 480 mm³\`**.
  * Se sobrar qualquer resíduo microscópico de PLA dentro do bico na hora de extrusar o PETG estrutural, a peça sofrerá fraqueza mecânica interna grave naquele ponto.`;
    }

    // 2. PETG e Stringing (Fiapos / Teias / Oozing)
    if (
      q.includes('petg') &&
      (q.includes('string') || q.includes('fiapo') || q.includes('teia') || q.includes('calibr') || q.includes('retra'))
    ) {
      return `### 🛠️ Diagnóstico Técnico: Resolução Definitiva de Stringing (Fiapos) em PETG

O **PETG** possui alta viscosidade e é extremamente higroscópico (*absorve umidade do ar rapidamente*), tornando o controle de retração e temperatura essencial.

---

#### 1. Calibração de Retração no OrcaSlicer / Cura / PrusaSlicer
* **Distância de Retração:**
  * **Direct Drive:** Ajuste entre **\`0.8 mm\` e \`1.2 mm\`** (máximo \`1.4 mm\`).
  * **Bowden:** Ajuste entre **\`4.0 mm\` e \`5.5 mm\`**.
* **Velocidade de Retração / Destração:** **\`35 a 45 mm/s\`** (velocidades acima de 50 mm/s criam cavitação e bolhas por vácuo no bico).
* **Wipe while Retracting (Limpeza ao retrair):** Ative no perfil do filamento com distância de **\`1.0 mm a 2.0 mm\`**.
* **Retract Amount Before Wipe:** Configure em **\`70%\`**.

---

#### 2. Ajustes Térmicos e de Ventilação
* **Temperatura de Bico:** Reduza para a faixa de **\`230°C a 238°C\`**. Temperaturas acima de 240°C aumentam drasticamente a fluidez do PETG, causando gotejamento involuntário (*oozing*).
* **Ventoinha de Resfriamento (Part Cooling):** Mantenha entre **\`30% e 50%\`**. Evite 100% de ventilação, pois resfriamento excessivo fragiliza a adesão entre camadas no PETG.
* **Velocidade de Deslocamento (Travel Speed):** Aumente para **\`200 a 300 mm/s\`** com aceleração de viagem em \`5000 mm/s²\` para quebrar os fios rapidamente.

---

#### 3. Z-Hop (Salto no Eixo Z)
* Desative o Z-hop vertical ou mude para o modo **"Spiral Z-hop"** (\`0.2 mm\`), pois o salto vertical reto puxa fiapos da ponta derretida.

---

#### 4. Secagem do Filamento (Fator Crítico)
* Se você ouvir estalos discretos durante a impressão, o filamento absorveu umidade. Desumidifique a bobina a **\`65°C por 6 horas\`** antes de reimprimir.`;
    }

    // 3. Warping / Descolamento de Mesa (ABS / ASA / Nylon / PLA)
    if (
      q.includes('warping') ||
      q.includes('descol') ||
      q.includes('empen') ||
      q.includes('abs') ||
      q.includes('asa')
    ) {
      return `### 🛡️ Diagnóstico Técnico: Prevenção de Warping e Descolamento da Mesa

O empenamento (*warping*) ocorre devido ao encolhimento térmico volumétrico do plástico durante o resfriamento assimétrico das camadas inferiores.

---

#### 1. Parâmetros Térmicos Recomendados
* **Mesa Aquecida:**
  * **ABS / ASA:** **\`100°C a 110°C\`** (nunca abaixo de 95°C).
  * **PETG:** **\`70°C a 80°C\`**.
  * **PLA:** **\`55°C a 65°C\`**.
* **Bico Extrusor:**
  * **ABS/ASA:** **\`240°C a 255°C\`**.
* **Primeira Camada:** Velocidade reduzida a **\`20 mm/s\`** com altura de camada em \`0.28 mm\` e largura de linha em \`0.50 mm\` (em bico 0.4) para aumentar a ancoragem.

---

#### 2. Controle Ambiental e Câmara Fechada
* **Enclosure (Câmara):** Obrigatório para ABS/ASA/Nylon. Mantenha a câmara fechada com temperatura interna estável entre **\`40°C e 55°C\`**.
* **Correntes de Ar:** Ar-condicionado ou correntes de vento no ambiente causam choque térmico imediato e delaminação das bordas.
* **Part Cooling Fan:** Mantenha a ventoinha da peça em **\`0%\` (desligada)** durante toda a impressão de ABS/ASA.

---

#### 3. Superfície e Adesão
* Utilize chapa **PEI Texturizada** ou **Lisa** limpa com água morna e sabão neutro, finalizando com álcool isopropílico 99%.
* Aplique spray fixador ou cola bastão própria para impressão 3D.
* **Brim (Aba):** Configure no fatiador um Brim externo de **\`8 a 12 mm\`** com \`Brim-object gap\` de \`0.1 mm\`.`;
    }

    // 4. Filamento TPU e Flexíveis
    if (q.includes('tpu') || q.includes('flex')) {
      return `### 🌀 Guia Especialista: Parâmetros de Impressão para TPU 95A / Filamentos Flexíveis

Filamentos flexíveis possuem comportamento viscoelástico: eles dobram e escapam das engrenagens do extrusor se submetidos a pressão brusca ou alta velocidade.

---

#### 1. Velocidades e Dinâmica de Fluxo
* **Velocidade de Impressão:** Mantenha constante e baixa, entre **\`20 e 35 mm/s\`** (inclusive para paredes externas e preenchimento).
* **Aceleração:** Reduza para **\`1000 a 1500 mm/s²\`** para evitar picos repentinos de pressão no bico.
* **Desative o Pressure Advance / Linear Advance**, pois filamentos elásticos acumulam energia mecânica interna.

---

#### 2. Configuração de Retração
* **Extrusor Direct Drive:** Distância ultra-baixa de **\`0.4 a 0.8 mm\`** com velocidade lenta de **\`20 mm/s\`**.
* **Extrusor Bowden:** Recomenda-se **desativar a retração** ou limitar a \`1.5 mm\` a \`15 mm/s\` para não mascar o filamento no tubo PTFE.
* **Tensão da Engrenagem:** Afrouxe o parafuso de compressão do tracionador para não esmagar o filamento flexível antes da entrada do hotend.

---

#### 3. Temperatura e Alerta de Remoção da Mesa
* **Bico:** **\`220°C a 230°C\`**.
* **Mesa:** **\`50°C a 60°C\`**.
* ⚠️ **ALERTA CRÍTICO DE ADESÃO:** O TPU adere com extrema força em chapas PEI lisas, correndo o risco de rasgar o revestimento da chapa na remoção. Aplique uma camada fina de **cola bastão como desmoldante** antes de imprimir.`;
    }

    // 5. Clogging / Entupimento de Bico / Subextrusão
    if (
      q.includes('entup') ||
      q.includes('clog') ||
      q.includes('subextrus') ||
      q.includes('estalo') ||
      q.includes('bico entupido')
    ) {
      return `### 🔧 Diagnóstico Técnico: Desobstrução de Bico e Prevenção de Heat Creep

---

#### 1. Procedimento Oficial de Cold Pull (Puxada a Frio)
1. Aqueça o bico até **\`235°C\`** e empurre manualmente cerca de 5 cm de filamento (*preferencialmente Nylon ou PLA claro*).
2. Desligue o aquecimento e deixe o hotend resfriar até aproximadamente **\`90°C\`** (*para PLA*) ou **\`130°C\`** (*para Nylon*).
3. Destrave a alavanca do extrusor e puxe o filamento firmemente e de forma contínua para cima.
4. O filamento sairá com o formato cônico perfeito do interior do bico, trazendo toda a carbonização e detritos que obstruíam a saída.

---

#### 2. Prevenção de Heat Creep (Subida Excessiva de Calor)
* Verifique se a ventoinha frontal do dissipador (*Hotend Cooling Fan*) está girando em 100% sem poeira acumulada.
* Se a troca de calor for ineficiente, o filamento amolece antes do bloco de aquecimento e incha na garganta térmica, travando a passagem.
* Se for usar filamentos com partículas abrasivas (*Madeira, Fibra de Carbono, Glow in the dark*), utilize **bico endurecido de no mínimo \`0.6 mm\`** para evitar entupimento imediato.`;
    }

    // 6. Direct Drive vs Bowden
    if (q.includes('direct drive') || q.includes('bowden')) {
      return `### ⚙️ Comparativo Técnico: Extrusor Direct Drive vs Sistema Bowden

---

#### 1. Direct Drive (Motor montado no cabeçote de impressão)
* **Vantagens:**
  * Caminho de extrusão curto (< 30 mm), permitindo imprimir **TPU e filamentos flexíveis com perfeição**.
  * Retrações ultra-baixas (**\`0.6 mm a 1.2 mm\`**), reduzindo quase a zero o risco de stringing.
  * Resposta instantânea de controle de fluxo (*Pressure Advance / Linear Advance*).
* **Desvantagens:**
  * Maior massa em movimento no eixo X, exigindo acelerações menores em impressoras do tipo *bed slinger* para evitar *ghosting*.

---

#### 2. Bowden (Motor fixo na estrutura, com tubo PTFE até o hotend)
* **Vantagens:**
  * Cabeçote de impressão extremamente leve, permitindo velocidades de movimentação muito altas sem vibrar a estrutura.
* **Desvantagens:**
  * Retrações longas (**\`4.0 mm a 6.0 mm\`**), aumentando o tempo de impressão e a chance de entupimento por histerese no tubo PTFE.
  * Dificuldade severa para tracionar filamentos flexíveis (TPU 85A/95A tendem a enrugar dentro do tubo).`;
    }

    // 7. Klipper: Input Shaping e Pressure Advance
    if (q.includes('klipper') || q.includes('input shaping') || q.includes('pressure advance')) {
      return `### ⚡ Guia de Calibração: Klipper (Input Shaping & Pressure Advance)

---

#### 1. Input Shaping (Eliminação de Ressonância / Ghosting)
* **Objetivo:** Neutralizar as frequências de ressonância mecânica dos eixos X e Y sem precisar reduzir a aceleração.
* **Procedimento:**
  1. Conecte um acelerômetro ADXL345 ao cabeçote e execute \`SHAPER_CALIBRATE\`.
  2. Caso calibre manualmente via teste de ressonância (\`TEST_RESONANCES AXIS=X\`), meça a distância entre as ondulações para calcular a frequência em Hz.
  3. Algoritmo recomendado: **\`mzv\`** para sistemas leves ou **\`ei\`** para mesas mais pesadas.

---

#### 2. Pressure Advance (Compensação de Pressão do Bico)
* **Objetivo:** Evitar cantos arredondados ou abaulados e eliminar excesso de material no início/fim de cada linha.
* **Valores Típicos:**
  * **Direct Drive:** \`0.02\` a \`0.05 s\`.
  * **Bowden:** \`0.30\` a \`0.70 s\`.
* Execute o script de torre de calibração \`TUNING_TOWER COMMAND=SET_PRESSURE_ADVANCE PARAMETER=ADVANCE START=0 FACTOR=.005\`.`;
    }

    // 8. Bicos: Diâmetro e Materiais (0.2, 0.4, 0.6, Aço Endurecido)
    if (q.includes('bico') || q.includes('nozzle') || q.includes('0.2') || q.includes('0.6') || q.includes('endurecido')) {
      return `### 🔍 Guia de Seleção de Bicos (Nozzles) para Manufatura 3D

---

#### 1. Diâmetros Recomendados por Aplicação
* **0.2 mm (Miniaturas & Detalhes Extremos):** Ideal para peças de RPG, joalheria ou textos menores que 5mm. Altura de camada recomendada: \`0.06 mm a 0.12 mm\`.
* **0.4 mm (Padrão da Indústria):** O equilíbrio perfeito entre tempo de impressão, resolução e facilidade de calibração. Altura de camada: \`0.12 mm a 0.28 mm\`.
* **0.6 mm (Produção Rápida & Resistência Mecânica):** Reduz o tempo de impressão em **35% a 50%**. Essencial para filamentos com fibras (Carbono, Madeira) para evitar entupimento.

---

#### 2. Materiais do Bico
* **Latão (Brass):** Melhor condutividade térmica, ideal para filamentos convencionais (PLA, PETG, ABS). Desgasta rapidamente com filamentos abrasivos.
* **Aço Endurecido (Hardened Steel):** Indispensável para Fibra de Carbono, Glow in the Dark, Madeira e Filamentos com Metal. *Dica:* Aumente a temperatura em \`+5°C\` devido à menor condutividade térmica do aço.
* **Bimetálico / CHT:** Núcleo de cobre de alta transferência de calor com ponta endurecida, excelente para fluxos volumétricos acima de 25 mm³/s.`;
    }

    // 9. Adesão de Primeira Camada e Calibração de Z-Offset
    if (
      q.includes('adesao') ||
      q.includes('primeira camada') ||
      q.includes('z-offset') ||
      q.includes('nivelamento')
    ) {
      return `### 🎯 Diagnóstico Técnico: Adesão Perfeita de Primeira Camada e Z-Offset

---

#### 1. Ajuste Fino do Z-Offset
* Imprima um teste de camada única de 50x50 mm (\`Single Layer Square\`).
* **Linhas separadas com vãos visíveis:** O bico está muito alto. Abaixe o Z-offset em incrementos de **\`-0.02 mm\`**.
* **Superfície áspera com rebarbas transparentes:** O bico está muito baixo e esmagando o material. Suba o Z-offset em incrementos de **\`+0.02 mm\`**.
* **Linha uniforme com leve achatamento e sem relevo:** Altura ideal alcançada.

---

#### 2. Limpeza Profunda da Mesa
* A oleosidade natural das mãos é o fator número 1 de perda de aderência.
* Lave a chapa periodicamente com água morna e algumas gotas de detergente neutro.
* Seque com papel toalha e finalize borrifando **álcool isopropílico 99%** antes de iniciar o aquecimento.`;
    }

    // 10. Precificação e Custos 3D para Clientes e B2B
    if (
      q.includes('precific') ||
      q.includes('orcamento') ||
      q.includes('cobrar') ||
      q.includes('preco') ||
      q.includes('custo')
    ) {
      return `### 💰 Estratégia de Precificação Técnica & Custos da Peça 3D

Para garantir rentabilidade real sem surpresas no fluxo de caixa, utilize a composição de custos da Spartan 3D:

---

#### 1. Composição Obrigatória de Custos
* **1. Matéria-prima:** \`Peso da peça (g) × Custo por grama\` (com taxa de perda de 5% a 10% inclusa).
* **2. Energia Elétrica:** \`Potência da máquina (kW) × Horas de impressão × Tarifa local (R$/kWh)\`.
* **3. Depreciação de Máquina:** \`R$ 2,50 a R$ 4,50 por hora de impressão\` (reserva para troca de bicos, correias, graxa e amortização do equipamento).
* **4. Mão de Obra Técnica:** Tempo de fatiamento, preparação de arquivo, pós-processamento e embalagem.
* **5. Margem de Lucro:** Recomendado de **50% a 70%** em varejo e **35% a 45%** para lotes de atacado.

---

#### 2. Dica de Conversão Comercial
* Ofereça opções claras de pagamento: **5% de desconto no Pix à vista** e parcelamento no cartão com sinal de 50% para reserva de maquinário e início de produção.`;
    }

    // 11. Resposta Técnica Geral para outros tópicos genuínos de impressão 3D
    return `### 💡 Solução Especializada Spartan 3D

Para a sua consulta técnica:
> **"${question}"**

---

#### 1. Parâmetros Operacionais Recomendados
* **Temperatura e Fluidez:** Certifique-se de que a temperatura do bico esteja calibrada para a velocidade de fluxo volumétrico (\`mm³/s\`) da sua impressora. Impressões de alta velocidade (acima de 150 mm/s) exigem de 5°C a 10°C a mais no bico para fusão completa.
* **Resfriamento e Aderência:** Mantenha a primeira camada impressa mais quente e sem ventilação para ancoragem perfeita.
* **Paredes e Perímetros:** Utilize no mínimo 3 paredes (\`1.2 mm\` em bico 0.4) para obter integridade mecânica isotrópica e estanqueidade.

---

#### 2. Validação Rápida
* Execute uma torre de temperatura (*Temp Tower*) para encontrar a zona ideal de brilho e resistência do filamento.
* Limpe e lubrifique as guias com graxa de lítio ou óleo PTFE a cada 200h para evitar perda de passos.`;
  }

  /**
   * Tenta chamar diretamente uma API de LLM se o usuário configurou uma chave
   */
  private static async queryDirectLlm(
    question: string,
    apiKey: string,
    provider: 'groq' | 'openai'
  ): Promise<string | null> {
    const url =
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

    const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Você é o SPARTAN AI, o copiloto especialista em manufatura aditiva 3D, fatiamento e gestão de farms de impressão 3D. ' +
              'Responda de forma clara, técnica e objetiva em português do Brasil. ' +
              'Se a pergunta do usuário não for sobre manufatura aditiva, impressão 3D ou engenharia mecânica/plásticos, ' +
              'informe educadamente que você é um especialista exclusivo em impressão 3D.',
          },
          { role: 'user', content: question },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
  }

  /**
   * Consulta a IA via Supabase Edge Function, Direct LLM (se houver chave) ou Motor Especialista
   */
  public static async askAssistant(question: string): Promise<AiDiagnosticResult> {
    const trimmed = question.trim();
    if (!trimmed) {
      throw new Error('Por favor, digite sua dúvida ou problema técnico.');
    }

    // 1. FILTRO DE ESCOPO IMEDIATO: Se a pergunta NÃO for sobre impressão 3D, rejeita antes de qualquer coisa!
    if (!this.isRelevant3DTopic(trimmed)) {
      return {
        answer: this.getOutOfScopeResponse(trimmed),
        model: 'spartan-3d-scope-filter',
        source: 'spartan_expert_engine',
      };
    }

    // 2. Se o usuário configurou uma chave direta no navegador (ex: Groq grátis ou OpenAI):
    const customKey = this.getCustomApiKey();
    if (customKey) {
      try {
        const directReply = await this.queryDirectLlm(
          trimmed,
          customKey,
          this.getCustomProvider()
        );
        if (directReply) {
          return {
            answer: directReply,
            model: this.getCustomProvider() === 'groq' ? 'groq-llama-3.3-70b' : 'openai-gpt-4o',
            source: 'direct_llm',
          };
        }
      } catch (err) {
        console.warn('Erro ao consultar LLM direto:', err);
      }
    }

    // 3. Tenta chamar a Edge Function do Supabase (apenas aceita se for resposta de um LLM real)
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: { question: trimmed, prompt: trimmed },
        });

        if (!error && data) {
          const rawAnswer = data.answer || data.reply || data.choices?.[0]?.message?.content;
          const returnedModel = String(data.model || '');

          // Se a Edge Function respondeu com um LLM real (Llama, GPT, etc.), usa a resposta
          const isRealLlm =
            returnedModel &&
            !returnedModel.includes('expert-engine') &&
            !returnedModel.includes('intelligence-engine');

          // Verifica se não é resposta genérica desatualizada
          const isGenericOutdated =
            rawAnswer &&
            rawAnswer.includes('Calibração de Primeira Camada: Verifique o Z-offset executando uma linha de purga') &&
            !trimmed.toLowerCase().includes('z-offset');

          if (rawAnswer && isRealLlm && !isGenericOutdated) {
            return {
              answer: rawAnswer,
              model: returnedModel,
              source: 'supabase_edge',
            };
          }
        }
      }
    } catch (err) {
      console.warn('Edge Function indisponível ou em fallback, acionando motor técnico Spartan:', err);
    }

    // 4. Fallback garantido: motor técnico especialista Spartan 3D focado e personalizado
    const expertAnswer = this.getExpertAnswer(trimmed);
    return {
      answer: expertAnswer,
      model: 'spartan-3d-expert-engine',
      source: 'spartan_expert_engine',
    };
  }
}
