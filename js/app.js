// App Logic - Gerenciamento do simulador
class SimuladorApp {
    constructor() {
        this.currentModal = null;
        this.currentSimulado = null;
        this.userAnswers = []; // Armazena a resposta do usuário: '1', '2' ou null (em branco)
        this.questionResults = []; // Armazena se acertou: true/false/null (null para em branco)
    }

    // Extrair dados do JSON
    extractSimuladoData(jsonData, fileName) {
        try {
            let dadosSimulado = null;
            let questoesArray = [];

            if (Array.isArray(jsonData) && jsonData.length >= 2) {
                const dadosObj = jsonData.find(item => item.dadosDoSimulado);
                const questoesObj = jsonData.find(item => item.questoes);

                if (dadosObj && dadosObj.dadosDoSimulado) {
                    dadosSimulado = dadosObj.dadosDoSimulado;
                }
                if (questoesObj && Array.isArray(questoesObj.questoes)) {
                    questoesArray = questoesObj.questoes;
                }
            } else if (jsonData.dadosDoSimulado && jsonData.questoes) {
                dadosSimulado = jsonData.dadosDoSimulado;
                questoesArray = jsonData.questoes;
            } else if (jsonData.dadosDoSimulado) {
                dadosSimulado = jsonData.dadosDoSimulado;
                if (jsonData.questoes) questoesArray = jsonData.questoes;
            } else if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].textoQuestao) {
                questoesArray = jsonData;
                dadosSimulado = { Assuntos: "Simulado", Quantidade: questoesArray.length, Banca: "Não informada" };
            } else {
                dadosSimulado = { Assuntos: "Simulado", Quantidade: 0 };
            }

            if (questoesArray.length === 0) {
                for (let key in jsonData) {
                    if (Array.isArray(jsonData[key]) && jsonData[key].length > 0 && jsonData[key][0].textoQuestao) {
                        questoesArray = jsonData[key];
                        break;
                    }
                }
            }

            const questoesValid = (questoesArray || []).map((q, idx) => ({
                textoQuestao: q.textoQuestao || `Questão ${idx + 1}`,
                textoAlternativa1: q.textoAlternativa1 || "Certo",
                textoAlternativa2: q.textoAlternativa2 || "Errado",
                alternativaCorreta: q.alternativaCorreta || "1",
                msgAlt1: q.msgAlt1 || "Resposta incorreta.",
                msgAlt2: q.msgAlt2 || "Resposta correta!",
            }));

            return {
                id: fileName + Date.now(),
                titulo: dadosSimulado?.Assuntos || dadosSimulado?.Disciplina || "Simulado",
                assunto: dadosSimulado?.Assuntos || dadosSimulado?.Disciplina || "Questões",
                banca: dadosSimulado?.Banca || "Não informada",
                cargo: dadosSimulado?.Cargo || "Não informado",
                quantidade: dadosSimulado?.Quantidade || questoesValid.length,
                dificuldade: dadosSimulado?.Dificuldade || "Média",
                questoes: questoesValid,
            };
        } catch (e) {
            console.error("Erro ao extrair dados:", e);
            return null;
        }
    }

    // Remover prefixo das mensagens
    removePrefix(message) {
        const prefixes = [
            "Você acertou. ",
            "Você acertou! ",
            "Resposta correta. ",
            "Resposta correta! ",
            "Correto! ",
            "✅ Correto! ",
            "Você acertou: "
        ];

        let cleaned = message;
        for (const prefix of prefixes) {
            if (cleaned.startsWith(prefix)) {
                cleaned = cleaned.substring(prefix.length);
                break;
            }
        }
        return cleaned;
    }

    // Abrir simulado
    abrirSimulado(simulado) {
        this.currentSimulado = simulado;
        this.userAnswers = new Array(simulado.questoes.length).fill(null);
        this.questionResults = new Array(simulado.questoes.length).fill(null);
        this.criarModalSimulado(simulado);
    }

    // Criar modal do simulado
