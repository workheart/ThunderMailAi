document.addEventListener('DOMContentLoaded', async () => {
    const aiService = document.getElementById('aiService');
    const ollamaSettings = document.getElementById('ollamaSettings');
    const openaiSettings = document.getElementById('openaiSettings');
    const sourceTree = document.getElementById('sourceTree');
    const targetTree = document.getElementById('targetTree');
    const summaryFolder = document.getElementById('summaryFolder');
    const unreadOnly = document.getElementById('unreadOnly');
    const startProcessing = document.getElementById('startProcessing');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // Lade gespeicherte Einstellungen
    const settings = await browser.storage.local.get([
        'aiService',
        'ollamaEndpoint',
        'ollamaModel',
        'openaiKey',
        'openaiModel',
        'sourceFolders',
        'targetFolders',
        'summaryFolderId',
        'processingPrompt',
        'unreadOnly'
    ]);

    // Setze gespeicherte Werte
    if (settings.aiService) {
        aiService.value = settings.aiService;
        toggleServiceSettings(settings.aiService);
    }
    if (settings.ollamaEndpoint) document.getElementById('ollamaEndpoint').value = settings.ollamaEndpoint;
    if (settings.ollamaModel) document.getElementById('ollamaModel').value = settings.ollamaModel;
    if (settings.openaiKey) document.getElementById('openaiKey').value = settings.openaiKey;
    if (settings.openaiModel) document.getElementById('openaiModel').value = settings.openaiModel;
    if (settings.processingPrompt) document.getElementById('processingPrompt').value = settings.processingPrompt;
    if (typeof settings.unreadOnly !== 'undefined') unreadOnly.checked = settings.unreadOnly;

    // Service-Einstellungen Toggle
    aiService.addEventListener('change', () => {
        toggleServiceSettings(aiService.value);
        saveSettings();
    });

    function toggleServiceSettings(service) {
        if (service === 'ollama') {
            ollamaSettings.style.display = 'block';
            openaiSettings.style.display = 'none';
        } else {
            ollamaSettings.style.display = 'none';
            openaiSettings.style.display = 'block';
        }
    }

    // Lade Ordnerliste
    const accounts = await browser.accounts.list();
    for (const account of accounts) {
        // Erstelle Container für Quellordner
        const sourceAccountDiv = document.createElement('div');
        sourceAccountDiv.className = 'account-container';
        const sourceAccountLabel = document.createElement('h3');
        sourceAccountLabel.textContent = account.name;
        sourceAccountDiv.appendChild(sourceAccountLabel);
        sourceTree.appendChild(sourceAccountDiv);

        // Erstelle Container für Zielordner
        const targetAccountDiv = document.createElement('div');
        targetAccountDiv.className = 'account-container';
        const targetAccountLabel = document.createElement('h3');
        targetAccountLabel.textContent = account.name;
        targetAccountDiv.appendChild(targetAccountLabel);
        targetTree.appendChild(targetAccountDiv);

        const folders = await browser.folders.getSubFolders(account);
        
        // Rendere Ordner für beide Bäume
        renderFolders(folders, sourceAccountDiv, settings.sourceFolders || [], account, 'source');
        renderFolders(folders, targetAccountDiv, settings.targetFolders || [], account, 'target');
        
        // Fülle Summary Folder Dropdown
        await addFoldersToDropdown(folders, account, summaryFolder, settings.summaryFolderId);
    }

    // Füge Ordner rekursiv zum Dropdown hinzu
    async function addFoldersToDropdown(folders, account, dropdown, selectedFolderId) {
        for (const folder of folders) {
            const option = document.createElement('option');
            option.value = folder.accountId + "|" + folder.path;
            option.textContent = `${account.name} - ${folder.path}`;
            if (selectedFolderId === option.value) {
                option.selected = true;
            }
            dropdown.appendChild(option);

            if (folder.subFolders && folder.subFolders.length > 0) {
                await addFoldersToDropdown(folder.subFolders, account, dropdown, selectedFolderId);
            }
        }
    }

    // Ordner-Baum rendern
    function renderFolders(folders, container, selectedFolders = [], account, type) {
        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            const folderValue = account.id + "|" + folder.path;
            checkbox.value = folderValue;
            checkbox.id = `folder-${type}-${folderValue}`;
            checkbox.checked = selectedFolders.includes(folderValue);
            checkbox.dataset.folderType = type;
            checkbox.addEventListener('change', saveSettings);
            
            const label = document.createElement('label');
            label.htmlFor = `folder-${type}-${folderValue}`;
            label.textContent = folder.name;
            
            // Füge Tooltip mit vollständigem Pfad hinzu
            label.title = `${account.name} - ${folder.path}`;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
            
            if (folder.subFolders && folder.subFolders.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'subfolder';
                renderFolders(folder.subFolders, subContainer, selectedFolders, account, type);
                container.appendChild(subContainer);
            }
        });
    }

    // Einstellungen speichern
    async function saveSettings() {
        const sourceFolders = Array.from(document.querySelectorAll('.folder-item input[data-folder-type="source"]:checked'))
            .map(cb => cb.value);
        
        const targetFolders = Array.from(document.querySelectorAll('.folder-item input[data-folder-type="target"]:checked'))
            .map(cb => cb.value);

        await browser.storage.local.set({
            aiService: aiService.value,
            ollamaEndpoint: document.getElementById('ollamaEndpoint').value,
            ollamaModel: document.getElementById('ollamaModel').value,
            openaiKey: document.getElementById('openaiKey').value,
            openaiModel: document.getElementById('openaiModel').value,
            sourceFolders,
            targetFolders,
            summaryFolderId: summaryFolder.value,
            processingPrompt: document.getElementById('processingPrompt').value,
            unreadOnly: unreadOnly.checked
        });
    }

    // Speichern bei Änderungen
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.addEventListener('change', saveSettings);
    });

    // Verarbeitung starten
    startProcessing.addEventListener('click', async () => {
        startProcessing.disabled = true;
        progress.style.display = 'block';

        try {
            const response = await browser.runtime.sendMessage({
                action: 'startBatchProcessing'
            });

            if (response.success) {
                progressText.textContent = 'Verarbeitung erfolgreich abgeschlossen!';
                progressBar.value = 100;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            progressText.textContent = `Fehler: ${error.message}`;
        } finally {
            startProcessing.disabled = false;
        }
    });
}); 