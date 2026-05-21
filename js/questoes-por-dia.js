// Questões Respondidas por Dia - Main Logic
class QuestoesPorDia {
    constructor() {
        this.simulados = [];
        this.allStats = [];
        this.dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        this.dayNamesFull = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        this.periodFilter = document.getElementById('qpdPeriodFilter');
        this.simuladoFilter = document.getElementById('qpdSimuladoFilter');
        this.refreshBtn = document.getElementById('qpdRefreshBtn');

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.populateSimuladoFilter();
            this.applyFilters();
            this.bindEvents();
        } catch (err) {
            console.error('Erro ao inicializar Questões por Dia:', err);
            this.showError('Erro ao carregar dados: ' + err.message);
        }
    }

    async loadData() {
        this.simulados = await db.loadAll();
        this.allStats = await db.getAllQuestoesStats();
    }

    populateSimuladoFilter() {
        const select = this.simuladoFilter;
        // Keep the first option "Todos os simulados"
        select.innerHTML = '<option value="all">Todos os simulados</option>';

        this.simulados.forEach(sim => {
            const option = document.createElement('option');
            option.value = sim.fileName;
            option.textContent = sim.titulo || sim.assunto || sim.fileName;
            select.appendChild(option);
        });
    }

    bindEvents() {
        this.periodFilter.addEventListener('change', () => this.applyFilters());
        this.simuladoFilter.addEventListener('change', () => this.applyFilters());
        this.refreshBtn.addEventListener('click', async () => {
            await this.loadData();
            this.populateSimuladoFilter();
            this.applyFilters();
        });
    }

    applyFilters() {
        const periodValue = this.periodFilter.value;
        const simuladoValue = this.simuladoFilter.value;

        // Calculate date cutoff
        let cutoffDate = null;
        if (periodValue !== 'all') {
            const days = parseInt(periodValue, 10);
            cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            cutoffDate.setHours(0, 0, 0, 0);
        }

        // Filter stats
        let filteredStats = this.allStats;

        // Filter by simulado
        if (simuladoValue !== 'all') {
            filteredStats = filteredStats.filter(stat => stat.fileName === simuladoValue);
        }

        // Group by date (day)
        const dailyData = this.groupByDay(filteredStats, cutoffDate);

        // Update UI
        this.updateStatsCards(dailyData);
        this.renderChart(dailyData);
        this.renderTable(dailyData);
    }

    /**
     * Group question stats by day (YYYY-MM-DD)
     * Returns an array of { date, dateObj, total, acertos, erros } sorted by date ascending
     */
    groupByDay(stats, cutoffDate) {
        const dayMap = new Map();

        stats.forEach(stat => {
            const dateStr = stat.ultimaResposta;
            if (!dateStr) return;

            const date = new Date(dateStr);
            // Apply date filter
            if (cutoffDate && date < cutoffDate) return;

            // Normalize to date only (YYYY-MM-DD)
            const dayKey = date.toISOString().split('T')[0];

            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, {
                    date: dayKey,
                    dateObj: date,
                    total: 0,
                    acertos: 0,
                    erros: 0
                });
            }

            const dayEntry = dayMap.get(dayKey);
            dayEntry.total += (stat.vezesRespondida || 0);
            dayEntry.acertos += (stat.vezesAcertou || 0);
            dayEntry.erros += (stat.vezesErrou || 0);
        });

        // Convert to array and sort by date
        const result = Array.from(dayMap.values());
        result.sort((a, b) => a.date.localeCompare(b.date));

        return result;
    }

    /**
     * Update the summary stats cards
     */
    updateStatsCards(dailyData) {
        const totalAnswered = dailyData.reduce((sum, d) => sum + d.total, 0);
        const totalDays = dailyData.length;

        // Average per day
        const avgPerDay = totalDays > 0 ? (totalAnswered / totalDays).toFixed(1) : '0';

        // Best day (most questions answered)
        let bestDay = '-';
        let bestDayCount = 0;
        if (dailyData.length > 0) {
            const best = dailyData.reduce((max, d) => d.total > max.total ? d : max, dailyData[0]);
            bestDay = this.formatDayDate(best.date) + ` (${best.total})`;
            bestDayCount = best.total;
        }

        // Current streak of consecutive days
        let streak = this.calculateStreak(dailyData);

        // Animate values
        this.animateValue('qpdTotalAnswered', totalAnswered);
        document.getElementById('qpdAvgPerDay').textContent = avgPerDay;
        document.getElementById('qpdBestDay').textContent = bestDay;
        document.getElementById('qpdStreak').textContent = streak > 0 ? `${streak} ${streak === 1 ? 'dia' : 'dias'}` : '0 dias';
    }

    /**
     * Calculate the current streak of consecutive days with activity
     */
    calculateStreak(dailyData) {
        if (dailyData.length === 0) return 0;

        // Sort by date descending to check from today backwards
        const sorted = [...dailyData].sort((a, b) => b.date.localeCompare(a.date));

        // Check if today or yesterday has data (for "current" streak)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Only count streak if latest activity is today or yesterday
        const latestDate = sorted[0].date;
        if (latestDate !== todayStr && latestDate !== yesterdayStr) {
            return 0;
        }

        // Calculate consecutive days backwards from latest date
        let streak = 0;
        let checkDate = new Date(latestDate + 'T00:00:00');

        for (let i = 0; i < sorted.length; i++) {
            const expectedDate = checkDate.toISOString().split('T')[0];
            if (sorted[i].date === expectedDate) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (sorted[i].date < expectedDate) {
                // Gap in days - streak broken
                break;
            }
        }

        return streak;
    }

    /**
     * Render the bar chart
     */
    renderChart(dailyData) {
        const chartEl = document.getElementById('qpdChart');
        const loadingEl = document.getElementById('qpdLoading');
        const noDataEl = document.getElementById('qpdNoData');

        if (dailyData.length === 0) {
            loadingEl.style.display = 'none';
            chartEl.style.display = 'none';
            noDataEl.style.display = 'block';
            return;
        }

        loadingEl.style.display = 'none';
        chartEl.style.display = 'flex';
        noDataEl.style.display = 'none';

        // Find max value for scaling
        const maxTotal = Math.max(...dailyData.map(d => d.total), 1);

        chartEl.innerHTML = '';

        dailyData.forEach(dayData => {
            const wrapper = document.createElement('div');
            wrapper.className = 'qpd-bar-wrapper';

            const barHeight = Math.max((dayData.total / maxTotal) * 260, 4);

            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'qpd-bar-tooltip';
            const dayLabel = this.formatDayDate(dayData.date);
            tooltip.textContent = `${dayLabel}: ${dayData.total} ${dayData.total === 1 ? 'questão' : 'questões'}`;

            // Value label above bar
            const valueLabel = document.createElement('div');
            valueLabel.className = 'qpd-bar-value';
            valueLabel.textContent = dayData.total;

            // Bar
            const bar = document.createElement('div');
            bar.className = 'qpd-bar';
            bar.style.height = barHeight + 'px';

            // Date label below bar
            const dateLabel = document.createElement('div');
            dateLabel.className = 'qpd-bar-label';
            dateLabel.textContent = this.formatDayLabel(dayData.date);

            wrapper.appendChild(tooltip);
            wrapper.appendChild(valueLabel);
            wrapper.appendChild(bar);
            wrapper.appendChild(dateLabel);

            chartEl.appendChild(wrapper);
        });
    }

    /**
     * Render the detailed daily table
     */
    renderTable(dailyData) {
        const loadingEl = document.getElementById('qpdTableLoading');
        const wrapperEl = document.getElementById('qpdTableWrapper');
        const noDataEl = document.getElementById('qpdTableNoData');
        const tbody = document.getElementById('qpdTableBody');

        if (dailyData.length === 0) {
            loadingEl.style.display = 'none';
            wrapperEl.style.display = 'none';
            noDataEl.style.display = 'block';
            return;
        }

        loadingEl.style.display = 'none';
        wrapperEl.style.display = 'block';
        noDataEl.style.display = 'none';

        // Sort descending (most recent first) for the table
        const sorted = [...dailyData].sort((a, b) => b.date.localeCompare(a.date));

        tbody.innerHTML = '';

        sorted.forEach(dayData => {
            const tr = document.createElement('tr');

            const date = new Date(dayData.date + 'T12:00:00');
            const dayOfWeek = date.getDay();
            const dayName = this.dayNames[dayOfWeek];

            const total = dayData.total;
            const acertos = dayData.acertos;
            const erros = dayData.erros;
            const perc = total > 0 ? Math.round((acertos / total) * 100) : 0;

            tr.innerHTML = `
                <td>${this.formatDayDate(dayData.date)}</td>
                <td>${dayName}</td>
                <td class="qpd-total-questions">${total}</td>
                <td style="color: #28a745;">${acertos}</td>
                <td style="color: #dc3545;">${erros}</td>
                <td style="font-weight: 600; color: ${perc >= 70 ? '#28a745' : perc >= 50 ? '#f0ad4e' : '#dc3545'};">${perc}%</td>
            `;

            tbody.appendChild(tr);
        });
    }

    /**
     * Format a YYYY-MM-DD date to a readable Brazilian format
     */
    formatDayDate(dateStr) {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Format a YYYY-MM-DD date to a short label (DD/MM)
     */
    formatDayLabel(dateStr) {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit'
        });
    }

    /**
     * Animate a value counting up
     */
    animateValue(elementId, targetValue) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const currentText = el.textContent;
        const startValue = currentText !== '-' ? parseInt(currentText.replace(/\./g, ''), 10) || 0 : 0;

        if (startValue === targetValue) {
            el.textContent = targetValue.toLocaleString('pt-BR');
            return;
        }

        const duration = 800;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (targetValue - startValue) * eased);

            el.textContent = current.toLocaleString('pt-BR');

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                el.textContent = targetValue.toLocaleString('pt-BR');
            }
        };

        requestAnimationFrame(animate);
    }

    showError(message) {
        const chartContainer = document.querySelector('.qpd-chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="qpd-empty">
                    ❌ ${message}
                </div>
            `;
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new QuestoesPorDia();
});
