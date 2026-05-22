// App Logic - Gerenciamento do simulador
class SimuladorApp {
  constructor() {
    this.currentModal = null;
    this.currentSimulado = null;
    this.userAnswers = []; // Armazena a resposta do usuário: 'A', 'B', 'C', 'D', 'E' ou null (em branco)
    this.questionResults = []; // Armazena se acertou: true/false/null (null para em branco)
    this.selectedAnswers = [];
    this.crossedOutAnswers = []; // Array de arrays: índices das alternativas tachadas por questão
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

      const questoesValid = (questoesArray || []).map((q, idx) => {
        const isOldFormat = q.textoAlternativa1 !== undefined || q.textoAlternativa2 !== undefined;

        if (isOldFormat) {
          const correctMapping = { "1": "A", "2": "B" };
          const correctAns = correctMapping[q.alternativaCorreta] || q.alternativaCorreta;
          return {
            textoQuestao: q.textoQuestao || `Questão ${idx + 1}`,
            textoAlternativaA: q.textoAlternativa1 || "Certo",
            textoAlternativaB: q.textoAlternativa2 || "Errado",
            textoAlternativaC: "",
            textoAlternativaD: "",
            textoAlternativaE: "",
            alternativaCorreta: correctAns,
            msgAltA: q.msgAlt1 || "Resposta incorreta.",
            msgAltB: q.msgAlt2 || "Resposta correta!",
            msgAltC: "",
            msgAltD: "",
            msgAltE: ""
          };
        } else {
          return {
            textoQuestao: q.textoQuestao || `Questão ${idx + 1}`,
            textoAlternativaA: q.textoAlternativaA || "",
            textoAlternativaB: q.textoAlternativaB || "",
            textoAlternativaC: q.textoAlternativaC || "",
            textoAlternativaD: q.textoAlternativaD || "",
            textoAlternativaE: q.textoAlternativaE || "",
            alternativaCorreta: q.alternativaCorreta || "A",
            msgAltA: q.msgAltA || "Resposta incorreta.",
            msgAltB: q.msgAltB || "Resposta incorreta.",
            msgAltC: q.msgAltC || "Resposta incorreta.",
            msgAltD: q.msgAltD || "Resposta incorreta.",
            msgAltE: q.msgAltE || "Resposta incorreta."
          };
        }
      });

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
    if (simulado && Array.isArray(simulado.questoes)) {
      simulado.questoes = simulado.questoes.map((q, idx) => {
        const isOldFormat = q.textoAlternativa1 !== undefined || q.textoAlternativa2 !== undefined;
        if (isOldFormat) {
          const correctMapping = { "1": "A", "2": "B" };
          const correctAns = correctMapping[q.alternativaCorreta] || q.alternativaCorreta;
          return {
            textoQuestao: q.textoQuestao || `Questão ${idx + 1}`,
            textoAlternativaA: q.textoAlternativa1 || "Certo",
            textoAlternativaB: q.textoAlternativa2 || "Errado",
            textoAlternativaC: "",
            textoAlternativaD: "",
            textoAlternativaE: "",
            alternativaCorreta: correctAns,
            msgAltA: q.msgAlt1 || "Resposta incorreta.",
            msgAltB: q.msgAlt2 || "Resposta correta!",
            msgAltC: "",
            msgAltD: "",
            msgAltE: ""
          };
        }
        return q;
      });
    }
    this.currentSimulado = simulado;
    this.userAnswers = new Array(simulado.questoes.length).fill(null);
    this.questionResults = new Array(simulado.questoes.length).fill(null);
    // Initialize crossed-out state arrays for each question
    this.crossedOutAnswers = new Array(simulado.questoes.length).fill(null).map(() => []);
    this.selectedAnswers = new Array(simulado.questoes.length).fill(null);
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

      const hasMultipleChoices = !!(questao.textoAlternativaC || questao.textoAlternativaD || questao.textoAlternativaE);
      const optionsClass = hasMultipleChoices ? 'options vertical' : 'options';

      const alternatives = ['A', 'B', 'C', 'D', 'E'];
      let optionsHtml = '';

      alternatives.forEach(opt => {
        const text = questao[`textoAlternativa${opt}`];
        if (text) {
          optionsHtml += `
            <button class="option-btn" data-qidx="${idx}" data-opt="${opt}">
              <span class="scissors-icon" title="Rabiscar alternativa">✂️</span>
              <span class="option-text"><strong>${opt})</strong> ${text}</span>
            </button>
          `;
        }
      });

      let questionHtml = `
        <div class="question-text">
          <strong>${idx + 1}.</strong> ${questao.textoQuestao}
        </div>
        <div class="${optionsClass}">
          ${optionsHtml}
        </div>
      `;

      if (!isAnswered) {
        questionHtml += `
          <div class="question-action">
            <button class="submit-answer-btn" data-qidx="${idx}" ${this.selectedAnswers[idx] === null ? 'disabled' : ''}>
              Responder
            </button>
          </div>
        `;
      }

      if (isAnswered) {
        const feedbackMsg = questao[`msgAlt${userAnswer}`] || "Feedback não disponível.";
        const feedbackClass = isCorrect ? 'correct' : 'incorrect';
        const feedbackTitle = isCorrect ? '✅ Correto!' : '❌ Incorreto!';

        questionHtml += `
          <div class="feedback ${feedbackClass}">
            <strong>${feedbackTitle}</strong><br>
            ${feedbackMsg}
          </div>
        `;

        const correctAlternative = questao.alternativaCorreta;
        let correctMsg = questao[`msgAlt${correctAlternative}`] || "Explicação não disponível.";
        correctMsg = this.removePrefix(correctMsg);

        const alternativesList = ['A', 'B', 'C', 'D', 'E'];
        let explainAllHtml = '';
        alternativesList.forEach(opt => {
          const optText = questao[`textoAlternativa${opt}`];
          const optMsg = questao[`msgAlt${opt}`];
          if (optText) {
            const isOptCorrect = (opt === correctAlternative);
            const badge = isOptCorrect ? '✅ Correta' : '❌ Incorreta';
            explainAllHtml += `
              <div class="explain-all-item ${isOptCorrect ? 'correct' : 'incorrect'}">
                <strong>${opt}) ${optText}</strong><br>
                <span class="badge ${isOptCorrect ? 'badge-correct' : 'badge-incorrect'}">${badge}</span>
                <p class="explain-comment">${optMsg || "Sem comentários adicionais."}</p>
              </div>
            `;
          }
        });

        questionHtml += `
          <div class="explanation-actions">
            <button class="explain-btn" data-explain-idx="${idx}">💡 Explicar Alternativa Correta</button>
            <button class="explain-all-btn" data-explain-all-idx="${idx}">📚 Explicar Todas</button>
          </div>
          <div id="explanation-${idx}" class="explanation">
            <strong>📖 Explicação (Alternativa ${correctAlternative}):</strong><br>
            ${correctMsg}
          </div>
          <div id="explanation-all-${idx}" class="explanation-all">
            <strong>📚 Explicação de Todas as Alternativas:</strong>
            <div class="explain-all-list">
              ${explainAllHtml}
            </div>
          </div>
        `;
      }

      questionDiv.innerHTML = questionHtml;
      containerQuestoes.appendChild(questionDiv);

      const btns = questionDiv.querySelectorAll('.option-btn');
      btns.forEach(btn => {
        const optVal = btn.getAttribute('data-opt');

        // Configurar ícone da tesoura para rabiscar/tachado
        const scissors = btn.querySelector('.scissors-icon');
        if (scissors) {
          scissors.addEventListener('click', (e) => {
            e.stopPropagation();
            const crossedList = this.crossedOutAnswers[idx];
            const optIndex = crossedList.indexOf(optVal);
            if (optIndex > -1) {
              crossedList.splice(optIndex, 1);
            } else {
              crossedList.push(optVal);
            }
            btn.classList.toggle('crossed-out');
          });
        }

        // Restaurar estado tachado (crossed-out) do array persistente
        if (this.crossedOutAnswers[idx] && this.crossedOutAnswers[idx].includes(optVal)) {
          btn.classList.add('crossed-out');
        }

        if (isAnswered) {
          const userSelected = (userAnswer === optVal);
          const isThisCorrect = (optVal === questao.alternativaCorreta);

          if (userSelected) {
            if (isCorrect) {
              btn.classList.add('correct-answer');
            } else {
              btn.classList.add('wrong-answer');
            }
          } else if (isThisCorrect && !isCorrect) {
            btn.classList.add('correct-option-highlight');
          }

          btn.disabled = true;
        } else {
          // Destacar caso esteja selecionado temporariamente
          if (this.selectedAnswers[idx] === optVal) {
            btn.classList.add('selected');
          }

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectedAnswers[idx] = optVal;
            this.renderQuestoes(simulado);
          });
        }
      });

      // Configurar evento do botão de Responder
      if (!isAnswered) {
        const submitBtn = questionDiv.querySelector('.submit-answer-btn');
        if (submitBtn) {
          submitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedOpt = this.selectedAnswers[idx];
            if (selectedOpt !== null) {
              this.responderQuestao(idx, selectedOpt, simulado);
            }
          });
        }
      }

      if (isAnswered) {
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

        const explainAllBtn = questionDiv.querySelector('.explain-all-btn');
        if (explainAllBtn) {
          explainAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const explanationAllDiv = document.getElementById(`explanation-all-${idx}`);
            if (explanationAllDiv) {
              explanationAllDiv.classList.toggle('show');
            }
          });
        }
      }
    });

    // Calcular estatísticas
    const acertos = this.questionResults.filter(r => r === true).length;
    const erros = this.questionResults.filter(r => r === false).length;
    const emBranco = this.userAnswers.filter(a => a === null).length;

    // Calcular percentual de acerto
    const percentualAcerto = total > 0 ? Math.round((acertos / total) * 100) : 0;

    // Determinar classe do desempenho baseado no percentual de acerto
    let saldoClass = '';
    let saldoIcon = '';
    let saldoText = '';

    if (percentualAcerto >= 80) {
      saldoClass = 'great';
      saldoIcon = '🟢';
      saldoText = 'Desempenho Ótimo';
    } else if (percentualAcerto >= 70) {
      saldoClass = 'good';
      saldoIcon = '🟡';
      saldoText = 'Desempenho Bom';
    } else {
      saldoClass = 'bad';
      saldoIcon = '🔴';
      saldoText = 'Desempenho Ruim';
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
            <div class="value ${saldoClass}">${percentualAcerto}%</div>
            <div class="label">Desempenho</div>
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

    // Save statistics to database (caderno de erros)
    if (simulado && simulado.fileName) {
      db.saveQuestaoStats(simulado.fileName, questaoIndex, acertou).catch(err => {
        console.error('Erro ao salvar estatística da questão:', err);
      });
    }

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
    this.selectedAnswers = new Array(total).fill(null);
    this.crossedOutAnswers = new Array(total).fill(null).map(() => []);
    this.renderQuestoes(this.currentSimulado);
  }
}




// Instância global
const app = new SimuladorApp();