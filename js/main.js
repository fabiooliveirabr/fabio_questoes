// Main - Controle da UI e eventos
document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('input');
  const container = document.getElementById('container');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const generatePromptBtn = document.getElementById('generatePromptBtn');
  const statsBar = document.getElementById('statsBar');
  const statTotal = document.getElementById('statTotal');
  const statStorage = document.getElementById('statStorage');
  const statLastSync = document.getElementById('statLastSync');

  // Carregar simulados salvos ao iniciar
  await carregarSimuladosSalvos();

  // Check if navigated from Caderno de Erros
  const abrirSimulado = sessionStorage.getItem('abrirSimulado');
  const questaoFoco = sessionStorage.getItem('questaoFoco');

  if (abrirSimulado && questaoFoco !== null) {
    // Clear the session storage items immediately
    sessionStorage.removeItem('abrirSimulado');
    sessionStorage.removeItem('questaoFoco');

    // Find the simulado
    const simulados = await db.loadAll();
    const simulado = simulados.find(s => s.fileName === abrirSimulado);

    if (simulado) {
      const qIdx = parseInt(questaoFoco, 10);
      // Open the simulado
      app.abrirSimulado(simulado);

      // After a short delay to let the modal render, scroll to the question
      setTimeout(() => {
        const questoesContainer = document.querySelector('#questoesContainer');
        if (questoesContainer) {
          const questionElements = questoesContainer.querySelectorAll('.question-item');
          if (questionElements[qIdx]) {
            questionElements[qIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a brief highlight effect
            questionElements[qIdx].style.transition = 'background 0.5s';
            questionElements[qIdx].style.background = '#fffde7';
            setTimeout(() => {
              questionElements[qIdx].style.background = '';
            }, 1500);
          }
        }
      }, 300);
    }
  }

  // Evento de upload
  input.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));

    if (jsonFiles.length === 0) {
      alert('⚠️ Nenhum arquivo JSON encontrado na pasta selecionada.');
      return;
    }

    container.innerHTML = '<div class="empty-state">⏳ Processando arquivos...</div>';

    const novos = [];
    const duplicados = [];

    for (const file of jsonFiles) {
      try {
        const existe = await db.exists(file.name);

        if (existe) {
          duplicados.push(file.name);
        } else {
          const text = await file.text();
          const jsonData = JSON.parse(text);
          const simulado = app.extractSimuladoData(jsonData, file.name);

          if (simulado && simulado.questoes.length > 0) {
            // Capturar data de modificação do arquivo
            const fileLastModified = new Date(file.lastModified).toISOString();
            await db.save(simulado, file.name, fileLastModified);
            novos.push(file.name);
          }
        }
      } catch (err) {
        console.error(`Erro ao processar ${file.name}:`, err);
      }
    }

    let mensagem = '';
    if (novos.length > 0) mensagem += `✅ ${novos.length} novo(s) simulado(s) adicionado(s).\n`;
    if (duplicados.length > 0) mensagem += `⚠️ ${duplicados.length} simulado(s) já existiam e foram ignorados.`;

    if (mensagem) alert(mensagem);

    await carregarSimuladosSalvos();
  });

  // Botão limpar tudo
  clearAllBtn.addEventListener('click', async () => {
    const confirmar = confirm('⚠️ Tem certeza que deseja excluir TODOS os simulados? Esta ação não pode ser desfeita.');

    if (confirmar) {
      await db.clearAll();
      await carregarSimuladosSalvos();
      alert('🗑️ Todos os simulados foram removidos.');
    }
  });

  // Botão gerar prompt
  generatePromptBtn.addEventListener('click', async () => {
    await criarPromptModal();
  });

  // Função para criar modal do prompt
  async function criarPromptModal() {
    const existingModal = document.querySelector('.prompt-modal-overlay');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'prompt-modal-overlay';

    modalOverlay.innerHTML = `
      <div class="prompt-modal">
        <div class="prompt-modal-header">
          <h2>🤖 Gerar Prompt para IA (5 Alternativas)</h2>
          <button class="close-prompt-modal">✕</button>
        </div>
        <div class="prompt-modal-body">
          <form id="promptForm">
            <div class="form-group">
              <label>📚 Disciplina *</label>
              <input type="text" id="disciplina" required>
            </div>
            
            <div class="form-group">
              <label>📖 Assuntos *</label>
              <textarea id="assuntos" placeholder="Ex: Design thinking na educação, Gestão do conhecimento" required></textarea>
            </div>
            
            <div class="form-group">
              <label>🔢 Quantidade de questões *</label>
              <input type="number" id="quantidade" min="1" max="50" value="15" required>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>🎯 Banca</label>
                <input type="text" id="banca" value="FURB" disabled>
              </div>
              
              <div class="form-group">
                <label>📊 Dificuldade</label>
                <select id="dificuldade">
                  <option value="Fácil" selected>Fácil</option>
                  <option value="Média" >Média</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>👔 Cargo</label>
                <input type="text" id="cargo" value="Analista de Informática" disabled>
              </div>
              
              <div class="form-group">
                <label>🏛️ Concurso</label>
                <input type="text" id="concurso" value="SED/SC - Secretaria de Estado da Educação de Santa Catarina" disabled>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>🎓 Nível</label>
                <input type="text" id="nivel" value="Ensino superior" disabled>
              </div>
              
              <div class="form-group">
                <label>📝 Área</label>
                <input type="text" id="area" value="Educação" disabled>
              </div>
            </div>
            
            <button type="button" class="copy-btn" id="copyPromptBtn">
              📋 Copiar Prompt Completo
            </button>
            <div id="copyMessage" style="margin-top: 1rem;"></div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // Carregar inputs salvos do IndexedDB
    try {
      const config = await db.getPromptConfig();
      if (config) {
        const disc = modalOverlay.querySelector('#disciplina');
        if (disc) disc.value = config.disciplina || '';
        const ass = modalOverlay.querySelector('#assuntos');
        if (ass) ass.value = config.assuntos || '';
        const quant = modalOverlay.querySelector('#quantidade');
        if (quant) quant.value = config.quantidade || '15';
        const dif = modalOverlay.querySelector('#dificuldade');
        if (dif) dif.value = config.dificuldade || 'Média';
      }
    } catch (err) {
      console.error('Erro ao carregar config do prompt:', err);
    }

    // Salvar inputs automaticamente no IndexedDB ao digitar
    async function salvarPromptConfig() {
      const config = {
        key: 'prompt_last_inputs',
        disciplina: modalOverlay.querySelector('#disciplina')?.value || '',
        assuntos: modalOverlay.querySelector('#assuntos')?.value || '',
        quantidade: modalOverlay.querySelector('#quantidade')?.value || '15',
        dificuldade: modalOverlay.querySelector('#dificuldade')?.value || 'Média'
      };
      try {
        await db.savePromptConfig(config);
      } catch (err) {
        console.error('Erro ao salvar config do prompt:', err);
      }
    }

    const formInputs = modalOverlay.querySelectorAll('#disciplina, #assuntos, #quantidade, #dificuldade');
    formInputs.forEach(input => {
      input.addEventListener('input', salvarPromptConfig);
    });

    const closeBtn = modalOverlay.querySelector('.close-prompt-modal');
    closeBtn.onclick = () => modalOverlay.remove();

    // modalOverlay.onclick = (e) => {
    //   if (e.target === modalOverlay) modalOverlay.remove();
    // };

    const copyBtn = modalOverlay.querySelector('#copyPromptBtn');
    copyBtn.addEventListener('click', () => {
      const prompt = gerarPromptCompleto();
      navigator.clipboard.writeText(prompt).then(() => {
        const msgDiv = modalOverlay.querySelector('#copyMessage');
        msgDiv.innerHTML = '<div class="copy-success">✅ Prompt copiado com sucesso!</div>';
        setTimeout(() => {
          msgDiv.innerHTML = '';
        }, 2000);
      }).catch(() => {
        alert('Erro ao copiar. Selecione e copie manualmente.');
      });
    });
  }

  // Função para gerar o prompt completo
  function gerarPromptCompleto() {
    const disciplina = document.getElementById('disciplina')?.value || 'Conhecimentos Específicos';
    const assuntos = document.getElementById('assuntos')?.value || 'Design thinking na educação';
    const quantidade = document.getElementById('quantidade')?.value || '15';
    const banca = document.getElementById('banca')?.value || 'CEBRASPE';
    const dificuldade = document.getElementById('dificuldade')?.value || 'Média';
    const cargo = document.getElementById('cargo')?.value || 'Técnico Universitário de Desenvolvimento';
    const concurso = document.getElementById('concurso')?.value || 'UDESC - Universidade do Estado de Santa Catarina';
    const nivel = document.getElementById('nivel')?.value || 'Ensino superior';
    const area = document.getElementById('area')?.value || 'Técnico em Educação';

    return `Você é um especialista em concursos públicos, elaborador profissional de questões e especialista em psicometria, avaliação educacional e design de instrumentos de medida, com domínio profundo do estilo da banca ${banca}.
Seu objetivo é gerar um conjunto de questões indistinguível de uma prova real da ${banca}, funcionando como um instrumento válido, confiável e psicometricamente balanceado, sem qualquer pista formal que permita identificar a alternativa correta sem domínio real do conteúdo. As questões devem ser embasadas em fontes de pesquisa de materiais de autores renomandos nos assuntos, deve usar material de qualidade geralmente utilizados em provas de certificação ou de concurso público, com nível exigente interpretação e conhecimento técnico.
As questões serão em Português brasileiro.

PERFIL REAL DA BANCA:
A banca FURB demonstra um perfil técnico-institucional e rigorosamente normativo, com ênfase na literalidade de leis, resoluções, portarias e diretrizes curriculares, exigindo do candidato conhecimento preciso de dispositivos legais como BNCC, LDB, ECA, Diretrizes do AEE, PNAE, FUNDEB, LGPD e normativas estaduais catarinenses. As questões apresentam enunciados diretos e situações didáticas curtas, com linguagem formal e objetiva, evitando longos casos clínicos ou estudos de caso extensos. A banca explora pegadinhas recorrentes como: troca sutil de conceitos técnicos (ex.: inverter os princípios do judô "jita-kyoei" e "seiryoku-zenyo"); uso de termos absolutos como "sempre", "nunca", "exclusivamente", "unicamente" para tornar alternativas falsas; inversão de causa e efeito ou hierarquia de processos (ex.: ordem dos níveis de planejamento); confusão entre "justificativa" e "complementação" em asserções; omissão de elementos essenciais em conceitos ou leis; e exploração de exceções normativas como alternativa correta. A FURB valoriza classificações, periodizações e modelos teóricos clássicos (Piaget, Vygotsky, Durkheim, Weber, Marx), além de forte presença de Educação Especial (AEE, Libras, deficiências) e metodologias de ensino específicas por disciplina (TGfU, Método Situacional, Abordagem Triangular, Ensino Estruturado TEACCH). O nível de dificuldade é médio a difícil, com distribuição irregular de respostas entre as alternativas, exigindo domínio minucioso da literalidade das normas e precisão conceitual, pois a banca penaliza o candidato que confia no "bom senso" ou em respostas apenas "fazer sentido" sem respaldo técnico-legal.
Modelo característico: 5 alternativas (A, B, C, D, E), sem penalização por erro.

FORMATO REAL DAS QUESTÕES
Utilize:
1. Questões de múltipla escolha (A–E) com uma única correta.
2. Questões com itens para julgar, com quantidade variável (mínimo 4 a 6 itens, escolha aleatóriamente, conforme
o conteúdo).
3. Ocasionalmente, associação de colunas, com quantidade variadas, exemplos, 3 itens e 3 colunas, 4 itens e 4 colunas, 5 itens e 5 colunas.
4. Ocasionalmente, completar lacunas (preencher espaços em branco com sequência de palavras) com alternativas.
5. Ocasionalmente, verdadeiro ou falso (V ou F) com julgamento afirmações(entre 3 e 5 itens).
6. Ocasionalmente, questões do tipo qual a alternativa <b>INCORRETA</b>.

Não utilize:
Questões discursivas.
Múltiplas corretas.
Estudos de caso longos.

VALIDADE DE CONTEÚDO (CONTENT VALIDITY)
As questões devem respeitar um blueprint de conteúdo, cobrindo de forma proporcional e equilibrada todos os tópicos relevantes do conteúdo programático informado, evitando:
super-representação de um tema,
sub-representação ou ausência de outro.
Seja criativo, antes de criar uma nova questões verifique se o conteúdo ou a forma de cobrar já não foi abordado por outra questão, evite repetir este aspecto de cobraça mesmo que com enunciados diferentes.
O conjunto de questões deve representar adequadamente o construto avaliado, evitando construct underrepresentation.
Se a questão mencionar uma palavra ou expressão em um texto ou frase, e perguntar sobre o termo sublinhado em destaque, lembre-se de usar a formatação HTML <u> para destacar o termo.

NÍVEL COGNITIVO (TAXONOMIA DE BLOOM – REVISADA)
Distribua os níveis cognitivos das questões da seguinte forma:
50%: analisar e 50%: aplicar

Evite questões puramente mecânicas ou de memorização vazia.

CONTROLE PSICOMÉTRICO EXPLÍCITO (OBRIGATÓRIO)
Ao elaborar cada questão, controle ativamente os seguintes vieses:
1. Cueing Effect
A alternativa correta não pode se destacar por:
maior precisão semântica,
melhor redação,
maior detalhamento,
ausência de erro enquanto as outras possuem.

2. Visual Salience Bias
A alternativa correta não pode ser a única que contenha:
parênteses (),
números,
aspas,
dois-pontos,
siglas,
exemplos.

3. Attention Bias
Nenhuma alternativa deve chamar atenção por elementos gráficos, tipográficos ou
semânticos.

4. Length Bias
Todas as alternativas devem ter comprimento semelhante. Diferença de comprimento ≤ 10%. Validar internamente que a alternativa correta não se destaca. Correta nunca é a mais longa.

5. Structural Bias
Todas devem ter estrutura sintática equivalente.

6. Grammatical Cue
O enunciado não pode concordar semanticamente apenas com a alternativa correta.

7. Test-Wiseness Control
A questão não deve poder ser resolvida apenas por técnicas de prova sem
conhecimento do conteúdo.


CONTROLE DE QUALIDADE DO TESTE (NÍVEL INSTITUCIONAL)
Redundancy Control (Item Overlap)
Não elaborar questões que avaliem exatamente o mesmo conceito central.
Local Item Independence
Nenhuma questão pode fornecer pista conceitual, definição ou informação que ajude
diretamente a resolver outra.

Construct Representation
O conjunto de questões deve representar adequadamente o construto avaliado,
evitando construct underrepresentation.

MELHORIAS AVANÇADAS DE REALISMO (OBRIGATÓRIAS)
1. Formulaic Pattern Control
Evite repetir estruturas de enunciado ao longo do simulado.
Varie sintaticamente os comandos, evitando padrões frasais previsíveis.

2. High-Quality Distractor Discrimination
Cada distrator deve ser capaz de enganar um candidato de conhecimento médio do assunto, não apenas iniciantes ou que não conhecem nada.

3. Near-Miss Distractors
Inclua propositalmente alternativas parcialmente corretas,
contendo apenas um detalhe conceitual incorreto.

4. Human-Like Item Noise
Evite definições excessivamente perfeitas ou acadêmicas demais.
Prefira redações com realismo humano de banca, incluindo pequenas imperfeições
cognitivas naturais. É proibido repetir no enunciado expressões  centrais da alternativa correta. Alterne conscientemente entre:
  - alternativas contendo apenas o termo;
  - alternativas com termo + breve complemento, apenas ocasionalmente e somente quando necessário.

5. Controle de Discriminação Conceitual.
Para avaliar conceitos com nomes próprios (métodos, leis, teorias, nomes), o termo-chave do conceito-alvo deve ser repetido intencionalmente em todas as alternativas. A correta se distingue exclusivamente pela cláusula restritiva ou relação descrita após o termo comum. Construa distratores usando três artifícios: descrição precisa de um conceito vizinho frequentemente confundido; elevação de uma característica real porém opcional a condição obrigatória; ou inclusão de um detalhe técnico final que invalida a afirmação inicialmente plausível.

6. Controle de Plausibilidade de Distratores.
Proíba distractores anticonceituais ou absurdos. Todos os erros devem ser baseados em confusões reais entre conceitos vizinhos, armadilhas normativas ou erros típicos de candidatos. Exemplos proibidos: contradições lógicas diretas com o cerne da teoria ou opções que possam ser descartadas sem conhecimento técnico. A plausibilidade deve ser alta para um candidato de nível médio, forçando a análise conceitual.

7. Princípio da Competência do Candidato (The Competent Test-Taker Assumption) Assuma que o candidato estudou e conhece os princípios básicos. É estritamente proibido criar alternativas erradas baseadas em:
- Ingenuidade (ex: não precisa de segurança, é impossível falhar).
- Preguiça (ex: fazer manualmente é melhor porque é mais fácil).
- Absurdos lógicos.
O erro deve ser TÉCNICO e não comportamental. O distrator deve afirmar que uma ferramenta/prática faz algo que parece que ela faria, mas tecnicamente não faz (limitação de escopo), ou que uma prática substitui outra quando, na verdade, elas são complementares.

8. Proibição de Enunciados Explicativos (Anti-Cueing)
- Omissão do Conceito: Proibido incluir definições, sinônimos ou a lógica da resposta correta no enunciado.
- Comando Direto: O texto deve apenas delimitar o escopo (ex: "Sobre X, assinale...") sem atuar como texto de apoio didático.
- Veto de Palavras-Chave: Se o item avalia o conceito "X", o enunciado não pode conter termos que componham sua definição técnica.
- Discriminação Pura: O comando deve exigir a identificação da norma, ou conceito, ou aplicação prática, ou análise correta entre distratores vizinhos e confundíveis.

DISTRATORES DE ALTA QUALIDADE
As alternativas erradas devem ser:
conceitualmente plausíveis,
baseadas em erros reais de candidatos,
construídas por confusão entre conceitos próximos,
generalizações indevidas,
exceções ignoradas.
Nunca usar:
alternativas absurdas,
obvias,
humor,
ironia,
linguagem informal.

ENUNCIADOS
Tamanho Médio (2 a 8 linhas), quanto mais complexo, maior o enunciado
Linguagem formal e neutra.
Comandos variados, sem repetição excessiva de estrutura.
Não utilize sinônimos diretos do conceito.

9. Alternativas
As alternativas DEVEM conter APENAS o nome do conceito, sem definições, exemplos, enumeração de características ou explicações, exceto se necessário para descrever um procedimento ou característica específica cobrada no enunciado, nos demais casos
É EXPRESSAMENTE PROIBIDO:
- Explicar o conceito dentro da alternativa;
- Incluir listas de funções, benefícios ou características;
- Criar alternativas que funcionem como mini-resumos teóricos.

10. Alternativas
As alternativas DEVEM conter exatamente 5 opções (A, B, C, D, E), com apenas uma alternativa correta.

O resultado final deve constituir um instrumento de avaliação educacional realista, controlando explicitamente:
cueing effect, visual salience bias, attention bias, length bias, structural bias, grammatical cue, pattern bias, test-wiseness, content validity, cognitive demand, redundancy, local item independence, formulaic pattern control, high-quality distractor discrimination, near-miss distractors e human-like item noise, sendo indistinguível de uma prova real da banca ${banca}.

REGRAS
1. Exatamente ${quantidade} questões solicitadas, sem repetição.
2. Usar apenas estas tags HTML quando necessário: <b>, <br>, <code>, <sup>, <sub>, <i>, <u>, <ul>, <ol>, <li>, <p>, <blockquote>, <table>, <th>, <tr>, <td>
3. Matemática com notação simplificada.
4. Alternativa correta (A, B, C, D ou E).
5. A explicação da alternativa correta inicia com "Você acertou." (explicação técnica de porque aquela alternativa é a correta).
6. A explicação de cada alternativa incorreta inicia com "Resposta incorreta." (explicação de porque aquela alternativa específica está incorreta).
7. Redação compatível com cargo e nível.
8. Gere questões somente dos assuntos indicados

PARÂMETROS
Banca: ${banca}
Cargo: ${cargo}
Área: ${area}
Concurso: ${concurso}
Disciplina: ${disciplina}
Assuntos: ${assuntos}
Dificuldade: ${dificuldade}
Tipo: 5 Alternativas
Quantidade: ${quantidade}
Nível: ${nivel}

FORMATO DE SAÍDA
IMPORTANTE: Gere questões somente dos assuntos indicados.

ESTRUTURA JSON EXATA:

[
  {
    "dadosDoSimulado": {
      "Banca": "${banca}",
      "Cargo": "${cargo}",
      "Área": "${area}",
      "Concurso": "${concurso}",
      "Disciplina": "${disciplina}",
      "Assuntos": "${assuntos}",
      "Dificuldade": "${dificuldade}",
      "Tipo": "5 Alternativas",
      "Quantidade": ${quantidade},
      "Nível": "${nivel}"
    }
  },
  {
    "questoes": [
      {
        "textoQuestao": "Enunciado claro e objetivo com notação matemática SIMPLIFICADA se necessário.",
        "textoAlternativaA": "Texto da alternativa A",
        "textoAlternativaB": "Texto da alternativa B",
        "textoAlternativaC": "Texto da alternativa C",
        "textoAlternativaD": "Texto da alternativa D",
        "textoAlternativaE": "Texto da alternativa E",
        "alternativaCorreta": "Letra correspondente da alternativa correta (A, B, C, D ou E)",
        "msgAltA": "Comentário detalhado da alternativa A. Comece com 'Você acertou.' se for a correta, ou 'Resposta incorreta.' se for incorreta.",
        "msgAltB": "Comentário detalhado da alternativa B. Comece com 'Você acertou.' se for a correta, ou 'Resposta incorreta.' se for incorreta.",
        "msgAltC": "Comentário detalhado da alternativa C. Comece com 'Você acertou.' se for a correta, ou 'Resposta incorreta.' se for incorreta.",
        "msgAltD": "Comentário detalhado da alternativa D. Comece com 'Você acertou.' se for a correta, ou 'Resposta incorreta.' se for incorreta.",
        "msgAltE": "Comentário detalhado da alternativa E. Comece com 'Você acertou.' se for a correta, ou 'Resposta incorreta.' se for incorreta."
      }
    ]
  }
]

Nunca coloque vírgula após o último atributo de objetos JSON nem após o último item de arrays, como nas chaves msgAltE e Nível, isso quebra o json.
Cuidado com os nomes das chaves. Cuidado para não repetir chaves dentro de um mesmo objeto.
Antes de retornar o JSON, valide-o com um validador de JSON, corrija se necessário e retorne APENAS JSON válido seguindo rigorosamente o padrão RFC 8259.
`;
  }

  // Função para carregar e exibir simulados salvos
  async function carregarSimuladosSalvos() {
    try {
      const simulados = await db.loadAll();

      const stats = await db.getStats();
      statsBar.style.display = simulados.length > 0 ? 'flex' : 'none';
      statTotal.textContent = stats.total;
      statStorage.textContent = `${stats.totalSizeKB} KB`;
      statLastSync.textContent = stats.ultimaSincronizacao
        ? new Date(stats.ultimaSincronizacao).toLocaleString('pt-BR')
        : '-';

      if (simulados.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            🗂️ Nenhum simulado carregado. Selecione uma pasta para começar.
          </div>
        `;
        return;
      }

      renderCards(simulados);

    } catch (error) {
      console.error('Erro ao carregar simulados:', error);
      container.innerHTML = '<div class="empty-state">❌ Erro ao carregar simulados do banco.</div>';
    }
  }

  // Função para renderizar cards
  function renderCards(simulados) {
    container.innerHTML = '';

    simulados.forEach((sim) => {
      const card = document.createElement('div');
      card.className = 'card';

      const assuntoDisplay = sim.assunto.length > 40 ? sim.assunto.substring(0, 40) + '...' : sim.assunto;
      const dataCarregamento = sim.dataArquivo
        ? new Date(sim.dataArquivo).toLocaleString('pt-BR')
        : new Date(sim.dataCarregamento).toLocaleString('pt-BR');

      card.innerHTML = `
        <div class="badge">${sim.quantidade} questões</div>
        <h3>📖 ${assuntoDisplay}</h3>
        <div class="assunto">${sim.banca}</div>
        <div class="info">
          <span>🎯 ${sim.dificuldade}</span>
          <span>📋 ${sim.cargo.substring(0, 25)}</span>
        </div>
        <div class="data-criacao">
          📅 ${dataCarregamento}
        </div>
        <button class="delete-card" data-filename="${sim.fileName}">🗑️ Excluir</button>
      `;

      card.onclick = (e) => {
        if (e.target.classList.contains('delete-card')) return;
        app.abrirSimulado(sim);
      };

      const deleteBtn = card.querySelector('.delete-card');
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const confirmar = confirm(`Deseja excluir o simulado "${sim.assunto}"?`);
        if (confirmar) {
          await db.delete(sim.fileName);
          await carregarSimuladosSalvos();
        }
      };

      container.appendChild(card);
    });
  }
});