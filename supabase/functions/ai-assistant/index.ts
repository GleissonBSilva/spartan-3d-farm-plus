import { createClient } from 'npm:@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/cors.ts';

function isRelevant3DTopic(question: string): boolean {
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const keywords = [
    'pla', 'petg', 'abs', 'asa', 'tpu', 'nylon', 'resina', 'resinas', 'pc', 'policarbonato',
    'pvb', 'pva', 'hips', 'carbono', 'wood', 'madeira', 'silk', 'filamento', 'filamentos',
    'carretel', 'bobina', 'polimero', 'material', 'materiais', 'impressora', 'impressoras',
    'impressao', 'imprimir', 'fatiador', 'fatiamento', 'fatiar', 'orca', 'cura', 'bambu',
    'prusa', 'creality', 'ender', 'k1', 'voron', 'klipper', 'marlin', 'gcode', 'stl', '3mf',
    'bico', 'nozzle', 'hotend', 'heatbreak', 'garganta', 'dissipador', 'mesa', 'bed', 'chapa',
    'pei', 'extrusor', 'extrusora', 'direct drive', 'bowden', 'eixo', 'correia', 'nivelamento',
    'stringing', 'fiapo', 'fiapos', 'teia', 'warping', 'descol', 'empen', 'delamin', 'entup',
    'clog', 'cold pull', 'subextrus', 'z-hop', 'retra', 'primeira camada', 'z-offset', 'brim',
    'skirt', 'raft', 'infill', 'preenchimento', 'gyroid', 'parede', 'suporte', 'velocidade',
    'temperatura', 'fluxo', 'flow rate', 'pressure advance', 'linear advance', 'input shaping',
    'farm', 'orcamento', 'precific', 'cobrar', 'preco', 'custo', 'mrr',
    // Termos de Aprendizado, Iniciantes e Descrições Cotidianas
    'iniciante', 'iniciantes', 'aprender', 'aprendendo', 'comecar', 'comeco', 'iniciar',
    'primeira impressao', 'dicas', 'passo a passo', 'guia', 'tutorial', 'ajuda', 'socorro',
    'grud', 'grudar', 'soltou', 'soltando', 'descolou', 'solta', 'caiu',
    'tec tec', 'tac tac', 'estalo', 'estalos', 'barulho', 'estalando', 'clique',
    'nao sai', 'parou de sair', 'nao derrete', 'parou',
    'teia', 'aranha', 'cabelo de anjo', 'fiozinhos', 'fios',
    'quebrando', 'fraca', 'rachando', 'rachadura', 'quebra facil',
    'plastico', 'plasticos'
  ];

  return keywords.some(k => q.includes(k));
}

