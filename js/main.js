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
  generatePromptBtn.addEventListener('click', () => {
    criarPromptModal();
  });

  // Função para criar modal do prompt
  function criarPromptModal() {
    const existingModal = document.querySelector('.prompt-modal-overlay');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'prompt-modal-overlay';
    
    modalOverlay.innerHTML = `
      <div class="prompt-modal">
        <div class="prompt-modal-header">
          <h2>🤖 Gerar Prompt para IA (CEBRASPE)</h2>
          <button class="close-prompt-modal">✕</button>
        </div>
        <div class="prompt-modal-body">
          <form id="promptForm">
            <div class="form-group">
              <label>📚 Disciplina *</label>
              <select id="disciplina" required>
                <option value="Conhecimentos Específicos">Conhecimentos Específicos</option>
                <option value="Língua Portuguesa">Língua Portuguesa</option>
                <option value="Raciocínio lógico">Raciocínio lógico</option>
                <option value="Legislação">Legislação</option>
                <option value="Redação Oficial">Redação Oficial</option>
                <option value="Licitações e Contratos">Licitações e Contratos</option>
                <option value="Noções de Informática">Noções de Informática</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>📖 Assuntos *</label>
              <textarea id="assuntos" placeholder="Ex: Design thinking na educação, Gestão do conhecimento" required>Design thinking na educação</textarea>
            </div>
            
            <div class="form-group">
              <label>🔢 Quantidade de questões *</label>
              <input type="number" id="quantidade" min="1" max="50" value="15" required>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>🎯 Banca</label>
                <input type="text" id="banca" value="CEBRASPE" disabled>
              </div>
              
              <div class="form-group">
                <label>📊 Dificuldade</label>
                <select id="dificuldade">
                  <option value="Fácil">Fácil</option>
                  <option value="Média" selected>Média</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>👔 Cargo</label>
                <input type="text" id="cargo" value="Técnico Universitário de Desenvolvimento" disabled>
              </div>
              
              <div class="form-group">
                <label>🏛️ Concurso</label>
                <input type="text" id="concurso" value="UDESC - Universidade do Estado de Santa Catarina" disabled>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>🎓 Nível</label>
                <input type="text" id="nivel" value="Ensino superior" disabled>
              </div>
              
              <div class="form-group">
                <label>📝 Área</label>
                <input type="text" id="area" value="Técnico em Educação" disabled>
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
    
    return `Você é um professor especialista em concursos públicos, elaborador profissional de questões e especialista em psicometria, avaliação educacional e design de instrumentos de medida, com domínio profundo do estilo da banca ${banca}.
Seu objetivo é gerar um conjunto de questões indistinguível de uma prova real da ${banca}, funcionando como um instrumento válido, confiável e psicometricamente balanceado, sem qualquer pista formal que permita identificar a alternativa correta sem domínio real do conteúdo. As questões devem ser embasadas em fontes de pesquisa de materiais de autores renomandos nos assuntos, deve usar material de qualidade geralmente utilizados em provas de certificação ou de concurso público, com nível exigente interpretação e conhecimento técnico.
As questões serão em Português brasileiro.

PERFIL REAL DA BANCA:
Perfil analítico, interpretativo e aprofundado.
Foco em compreensão, aplicação prática, integração de conceitos e análise crítica.
Cobrança forte de interpretação de textos, normas e cenários implícitos.
Enunciados geralmente médios a longos, linguagem formal, técnica e precisa.
Alto nível de contextualização, com situações-problema e casos práticos.
Modelo característico: Certo ou Errado (C/E), com penalização por erro.

FORMATO REAL DAS QUESTÕES
Utilize:
1. Questões de múltipla escolha certo ou errado.
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
1. Structural Bias - Todas devem ter estrutura sintática equivalente.
2. Grammatical Cue - O enunciado não pode concordar semanticamente apenas com a alternativa correta.
3. Test-Wiseness Control - A questão não pode ser resolvida apenas por técnicas de prova sem conhecimento do conteúdo.

CONTROLE DE QUALIDADE DO TESTE (NÍVEL INSTITUCIONAL)
Redundancy Control (Item Overlap) - Não elaborar questões que avaliem exatamente o mesmo conceito central.
Local Item Independence - Nenhuma questão pode fornecer pista conceitual, definição ou informação que ajude diretamente a resolver outra.
Construct Representation - O conjunto de questões deve representar adequadamente o construto avaliado.

MELHORIAS AVANÇADAS DE REALISMO (OBRIGATÓRIAS)
1. Formulaic Pattern Control - Evite repetir estruturas de enunciado ao longo do simulado.
2. Controle de Plausibilidade de Distratores - Proíba distractores anticonceituais ou absurdos.
3. Princípio da Competência do Candidato - Assuma que o candidato estudou e conhece os princípios básicos.
4. Proibição de Enunciados Explicativos (Anti-Cueing) - Omissão do Conceito: Proibido incluir definições, sinônimos ou a lógica da resposta correta no enunciado.

ENUNCIADOS
Tamanho Médio (2 a 8 linhas), quanto mais complexo, maior o enunciado
Linguagem formal e neutra.
Comandos variados, sem repetição excessiva de estrutura.
Não utilize sinônimos diretos do conceito.

5. Alternativas
As alternativas DEVEM conter APENAS Certo e Errado, variando aleatóriamente.

O resultado final deve constituir um instrumento de avaliação educacional realista, controlando explicitamente:
cueing effect, visual salience bias, attention bias, length bias, structural bias, grammatical cue, pattern bias, test-wiseness, content validity, cognitive demand, redundancy, local item independence, formulaic pattern control, high-quality distractor discrimination, near-miss distractors e human-like item noise, sendo indistinguível de uma prova real da banca ${banca}.

REGRAS
1. Exatamente ${quantidade} questões solicitadas, sem repetição.
2. Usar apenas estas tags HTML quando necessário: <b>, <br>, <code>, <sup>, <sub>, <i>, <u>, <ul>, <ol>, <li>, <p>, <blockquote>, <table>, <th>, <tr>, <td>
3. Matemática com notação simplificada.
4. Alternativa correta (Certo ou Errado).
5. A explicação da alternativa Correta inicia com "Você acertou." (explicação técnica).
6. A explicação da alternativa incorreta inicia com "Resposta incorreta." (explicar erro).
7. Redação compatível com cargo e nível.

PARÂMETROS
Banca: ${banca}
Cargo: ${cargo}
Área: ${area}
Concurso: ${concurso}
Disciplina: ${disciplina}
Assuntos: ${assuntos}
Dificuldade: ${dificuldade}
Tipo: Certo/Errado
Quantidade: ${quantidade}
Nível: ${nivel}

FORMATO DE SAÍDA
IMPORTANTE: Retorne APENAS JSON válido.

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
      "Tipo": "Certo/Errado",
      "Quantidade": ${quantidade},
      "Nível": "${nivel}"
    }
  },
  {
    "questoes": [
      {
        "textoQuestao": "Enunciado claro e objetivo com notação matemática SIMPLIFICADA se necessário.",
        "textoAlternativa1": "Certo",
        "textoAlternativa2": "Errado",
        "alternativaCorreta": "1 ou 2",
        "msgAlt1": "Resposta incorreta. Explique detalhadamente o erro conceitual e como chegar à resposta correta.",
        "msgAlt2": "Você acertou. Explique detalhadamente por que esta é a resposta correta, com fundamentação técnica."
      }
    ]
  }
]`;
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