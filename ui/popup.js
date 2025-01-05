document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summaryElement = document.getElementById('summary');
    const aiService = document.getElementById('aiService');
    const apiEndpoint = document.getElementById('apiEndpoint');

    // Lade gespeicherte Einstellungen
    browser.storage.local.get(['aiService', 'apiEndpoint']).then((result) => {
        if (result.aiService) aiService.value = result.aiService;
        if (result.apiEndpoint) apiEndpoint.value = result.apiEndpoint;
    });

    // Speichere Einstellungen bei Änderung
    aiService.addEventListener('change', () => {
        browser.storage.local.set({ aiService: aiService.value });
        if (aiService.value === 'ollama') {
            apiEndpoint.value = 'http://localhost:11434/api/generate';
        }
    });

    apiEndpoint.addEventListener('change', () => {
        browser.storage.local.set({ apiEndpoint: apiEndpoint.value });
    });

    // Hole aktuelle E-Mail
    async function getCurrentMessage() {
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        const currentTab = tabs[0];
        if (!currentTab) return null;

        const message = await browser.messageDisplay.getDisplayedMessage(currentTab.id);
        return message;
    }

    // Analysiere E-Mail
    analyzeBtn.addEventListener('click', async () => {
        try {
            const message = await getCurrentMessage();
            if (!message) {
                summaryElement.textContent = 'Keine E-Mail ausgewählt';
                return;
            }

            summaryElement.textContent = 'Analysiere E-Mail...';
            
            // Sende Nachricht an background script
            const response = await browser.runtime.sendMessage({
                action: 'analyzeEmail',
                message: message,
                service: aiService.value,
                endpoint: apiEndpoint.value
            });

            summaryElement.textContent = response.result;
        } catch (error) {
            summaryElement.textContent = `Fehler: ${error.message}`;
        }
    });

    // Zusammenfassen
    summarizeBtn.addEventListener('click', async () => {
        try {
            const message = await getCurrentMessage();
            if (!message) {
                summaryElement.textContent = 'Keine E-Mail ausgewählt';
                return;
            }

            summaryElement.textContent = 'Erstelle Zusammenfassung...';
            
            const response = await browser.runtime.sendMessage({
                action: 'summarizeEmail',
                message: message,
                service: aiService.value,
                endpoint: apiEndpoint.value
            });

            summaryElement.textContent = response.result;
        } catch (error) {
            summaryElement.textContent = `Fehler: ${error.message}`;
        }
    });
}); 