// Database Manager - IndexedDB
class SimuladosDB {
  constructor() {
    this.dbName = 'SimuladosDB';
    this.dbVersion = 1;
    this.storeName = 'simulados';
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
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(fileName);
      
      request.onsuccess = () => resolve({ success: true });
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
}

// Instância global
const db = new SimuladosDB();