criarModalSimulado(simulado) {
  if (this.currentModal) {
    this.currentModal.remove();
  }
  
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2>📌 ${simulado.titulo} - ${simulado.banca}</h2>
      <button class="close-modal">✕</button>
    </div>
    <div class="modal-body">
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div id="questoesContainer"></div>
      <!-- O resultContainer será adicionado automaticamente pelo renderQuestoes após a última questão -->
    </div>
  `;
  
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
  this.currentModal = modalOverlay;
  
  const closeBtn = modal.querySelector('.close-modal');
  closeBtn.onclick = () => {
    modalOverlay.remove();
    this.currentModal = null;
    this.currentSimulado = null;
  };
  
  this.renderQuestoes(simulado);
}

    // Renderizar questões
  renderQuestoes(simulado) {
    const containerQuestoes = document.querySelector('#questoesContainer');
    const progressFill = document.querySelector('.progress-fill');
    if (!containerQuestoes) return;
    
    const respondidas = this.userAnswers.filter(a => a !== null).length;
    const total = simulado.questoes.length;
    const percent = (respondidas / total) * 100;
    if (progressFill) progressFill.style.width = `${percent}%`;
    
    containerQuestoes.innerHTML = '';
    
    // Renderizar cada questão
    simulado.questoes.forEach((questao, idx) => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      const userAnswer = this.userAnswers[idx];
      const isAnswered = userAnswer !== null;
      const isCorrect = this.questionResults[idx];
      
      let questionHtml = `
        <div class="question-text">
          <strong>${idx + 1}.</strong> ${questao.textoQuestao}
        </div>
        <div class="options">
          <button class="option-btn" data-qidx="${idx}" data-opt="1">${questao.textoAlternativa1}</button>
          <button class="option-btn" data-qidx="${idx}" data-opt="2">${questao.textoAlternativa2}</button>
        </div>
      `;
      
      if (isAnswered) {
        const feedbackMsg = (userAnswer === '1') ? questao.msgAlt1 : questao.msgAlt2;
        const feedbackClass = isCorrect ? 'correct' : 'incorrect';
        const feedbackTitle = isCorrect ? '✅ Correto!' : '❌ Incorreto!';
        
        questionHtml += `
          <div class="feedback ${feedbackClass}">
            <strong>${feedbackTitle}</strong><br>
            ${feedbackMsg}
          </div>
        `;
        
        if (!isCorrect) {
          const correctAlternative = questao.alternativaCorreta;
          let correctMsg = (correctAlternative === '1') ? questao.msgAlt1 : questao.msgAlt2;
          correctMsg = this.removePrefix(correctMsg);
          
          questionHtml += `
            <button class="explain-btn" data-explain-idx="${idx}">💡 Explicar</button>
            <div id="explanation-${idx}" class="explanation">
              <strong>📖 Explicação:</strong><br>
              ${correctMsg}
            </div>
          `;
        }
      }
      
      questionDiv.innerHTML = questionHtml;
      containerQuestoes.appendChild(questionDiv);
      
      const btns = questionDiv.querySelectorAll('.option-btn');
      btns.forEach(btn => {
        const optVal = btn.getAttribute('data-opt');
        
        if (isAnswered) {
          const userSelected = (userAnswer === optVal);
          
          if (userSelected) {
            if (isCorrect) {
              btn.classList.add('correct-answer');
            } else {
              btn.classList.add('wrong-answer');
            }
          }
          
          btn.disabled = true;
        } else {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.responderQuestao(idx, optVal, simulado);
          });
        }
      });
      
      if (!isCorrect && isAnswered) {
        const explainBtn = questionDiv.querySelector('.explain-btn');
        if (explainBtn) {
          explainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const explanationDiv = document.getElementById(`explanation-${idx}`);
            if (explanationDiv) {
              explanationDiv.classList.toggle('show');
            }
          });
        }
      }
    });
    
    // Calcular estatísticas
    const acertos = this.questionResults.filter(r => r === true).length;
    const erros = this.questionResults.filter(r => r === false).length;
    const emBranco = this.userAnswers.filter(a => a === null).length;
    const saldo = acertos - erros;
    
    // Determinar classe do saldo (positivo, negativo ou neutro)
    let saldoClass = '';
    let saldoIcon = '';
    let saldoText = '';
    
    if (saldo > 0) {
      saldoClass = 'positive';
      saldoIcon = '🟢';
      saldoText = 'Desempenho Positivo';
    } else if (saldo < 0) {
      saldoClass = 'negative';
      saldoIcon = '🔴';
      saldoText = 'Desempenho Negativo';
    } else {
      saldoClass = 'neutral';
      saldoIcon = '⚪';
      saldoText = 'Desempenho Neutro';
    }
    
    // Criar ou atualizar o painel de resultados (embaixo da última questão)
    let resultContainer = document.getElementById('resultContainer');
    if (!resultContainer) {
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        const newResultContainer = document.createElement('div');
        newResultContainer.id = 'resultContainer';
        newResultContainer.className = 'result-summary';
        modalBody.appendChild(newResultContainer);
        resultContainer = newResultContainer;
      }
    }
    
    if (resultContainer) {
      resultContainer.style.display = 'block';
      resultContainer.innerHTML = `
        <div class="result-stats">
          <div class="stat">
            <div class="value" style="color: #28a745;">${acertos}</div>
            <div class="label">Acertos</div>
          </div>
          <div class="stat">
            <div class="value" style="color: #dc3545;">${erros}</div>
            <div class="label">Erros</div>
          </div>
          <div class="stat">
            <div class="value" style="color: #6c757d;">${emBranco}</div>
            <div class="label">Em Branco</div>
          </div>
          <div class="stat">
            <div class="value ${saldoClass}">${saldo >= 0 ? '+' : ''}${saldo}</div>
            <div class="label">Saldo (A - E)</div>
          </div>
        </div>
        <div class="score ${saldoClass}">
          ${saldoIcon} ${saldoText} ${saldoIcon}
        </div>
        ${respondidas === total ? '<button class="reset-btn" id="resetSimuladoBtn">🔄 Refazer Simulado</button>' : ''}
      `;
      
      // Adicionar evento do botão reset se todas foram respondidas
      if (respondidas === total) {
        const resetBtn = document.getElementById('resetSimuladoBtn');
        if (resetBtn) {
          resetBtn.onclick = () => this.resetSimulado();
        }
      }
    }
  }

  // Responder questão
  responderQuestao(questaoIndex, resposta, simulado) {
    if (this.userAnswers[questaoIndex] !== null) return;
    
    const questao = simulado.questoes[questaoIndex];
    const correta = questao.alternativaCorreta;
    const acertou = (resposta === correta);
    
    this.userAnswers[questaoIndex] = resposta;
    this.questionResults[questaoIndex] = acertou;
    
    this.renderQuestoes(simulado);
    
    // Scroll para a questão atual
    const questoesContainer = document.querySelector('#questoesContainer');
    if (questoesContainer) {
      const questionElements = questoesContainer.querySelectorAll('.question-item');
      if (questionElements[questaoIndex]) {
        questionElements[questaoIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Resetar simulado
  resetSimulado() {
    if (!this.currentSimulado) return;
    const total = this.currentSimulado.questoes.length;
    this.userAnswers = new Array(total).fill(null);
    this.questionResults = new Array(total).fill(null);
    this.renderQuestoes(this.currentSimulado);
  }
}




// Instância global
const app = new SimuladorApp();