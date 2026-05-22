document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  const exportInfo = document.getElementById('exportInfo');
  const importFile = document.getElementById('importFile');
  const importInfo = document.getElementById('importInfo');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreConfirm = document.getElementById('restoreConfirm');
  const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
  const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');

  let pendingBackup = null;

  // ===== EXPORT =====

  exportBtn.addEventListener('click', async () => {
    exportInfo.className = 'info-msg pending';
    exportInfo.textContent = '⏳ Gerando backup...';
    try {
      const backupObj = await db.exportBackup();
      const json = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      // Formato: backup_YYYY-MM-DD_HH-MM-SS.json
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const filename = `backup_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      exportInfo.className = 'info-msg success';
      exportInfo.textContent = '✅ Backup gerado: ' + filename;
    } catch (err) {
      console.error(err);
      exportInfo.className = 'info-msg error';
      exportInfo.textContent = '❌ Erro ao gerar backup: ' + (err.message || err);
    }
  });

  // ===== IMPORT =====

  // When a file is selected, read it and show confirmation
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      restoreBtn.disabled = true;
      return;
    }

    importInfo.className = 'info-msg pending';
    importInfo.textContent = '⏳ Lendo arquivo...';
    restoreConfirm.style.display = 'none';

    // Read the file to validate it
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const backup = JSON.parse(text);

        // Validate backup structure
        if (!backup || !backup.stores) {
          throw new Error('Arquivo inválido: formato de backup não reconhecido.');
        }

        pendingBackup = backup;
        importInfo.className = 'info-msg success';
        importInfo.textContent =
          `✅ Arquivo válido! ${backup.stores.simulados?.length || 0} simulado(s), ` +
          `${backup.stores.questoesStats?.length || 0} estatística(s), ` +
          `${backup.stores.config?.length || 0} configuração(ões).`;

        restoreBtn.disabled = false;
      } catch (err) {
        pendingBackup = null;
        importInfo.className = 'info-msg error';
        importInfo.textContent = '❌ Erro ao ler arquivo: ' + (err.message || err);
        restoreBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  });

  // "Restaurar" button click shows confirmation dialog
  restoreBtn.addEventListener('click', () => {
    if (!pendingBackup) return;
    restoreConfirm.style.display = 'block';
  });

  // Confirm restore
  confirmRestoreBtn.addEventListener('click', async () => {
    if (!pendingBackup) return;

    restoreConfirm.style.display = 'none';
    restoreBtn.disabled = true;
    importInfo.className = 'info-msg pending';
    importInfo.textContent = '⏳ Restaurando backup...';

    try {
      const result = await db.importBackup(pendingBackup, { clearBefore: true });
      importInfo.className = 'info-msg success';
      importInfo.textContent =
        `✅ Restauração concluída com sucesso! ` +
        `${result.imported.simulados} simulado(s), ${result.imported.configs} configuração(ões), ` +
        `${result.imported.stats} estatística(s) restaurados.`;
      pendingBackup = null;
      importFile.value = '';
    } catch (err) {
      console.error(err);
      importInfo.className = 'info-msg error';
      importInfo.textContent = '❌ Erro ao restaurar backup: ' + (err.message || err);
      restoreBtn.disabled = false;
    }
  });

  // Cancel restore
  cancelRestoreBtn.addEventListener('click', () => {
    restoreConfirm.style.display = 'none';
  });
});
