// Caderno de Erros - Logic
class CadernoErros {
    constructor() {
        this.simulados = []; // All loaded simulados
        this.questoesStats = {}; // Stats indexed by fileName
        this.currentOpenFileName = null; // Currently expanded simulado fileName
        this.contentEl = document.getElementById('ceContent');
        this.scrollTopBtn = document.getElementById('scrollTopBtn');
        this.questaoModal = null; // Reference to the question answer modal
        this.currentModalQuestao = null; // Currently displayed question data
        this.selectedAnswer = null; // Temporarily selected answer in modal
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderSimuladosList();

            // Scroll to top button logic
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    this.scrollTopBtn.classList.add('show');
                } else {
                    this.scrollTopBtn.classList.remove('show');
                }
            });
            this.scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

        } catch (err) {
            console.error('Erro ao carregar caderno de erros:', err);
            this.contentEl.innerHTML = `
        <div class="ce-empty">
          ❌ Erro ao carregar dados: ${err.message}
        </div>
      `;
        }
    }

    async loadData() {
        this.simulados = await db.loadAll();
        const allStats = await db.getAllQuestoesStats();

        // Index stats by fileName
        this.questoesStats = {};
        allStats.forEach(stat => {
            if (!this.questoesStats[stat.fileName]) {
                this.questoesStats[stat.fileName] = {};
            }
            this.questoesStats[stat.fileName][stat.questaoIndex] = stat;
        });
    }

    // Format date/time for display
    formatDateTime(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Truncate text for display
    truncateText(text, maxLen = 100) {
        if (!text) return '(sem texto)';
        // Remove HTML tags for display
        const plain = text.replace(/<[^>]*>/g, '');
        if (plain.length <= maxLen) return plain;
        return plain.substring(0, maxLen) + '...';
    }

    renderSimuladosList() {
        if (!this.contentEl) return;

        // Filter simulados that have at least one question answered
        const simuladosComStats = this.simulados.filter(s => {
            return s.fileName && this.questoesStats[s.fileName] && Object.keys(this.questoesStats[s.fileName]).length > 0;
        });

        if (simuladosComStats.length === 0) {
            this.contentEl.innerHTML = `
        <div class="ce-empty">
          📭 Nenhuma questão respondida ainda.<br>
          <span style="font-size: 0.9rem; color: #999;">
            Volte para os simulados e responda algumas questões para ver o caderno de erros.
          </span>
        </div>
      `;
            return;
        }

        let html = '<div class="ce-simulados-list">';

        simuladosComStats.forEach((simulado) => {
            const stats = this.questoesStats[simulado.fileName];
            const questaoIndices = Object.keys(stats).map(Number).sort((a, b) => a - b);

            // Compute overall stats for this simulado
            let totalVezes = 0;
            let totalAcertos = 0;
            let totalErros = 0;
            let ultimaData = '';

            questaoIndices.forEach(idx => {
                const s = stats[idx];
                if (s) {
                    totalVezes += s.vezesRespondida || 0;
                    totalAcertos += s.vezesAcertou || 0;
                    totalErros += s.vezesErrou || 0;
                    if (s.ultimaResposta && (!ultimaData || s.ultimaResposta > ultimaData)) {
                        ultimaData = s.ultimaResposta;
                    }
                }
            });

            const questoesCount = questaoIndices.length;
            const isExpanded = this.currentOpenFileName === simulado.fileName;

            html += `
        <div class="ce-simulado-card ${isExpanded ? 'expanded' : ''}" data-filename="${simulado.fileName}">
          <div class="ce-simulado-header">
            <h3>📌 ${simulado.titulo || 'Simulado'}</h3>
            <div class="ce-simulado-meta">
              <span>🏷️ ${simulado.banca || 'N/I'}</span>
              <span>📝 ${questoesCount} ${questoesCount === 1 ? 'questão respondida' : 'questões respondidas'}</span>
              <span>🔄 ${totalVezes} ${totalVezes === 1 ? 'resposta' : 'respostas'}</span>
              <span>✅ ${totalAcertos} ${totalAcertos === 1 ? 'acerto' : 'acertos'}</span>
              <span>❌ ${totalErros} ${totalErros === 1 ? 'erro' : 'erros'}</span>
              <span>🕐 Última: ${this.formatDateTime(ultimaData)}</span>
            </div>
          </div>
          <div class="ce-questoes-container ${isExpanded ? 'open' : ''}" id="ce-questoes-${this.sanitizeId(simulado.fileName)}">
            ${isExpanded ? '' : '<!-- Questions will be loaded here when expanded -->'}
          </div>
        </div>
      `;
        });

        html += '</div>';
        this.contentEl.innerHTML = html;

        // Add click events to toggle questions (click on header area)
        document.querySelectorAll('.ce-simulado-header').forEach(header => {
            header.addEventListener('click', async (e) => {
                // Don't toggle if clicking on a questao item or modal elements
                if (e.target.closest('.ce-questao-item') || e.target.closest('.ce-question-modal')) return;

                const card = header.closest('.ce-simulado-card');
                const fileName = card.dataset.filename;
                const containerId = `ce-questoes-${this.sanitizeId(fileName)}`;
                const container = document.getElementById(containerId);

                if (!container) return;

                if (container.classList.contains('open')) {
                    container.classList.remove('open');
                    card.classList.remove('expanded');
                    container.innerHTML = '';
                    this.currentOpenFileName = null;
                } else {
                    // Close all other open containers first
                    document.querySelectorAll('.ce-simulado-card.expanded').forEach(c => {
                        c.classList.remove('expanded');
                        const cId = `ce-questoes-${this.sanitizeId(c.dataset.filename)}`;
                        const cContainer = document.getElementById(cId);
                        if (cContainer) {
                            cContainer.classList.remove('open');
                            cContainer.innerHTML = '';
                        }
                    });
                    container.classList.add('open');
                    card.classList.add('expanded');
                    this.currentOpenFileName = fileName;
                    await this.renderQuestoesList(fileName, container);
                }
            });
        });

        // If there was an expanded simulado, re-render its questions
        if (this.currentOpenFileName) {
            const container = document.getElementById(`ce-questoes-${this.sanitizeId(this.currentOpenFileName)}`);
            if (container && container.classList.contains('open')) {
                this.renderQuestoesList(this.currentOpenFileName, container);
            }
        }
    }

    async refreshCurrentList() {
        // Re-query database
        await this.loadData();
        this.renderSimuladosList();
    }

    async renderQuestoesList(fileName, container) {
        const simulado = this.simulados.find(s => s.fileName === fileName);
        if (!simulado || !simulado.questoes) {
            container.innerHTML = '<div class="ce-empty">Simulado não encontrado.</div>';
            return;
        }

        const stats = this.questoesStats[fileName] || {};

        // Build array of question indices with their error count for sorting
        const allIndices = simulado.questoes.map((_, idx) => idx);

        // Sort: answered questions first (by most errors descending), then unanswered ones
        const sortedIndices = [...allIndices].sort((a, b) => {
            const statA = stats[a];
            const statB = stats[b];
            const hasA = !!statA;
            const hasB = !!statB;

            // Answered questions come before unanswered
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;

            // Both answered: sort by errors descending (most errors first)
            if (hasA && hasB) {
                const errA = statA.vezesErrou || 0;
                const errB = statB.vezesErrou || 0;
                if (errB !== errA) return errB - errA;
                // If same errors, sort by acertos ascending (worse performance first)
                const acertA = statA.vezesAcertou || 0;
                const acertB = statB.vezesAcertou || 0;
                return acertA - acertB;
            }

            // Both unanswered: keep original order
            return a - b;
        });

        let html = '<div style="margin-top: 8px;">';

        sortedIndices.forEach((idx) => {
            const questao = simulado.questoes[idx];
            const stat = stats[idx];
            const hasStat = !!stat;

            const vezesRespondida = stat ? stat.vezesRespondida : 0;
            const vezesAcertou = stat ? stat.vezesAcertou : 0;
            const vezesErrou = stat ? stat.vezesErrou : 0;
            const ultimaResposta = stat ? stat.ultimaResposta : null;

            // Determine background color based on rule:
            // Red if acertos <= erros, Green if acertos > erros
            let bgClass = '';
            if (hasStat) {
                if (vezesAcertou > vezesErrou) {
                    bgClass = 'bg-green';
                } else {
                    bgClass = 'bg-red';
                }
            }

            // Stats badge if answered at least once
            const statsHtml = hasStat ? `
        <div class="ce-questao-stats">
          <span class="stat-badge respondida">🔄 ${vezesRespondida}x</span>
          <span class="stat-badge acertos">✅ ${vezesAcertou}</span>
          <span class="stat-badge erros">❌ ${vezesErrou}</span>
          <span style="color: #888; font-size: 0.75rem; display: flex; align-items: center;">
            🕐 ${this.formatDateTime(ultimaResposta)}
          </span>
        </div>
      ` : '';

            html += `
        <div class="ce-questao-item ${bgClass}" data-filename="${fileName}" data-questao-index="${idx}">
          <div class="ce-questao-num">#${idx + 1}</div>
          <div class="ce-questao-texto">${this.truncateText(questao.textoQuestao, 120)}</div>
          ${statsHtml}
        </div>
      `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Add click event to each questao item to open answer modal
        container.querySelectorAll('.ce-questao-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const fName = item.dataset.filename;
                const qIdx = parseInt(item.dataset.questaoIndex, 10);
                this.abrirQuestaoModal(fName, qIdx);
            });
        });
    }

    abrirQuestaoModal(fileName, questaoIndex) {
        const simulado = this.simulados.find(s => s.fileName === fileName);
        if (!simulado || !simulado.questoes || !simulado.questoes[questaoIndex]) return;

        const questao = simulado.questoes[questaoIndex];
        this.currentModalQuestao = { fileName, questaoIndex, questao };
        this.selectedAnswer = null;

        // If a modal already exists, remove it
        if (this.questaoModal) {
            this.questaoModal.remove();
            this.questaoModal = null;
        }

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'ce-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'ce-question-modal';

        const hasMultipleChoices = !!(questao.textoAlternativaC || questao.textoAlternativaD || questao.textoAlternativaE);
        const optionsClass = hasMultipleChoices ? 'options vertical' : 'options';

        const alternatives = ['A', 'B', 'C', 'D', 'E'];
        let optionsHtml = '';
        alternatives.forEach(opt => {
            const text = questao[`textoAlternativa${opt}`];
            if (text) {
                optionsHtml += `
            <button class="option-btn ce-modal-option" data-opt="${opt}">
              <span class="option-text"><strong>${opt})</strong> ${text}</span>
            </button>
          `;
            }
        });

        modal.innerHTML = `
        <div class="ce-question-modal-header">
          <div class="ce-modal-title">
            <h2>${simulado.titulo || 'Simulado'} — Questão ${questaoIndex + 1}</h2>
            <span class="ce-modal-simulado-name">📁 ${fileName}</span>
          </div>
          <button class="ce-modal-close-btn">✕</button>
        </div>
        <div class="ce-question-modal-body">
          <div class="question-text">
            <strong>${questaoIndex + 1}.</strong> ${questao.textoQuestao}
          </div>
          <div class="${optionsClass} ce-modal-options">
            ${optionsHtml}
          </div>
          <div class="ce-modal-action">
            <button class="ce-modal-responder-btn" disabled>Responder</button>
          </div>
          <div class="ce-modal-feedback"></div>
          <div class="ce-modal-explanation" style="display: none;"></div>
        </div>
      `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
        this.questaoModal = modalOverlay;

        // Close button
        const closeBtn = modal.querySelector('.ce-modal-close-btn');
        closeBtn.addEventListener('click', () => {
            this.fecharQuestaoModal();
        });

        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.fecharQuestaoModal();
            }
        });

        // Option buttons
        const optionBtns = modal.querySelectorAll('.ce-modal-option');
        optionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Deselect all
                optionBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedAnswer = btn.dataset.opt;
                // Enable responder button
                const responderBtn = modal.querySelector('.ce-modal-responder-btn');
                responderBtn.disabled = false;
            });
        });

        // Responder button
        const responderBtn = modal.querySelector('.ce-modal-responder-btn');
        responderBtn.addEventListener('click', () => {
            if (this.selectedAnswer) {
                this.responderQuestaoModal(this.selectedAnswer);
            }
        });
    }

    fecharQuestaoModal() {
        if (this.questaoModal) {
            this.questaoModal.remove();
            this.questaoModal = null;
        }
        this.currentModalQuestao = null;
        this.selectedAnswer = null;
    }

    responderQuestaoModal(resposta) {
        if (!this.currentModalQuestao) return;

        const { fileName, questaoIndex, questao } = this.currentModalQuestao;
        const correta = questao.alternativaCorreta;
        const acertou = (resposta === correta);

        // Save stats to database
        db.saveQuestaoStats(fileName, questaoIndex, acertou).then(() => {
            // Show feedback in the modal
            const feedbackDiv = this.questaoModal.querySelector('.ce-modal-feedback');
            const explainDiv = this.questaoModal.querySelector('.ce-modal-explanation');
            const responderBtn = this.questaoModal.querySelector('.ce-modal-responder-btn');
            const optionBtns = this.questaoModal.querySelectorAll('.ce-modal-option');

            // Disable all option buttons and responder
            optionBtns.forEach(b => b.style.pointerEvents = 'none');
            if (responderBtn) responderBtn.style.display = 'none';

            // Highlight correct/wrong
            optionBtns.forEach(btn => {
                const opt = btn.dataset.opt;
                if (opt === correta) {
                    btn.classList.add('correct-answer');
                } else if (opt === resposta && !acertou) {
                    btn.classList.add('wrong-answer');
                }
            });

            // Show feedback
            const feedbackMsg = questao[`msgAlt${resposta}`] || "Feedback não disponível.";
            const feedbackClass = acertou ? 'correct' : 'incorrect';
            const feedbackTitle = acertou ? '✅ Correto!' : '❌ Incorreto!';
            feedbackDiv.innerHTML = `
            <div class="feedback ${feedbackClass}">
              <strong>${feedbackTitle}</strong><br>
              ${feedbackMsg}
            </div>
          `;

            // Show explanation of correct answer
            const correctAlternative = questao.alternativaCorreta;
            let correctMsg = questao[`msgAlt${correctAlternative}`] || "Explicação não disponível.";
            // Remove prefix if any
            const prefixes = [
                "Você acertou. ", "Você acertou! ", "Resposta correta. ", "Resposta correta! ",
                "Correto! ", "✅ Correto! ", "Você acertou: "
            ];
            for (const prefix of prefixes) {
                if (correctMsg.startsWith(prefix)) {
                    correctMsg = correctMsg.substring(prefix.length);
                    break;
                }
            }

            explainDiv.style.display = 'block';
            explainDiv.innerHTML = `
            <div class="explanation show">
              <strong>📖 Explicação (Alternativa ${correctAlternative}):</strong><br>
              ${correctMsg}
            </div>
          `;

            // Add a "Fechar" button to close modal and refresh
            const closeRefreshBtn = document.createElement('button');
            closeRefreshBtn.className = 'ce-modal-refresh-btn';
            closeRefreshBtn.textContent = '✓ Fechar e atualizar lista';
            closeRefreshBtn.addEventListener('click', () => {
                this.fecharQuestaoModal();
                // Refresh the list to update stats
                this.refreshCurrentList();
            });
            feedbackDiv.appendChild(closeRefreshBtn);
        }).catch(err => {
            console.error('Erro ao salvar estatística:', err);
        });
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new CadernoErros();
});
