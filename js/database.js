// Database Manager - IndexedDB
class SimuladosDB {
  constructor() {
    this.dbName = 'SimuladosDB';
    this.dbVersion = 3;
    this.storeName = 'simulados';
    this.configStoreName = 'config';
    this.questoesStatsStoreName = 'questoesStats';
    this.db = null;
  }

  // Abrir conexão com o banco
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'fileName'
          });

          store.createIndex('assunto', 'assunto', { unique: false });
          store.createIndex('banca', 'banca', { unique: false });
          store.createIndex('dataCarregamento', 'dataCarregamento', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.configStoreName)) {
          db.createObjectStore(this.configStoreName, {
            keyPath: 'key'
          });
        }

        // Store for question statistics (caderno de erros)
        if (!db.objectStoreNames.contains(this.questoesStatsStoreName)) {
          const statsStore = db.createObjectStore(this.questoesStatsStoreName, {
            keyPath: 'id'
          });
          statsStore.createIndex('fileName', 'fileName', { unique: false });
          statsStore.createIndex('questaoIndex', 'questaoIndex', { unique: false });
          statsStore.createIndex('fileNameIndex', ['fileName', 'questaoIndex'], { unique: true });
        }
      };
    });
  }

  // Salvar ou atualizar simulado
  async save(simulado, fileName, fileLastModified) {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const simuladoComMeta = {
        ...simulado,
        fileName: fileName,
        dataCarregamento: new Date().toISOString(),
        dataArquivo: fileLastModified || new Date().toISOString()
      };

      const request = store.put(simuladoComMeta);

      request.onsuccess = () => resolve({ success: true, fileName });
      request.onerror = () => reject(request.error);
    });
  }

  // Verificar se um simulado já existe
  async exists(fileName) {
    await this.ensureConnection();

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(fileName);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }

  // Carregar todos os simulados
  async loadAll() {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const simulados = request.result || [];
        // Ordenar por data do arquivo (mais recente primeiro)
        simulados.sort((a, b) =>
          new Date(b.dataArquivo || b.dataCarregamento) - new Date(a.dataArquivo || a.dataCarregamento)
        );
        resolve(simulados);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Excluir um simulado
  async delete(fileName) {
    await this.ensureConnection();

    // Also delete associated question stats
    await this.deleteQuestoesStatsByFileName(fileName);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(fileName);

      request.onsuccess = () => resolve({ success: true, deleted: true });
      request.onerror = () => reject(request.error);
    });
  }

  // Limpar todos os simulados
  async clearAll() {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  // Obter estatísticas
  async getStats() {
    const simulados = await this.loadAll();
    const totalSize = new Blob([JSON.stringify(simulados)]).size;

    return {
      total: simulados.length,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      ultimaSincronizacao: simulados[0]?.dataCarregamento || null
    };
  }

  // Garantir que a conexão está aberta
  async ensureConnection() {
    if (!this.db) {
      await this.open();
    }
  }

  // Salvar configuração do prompt
  async savePromptConfig(config) {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.configStoreName], 'readwrite');
      const store = transaction.objectStore(this.configStoreName);
      const request = store.put(config);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  // Obter configuração do prompt
  async getPromptConfig() {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.configStoreName], 'readonly');
      const store = transaction.objectStore(this.configStoreName);
      const request = store.get('prompt_last_inputs');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== QUESTION STATISTICS METHODS (Caderno de Erros) =====

  // Save or update question answer statistics
  async saveQuestaoStats(fileName, questaoIndex, acertou) {
    await this.ensureConnection();

    const id = `${fileName}_q${questaoIndex}`;

    // First, try to get existing stats
    const existing = await this.getQuestaoStatsById(id);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readwrite');
      const store = transaction.objectStore(this.questoesStatsStoreName);

      let stats;
      if (existing) {
        stats = {
          ...existing,
          vezesRespondida: (existing.vezesRespondida || 0) + 1,
          vezesAcertou: (existing.vezesAcertou || 0) + (acertou ? 1 : 0),
          vezesErrou: (existing.vezesErrou || 0) + (acertou ? 0 : 1),
          ultimaResposta: new Date().toISOString()
        };
      } else {
        stats = {
          id: id,
          fileName: fileName,
          questaoIndex: questaoIndex,
          vezesRespondida: 1,
          vezesAcertou: acertou ? 1 : 0,
          vezesErrou: acertou ? 0 : 1,
          ultimaResposta: new Date().toISOString()
        };
      }

      const request = store.put(stats);

      request.onsuccess = () => resolve({ success: true, id });
      request.onerror = () => reject(request.error);
    });
  }

  // Get question stats by composite id
  async getQuestaoStatsById(id) {
    await this.ensureConnection();

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readonly');
      const store = transaction.objectStore(this.questoesStatsStoreName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  // Get all stats for a specific simulado (by fileName)
  async getQuestoesStatsByFileName(fileName) {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readonly');
      const store = transaction.objectStore(this.questoesStatsStoreName);
      const index = store.index('fileName');
      const request = index.getAll(fileName);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all question stats across all simulados
  async getAllQuestoesStats() {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readonly');
      const store = transaction.objectStore(this.questoesStatsStoreName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete question stats for a specific simulado
  async deleteQuestoesStatsByFileName(fileName) {
    await this.ensureConnection();

    const stats = await this.getQuestoesStatsByFileName(fileName);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readwrite');
      const store = transaction.objectStore(this.questoesStatsStoreName);

      let completed = 0;
      if (stats.length === 0) {
        resolve({ success: true, deleted: 0 });
        return;
      }

      stats.forEach((stat) => {
        const request = store.delete(stat.id);
        request.onsuccess = () => {
          completed++;
          if (completed === stats.length) {
            resolve({ success: true, deleted: completed });
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Clear all question stats
  async clearAllQuestoesStats() {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.questoesStatsStoreName], 'readwrite');
      const store = transaction.objectStore(this.questoesStatsStoreName);
      const request = store.clear();

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }
}

// Instância global
const db = new SimuladosDB();