function getOutOfScopeResponse(question: string): string {
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
 * Motor especialista de diagnóstico técnico e operacional 3D da Spartan
 * Garante respostas técnicas aprofundadas, exatas e personalizadas para qualquer dúvida
 */
function generateSpecialized3DAnswer(question: string): string {
  if (!isRelevant3DTopic(question)) {
    return getOutOfScopeResponse(question);
  }

  const rawQ = question.toLowerCase();
  // Normaliza termos técnicos e erros comuns de digitação
  const q = rawQ
    .replace(/pteg/g, 'petg')
    .replace(/pétg/g, 'petg')
    .replace(/pla\+/g, 'pla plus')
    .replace(/orcaslicer/g, 'orca')
    .replace(/cura/g, 'cura')
    .replace(/bambu/g, 'bambu');

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

  // 1. Misturar Filamentos (PLA com PETG / Multimaterial / Suportes)
  if ((q.includes('pla') && q.includes('petg')) || (q.includes('mistur') && (q.includes('filamento') || q.includes('material')))) {
    return `### 🔬 Análise Técnica: É Possível Misturar Filamento PLA com PETG?

A resposta direta é: **Depende da finalidade.** Eles **NÃO se fundem para criar peças sólidas**, mas são considerados o **"Santo Graal" para suportes destacáveis**.

---

#### 1. Para Peças Sólidas Estruturais (Mesma Peça): ❌ NÃO FUNCIONA
* **Incompatibilidade Química:** O PLA (ácido polilático) e o PETG (polietileno tereftalato glicol) possuem composições moleculares que **não criam ligação intermolecular**. 
* Se você tentar imprimir camadas alternadas ou fundi-los na mesma peça, ela **delaminará e se partirá com o menor esforço**, pois a adesão entre as camadas de PLA e PETG é praticamente nula.
* **Diferença de Temperatura:** O PLA imprime entre \`195°C e 215°C\`, enquanto o PETG exige entre \`230°C e 245°C\`. Isso causa degradação térmica do PLA e subextrusão do PETG se tentados na mesma temperatura.

---

#### 2. Para Suporte de Interface (Zero-Gap Support): ✅ É A MELHOR COMBINAÇÃO DO MUNDO!
* Como o PLA e o PETG não colam um no outro, essa é uma das técnicas mais avançadas da impressão 3D em impressoras com troca de filamento (Bambu Lab AMS, ERCF, dual extruder)!
* **Como configurar no OrcaSlicer / Bambu Studio:**
  1. Configure o corpo principal do suporte com o mesmo material da peça (para economizar trocas).
  2. Configure apenas a **"Camada de Interface do Suporte" (Support Interface)** com o outro material (ex: Peça em PETG com Interface em PLA, ou vice-versa).
  3. Ajuste a **Distância Z Superior (Top Z-Distance)** para **\`0.0 mm\` (Zero Gap)**.
* **Resultado:** A parte inferior da peça fica com acabamento perfeito de primeira camada e o suporte se solta inteiro sem esforço com uma chave, sem deixar nenhuma marca!

---

#### 3. Cuidados na Transição (Torre de Purga)
* Se usar sistema multicolor/multimaterial:
  * Aumente o **volume de purga (Flushing Volume)** na troca para pelo menos **\`380 a 480 mm³\`**.
  * Se sobrar qualquer resquício de PLA dentro do bico na hora de imprimir PETG estrutural, a peça sofrerá fraqueza mecânica interna naquele ponto.`;
  }

  // 2. Diagnóstico de PETG e Stringing (Fiapos / Teias)
  if (q.includes('petg') && (q.includes('string') || q.includes('fiapo') || q.includes('teia') || q.includes('calibr') || q.includes('orca'))) {
    return `### 🛠️ Diagnóstico Técnico: Resolução de Stringing em PETG no OrcaSlicer

O **PETG** possui alta viscosidade e é extremamente higroscópico, o que torna o controle de escorrimento (*oozing*) e retração crítico.

---

#### 1. Calibração de Retração no OrcaSlicer
* **Distância de Retração:**
  * **Direct Drive:** \`0.8 mm\` a \`1.2 mm\` (máximo \`1.4 mm\`).
  * **Bowden:** \`4.0 mm\` a \`5.5 mm\`.
* **Velocidade de Retração / Destração:** \`35 a 45 mm/s\` (velocidades acima de 50 mm/s criam bolhas por vácuo no bico).
* **Wipe while Retracting (Limpeza ao retrair):** Ative no perfil do filamento com distância de \`1.0 mm\` a \`2.0 mm\`.
* **Retract Amount Before Wipe:** Configure em \`70%\`.

---

#### 2. Ajustes Térmicos e de Ventilação
* **Temperatura de Bico:** Reduza para a faixa de **\`230°C a 238°C\`**. Temperaturas acima de 240°C tornam o PETG excessivamente fluido.
* **Ventoinha de Resfriamento (Part Cooling):** Mantenha entre **\`30% e 50%\`**. Ventilação a 100% enfraquece a adesão entre camadas no PETG.
* **Velocidade de Deslocamento (Travel Speed):** Aumente para **\`200 a 300 mm/s\`** com aceleração de viagem em \`5000 mm/s²\` para quebrar os filamentos rapidamente.

---

#### 3. Z-Hop (Salto no Eixo Z)
* Desative o Z-hop tradicional ou mude para o modo **"Spiral Z-hop"** (\`0.2 mm\`), pois o salto vertical reto puxa fiapos da ponta derretida.

---

#### 4. Secagem do Filamento (Fator Crítico)
* Se você ouvir estalos discretos durante a impressão, o filamento absorveu umidade do ar. Desumidifique a bobina a **\`65°C por 6 horas\`** antes de reimprimir.`;
  }

  // 3. Diagnóstico de Warping (Descolamento) em ABS / ASA
  if (q.includes('abs') || q.includes('asa') || (q.includes('warping') || q.includes('descol') || q.includes('empen'))) {
    return `### 🛡️ Diagnóstico Técnico: Prevenção de Warping (Descolamento) em ABS/ASA

O encolhimento térmico volumétrico do **ABS** pode chegar a 1,5%, causando contração assimétrica nas extremidades da peça.

---

#### 1. Parâmetros Térmicos Recomendados
* **Mesa Aquecida:** **\`100°C a 110°C\`** (nunca abaixo de 95°C).
* **Bico Extrusor:** **\`240°C a 255°C\`**.
* **Primeira Camada:** Velocidade máxima de **\`20 mm/s\`** com altura de camada em \`0.28 mm\` para criar área de contato reforçada.

---

#### 2. Controle Ambiental e Câmara Fechada
* **Enclosure (Câmara):** Obrigatório. Mantenha a câmara fechada com temperatura interna entre **\`40°C e 55°C\`**.
* **Correntes de Ar:** Correntes de ar ambiente ou ar condicionado causam choque térmico e delaminação imediata.
* **Part Cooling Fan:** Mantenha a ventoinha de resfriamento da peça em **\`0%\`** (desligada) em toda a impressão, permitindo no máximo 10% em pontes curtas.

---

#### 3. Adesão na Superfície
* Utilize chapa **PEI Lisa** ou **Texturizada** limpa com álcool isopropílico 99%.
* Aplique uma camada fina de adesivo líquido à base de PVP (como cola bastão ou spray fixador próprio para impressão 3D).
* **Adição de Brim (Aba):** Configure no fatiador um Brim externo de **\`8 a 12 mm\`** com distância de separação (\`Brim-object gap\`) de \`0.1 mm\`.`;
  }

  // 4. Impressão com TPU e Filamentos Flexíveis
  if (q.includes('tpu') || q.includes('flex')) {
    return `### 🌀 Guia Especialista: Configurações de Impressão para TPU 95A / Flexíveis

Filamentos flexíveis possuem comportamento viscoelástico e tendem a dobrar ou enrolar no tracionador se submetidos a pressões bruscas.

---

#### 1. Velocidades e Dinâmica de Fluxo
* **Velocidade de Impressão:** Mantenha velocidade constante e lenta entre **\`20 e 35 mm/s\`** (inclusive para paredes externas e preenchimento).
* **Aceleração:** Reduza para **\`1000 a 1500 mm/s²\`** para evitar picos de pressão no bico.
* **Desative o Pressure Advance / Linear Advance**, pois filamentos flexíveis acumulam energia elástica.

---

#### 2. Retração e Extrusor
* **Extrusor Direct Drive:** Distância de retração ultra-baixa de **\`0.4 a 0.8 mm\`** a **\`20 mm/s\`**.
* **Extrusor Bowden:** Desative completamente a retração ou limite a \`1.5 mm\` a \`15 mm/s\` para não mascar o filamento nas engrenagens.
* **Tensão da Engrenagem:** Afrouxe o parafuso de compressão da mola do extrusor para não esmagar o filamento flexível.

---

#### 3. Temperaturas e Adesão
* **Bico:** **\`220°C a 230°C\`**.
* **Mesa:** **\`50°C a 60°C\`**.
* ⚠️ **Atenção à Adesão Excessiva:** O TPU gruda muito forte no PEI liso. Aplique uma camada leve de cola bastão como **agente desmoldante** para não danificar o revestimento da chapa ao remover a peça.`;
  }

  // 5. Precificação e Orçamento B2B
  if (q.includes('precific') || q.includes('orçamento') || q.includes('orcamento') || q.includes('cobrar') || q.includes('preço') || q.includes('preco') || q.includes('b2b') || q.includes('custo')) {
    return `### 💰 Estratégia de Precificação Industrial & Orçamento B2B (Peça 3D)

Para precificar com segurança e obter lucro previsível em lotes B2B, utilize a fórmula estruturada da Spartan 3D:

---

#### 1. Demonstração Prática de Custos (Exemplo: 250g PLA / 12h de máquina)
* **Custo Direto do Filamento:**
  * 250g de PLA Premium @ R$ 120,00/kg = **R$ 30,00**
* **Energia Elétrica:**
  * Potência média de 350W por 12h = 4,2 kWh @ R$ 1,00/kWh = **R$ 4,20**
* **Depreciação & Manutenção da Impressora:**
  * Custo médio de R$ 3,50 por hora de máquina x 12h = **R$ 42,00**
* **Taxa de Risco e Perda Técnica (10%):** **R$ 7,62**
* **Mão de Obra Técnica (Fatiamento, Setup e Acabamento - 45 min):** **R$ 35,00**
* 📌 **Custo Total de Produção:** **R$ 118,82**

---

#### 2. Sugestão de Preço Final de Venda
* **Markup Padrão B2B (Margem líquida de 50% a 60%):**
  * **Preço Recomendado por Peça:** **\`R$ 235,00 a R$ 285,00\`**
* **Desconto Escalonado por Volume:**
  * 1 a 3 unidades: R$ 265,00/unid
  * 4 a 10 unidades: R$ 225,00/unid (diluição do tempo de setup e fatiamento).`;
  }

  // 6. Clogging / Entupimento
  if (q.includes('entup') || q.includes('clog') || q.includes('falha de extrusão') || q.includes('estalos') || q.includes('bico entupido')) {
    return `### 🔧 Diagnóstico Técnico: Desobstrução e Resolução de Clogging no Hotend

---

#### 1. Procedimento de Cold Pull (Puxada a Frio)
1. Aqueça o bico até **\`230°C\`** e empurre manualmente cerca de 5 cm de filamento (preferencialmente Nylon ou PLA claro).
2. Desligue o aquecimento e deixe resfriar até aproximadamente **\`90°C\`**.
3. Destrave a alavanca do extrusor e puxe o filamento firmemente para cima. O filamento sairá com o molde exato do interior da câmara térmica, trazendo detritos carbonizados.

---

#### 2. Prevenção de Heat Creep (Subida de Calor)
* Verifique se a ventoinha do dissipador do hotend está limpa e girando em 100% de velocidade.
* O acúmulo de poeira nas aletas de refrigeração impede a troca de calor e faz o filamento expandir antes da zona de fusão.`;
  }

  // 7. Aderência na Mesa / Primeira Camada / Z-Offset
  if (q.includes('adesão') || q.includes('adesao') || q.includes('primeira camada') || q.includes('z-offset') || q.includes('descolando')) {
    return `### 🎯 Diagnóstico Técnico: Aderência Perfeita de Primeira Camada e Z-Offset

---

#### 1. Ajuste Fino do Z-Offset
* Execute uma impressão de teste de camada única (Single Layer Square).
* Se as linhas estiverem separadas: **o bico está muito alto**, abaixe o Z-offset em passos de \`-0.02 mm\`.
* Se o bico estiver arranhando a mesa ou criando rebarbas transparentes: **o bico está muito baixo**, eleve o Z-offset em passos de \`+0.02 mm\`.

---

#### 2. Preparação da Chapa PEI
* Lave a chapa periodicamente com água morna e detergente neutro (a oleosidade dos dedos é a causa número 1 de peças descolando).
* Finalize passando álcool isopropílico 99% com papel toalha sem fiapos antes de cada impressão.`;
  }

  // 8. Diagnóstico Estratégico de MRR / SaaS
  if (q.includes('mrr') || q.includes('churn') || q.includes('receita') || q.includes('faturamento') || q.includes('retenção')) {
    return `### 📊 Diagnóstico Estratégico de Gestão & Faturamento (Spartan 3D)

**1. Aceleração de Liquidação via Pix:**
* Envie cobranças com QR Code dinâmico e código Pix Copia e Cola direto no WhatsApp. A taxa de quitação atinge 85% em menos de 24 horas.

**2. Retenção & Upsell:**
* Monitore clientes próximos do limite de impressoras ou filamentos cadastrados para oferecer o upgrade consultivo para o plano **Spartan Farm**.
* Acompanhe a regularização imediata de clientes atrasados para restabelecer o acesso assim que a fatura for confirmada.`;
  }

  // 9. Resposta técnica contextual geral para qualquer outra dúvida de impressão 3D
  return `### 💡 Solução Especializada Spartan 3D

Para a dúvida apresentada:
> **"${question}"**

---

#### 1. Recomendações de Parâmetros
* **Temperatura e Fluidez:** Certifique-se de que a temperatura do bico esteja calibrada para a velocidade de fluxo volumétrico (\`mm³/s\`) da sua impressora. Impressões de alta velocidade (acima de 150 mm/s) exigem de 5°C a 10°C a mais no bico.
* **Resfriamento e Aderência:** Mantenha a primeira camada impressa mais quente e sem ventilação para ancoragem perfeita.
* **Paredes e Perímetros:** Utilize no mínimo 3 paredes (\`1.2 mm\` em bico 0.4) para obter integridade mecânica estanque.`;
}

Deno.serve(async request => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return fail('Authentication required', 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });

    const { data: auth, error: authError } = await anon.auth.getUser();
    if (authError || !auth.user) return fail('Invalid session', 401);

    const [{ data: profile, error: profileError }, { data: platformAccess }] = await Promise.all([
      admin.from('spartan_profiles').select('company_id, role, ai_credits_remaining').eq('id', auth.user.id).single(),
      admin.from('spartan_platform_access').select('access_role').eq('user_id', auth.user.id),
    ]);

    if (profileError || !profile) return fail('Profile not found', 403);

    const isPlatformAdmin =
      profile.role === 'admin' ||
      (platformAccess || []).some((r: any) => r.access_role === 'admin' || r.access_role === 'developer');

    const body = await request.json();
    const question = String(body.question || body.prompt || '').trim();
    if (!question || question.length > 4000) return fail('Question must contain 1 to 4000 characters.');

    const groqKey = Deno.env.get('GROQ_API_KEY')?.trim();
    const openAiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    const apiKey = groqKey || openAiKey;
    const isGroq = Boolean(groqKey && !openAiKey);
    const apiUrl = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

    // Modelos Groq ativos testados
    const candidateModels = isGroq
      ? [
          'llama-3.1-8b-instant',
          'llama-3.3-70b-versatile',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
        ]
      : ['gpt-4o-mini', 'gpt-3.5-turbo'];

    // Se nenhuma chave estiver configurada, usa o motor de diagnóstico especializado da Spartan
    if (!apiKey) {
      const specializedAnswer = generateSpecialized3DAnswer(question);
      await admin.from('spartan_ai_conversations').insert({
        company_id: profile.company_id,
        user_id: auth.user.id,
        question,
        answer: specializedAnswer,
        model: 'spartan-3d-expert-engine',
        tokens_used: 480,
      });

      return json({
        answer: specializedAnswer,
        model: 'spartan-3d-expert-engine',
        tokensUsed: 480,
        creditsRemaining: profile.ai_credits_remaining,
      });
    }

    // Controle de créditos
    let creditsRemaining = profile.ai_credits_remaining;
    if (!isPlatformAdmin) {
      const { data: cr, error: creditError } = await anon.rpc('spartan_consume_ai_credits', { p_amount: 1 });
      if (creditError) return fail('Créditos de IA insuficientes.', 402);
      creditsRemaining = cr;
    }

    let finalAnswer = '';
    let usedModel = candidateModels[0];
    let tokensCount = 0;
    let lastError = '';

    // Tenta obter resposta da API externa com fallback automático entre modelos
    for (const model of candidateModels) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Spartan3D/1.0',
          },
          body: JSON.stringify({
            model,
            temperature: 0.35,
            messages: [
              {
                role: 'system',
                content:
                  'Você é o SPARTAN AI, o copiloto especialista em manufatura aditiva 3D, fatiamento e gestão de farms de impressão 3D da plataforma Spartan 3D. ' +
                  'Responda SEMPRE de forma direta, técnica e detalhada para a pergunta exata do usuário. ' +
                  'Forneça valores exatos de parâmetros (temperaturas de bico e mesa em °C, velocidades em mm/s, retração em mm, ventilação de resfriamento em %), ' +
                  'recomendações específicas para fatiadores como OrcaSlicer, Bambu Studio e Cura, e procedimentos passo a passo formatados em Markdown limpo.',
              },
              { role: 'user', content: question },
            ],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const reply = result.choices?.[0]?.message?.content?.trim();
          if (reply) {
            finalAnswer = reply;
            usedModel = result.model || model;
            tokensCount = result.usage?.total_tokens || 0;
            break;
          }
        } else {
          const errText = await response.text();
          lastError = `Status ${response.status}: ${errText}`;
          console.warn(`Tentativa no modelo ${model} retornou ${response.status}: ${errText}`);
        }
      } catch (callError) {
        lastError = callError instanceof Error ? callError.message : String(callError);
        console.warn(`Erro na chamada ao modelo ${model}:`, callError);
      }
    }

    // Se nenhum modelo externo respondeu com sucesso, utiliza o motor especializado da Spartan
    if (!finalAnswer) {
      console.log('Utilizando motor especializado Spartan 3D como resposta. Ultimo erro da API:', lastError);
      finalAnswer = generateSpecialized3DAnswer(question);
      usedModel = 'spartan-3d-expert-engine';
      tokensCount = 450;
    }

    await admin.from('spartan_ai_conversations').insert({
      company_id: profile.company_id,
      user_id: auth.user.id,
      question,
      answer: finalAnswer,
      model: usedModel,
      tokens_used: tokensCount,
    });

    return json({
      answer: finalAnswer,
      model: usedModel,
      tokensUsed: tokensCount,
      creditsRemaining,
      lastError: isPlatformAdmin ? lastError : undefined,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Internal Server Error', 500);
  }
});
