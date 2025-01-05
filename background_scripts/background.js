// Ollama API Handler
async function callOllama(prompt, endpoint, model = "llama2") {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
}

// E-Mail Text extrahieren
async function getMessageContent(messageId) {
    try {
        console.log('Hole E-Mail Inhalt für ID:', messageId);
        const message = await browser.messages.getFull(messageId);
        let content = '';

        console.log('Message Parts:', message.parts ? message.parts.length : 'keine parts');

        // Text aus HTML extrahieren
        if (message.parts && message.parts.length > 0) {
            for (const part of message.parts) {
                console.log('Verarbeite Part:', part.contentType);
                if (part.contentType === 'text/plain') {
                    content += part.body + '\n';
                    console.log('Plain Text gefunden');
                } else if (part.contentType === 'text/html') {
                    // Einfache HTML zu Text Konvertierung
                    const textContent = part.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                    content += textContent + '\n';
                    console.log('HTML Text konvertiert');
                }
            }
        } else if (message.body) {
            // Fallback: Direkter Body
            console.log('Verwende direkten Body');
            content = message.body;
        }

        content = content.trim();
        console.log('Extrahierter Inhalt Länge:', content.length);
        console.log('Erster Teil des Inhalts:', content.substring(0, 100));
        
        return content || 'Keine Inhalte verfügbar';
    } catch (error) {
        console.error('Fehler beim Extrahieren des E-Mail Inhalts:', error);
        return 'Fehler beim Laden des E-Mail Inhalts';
    }
}

// Verarbeitete E-Mails speichern
async function saveProcessedEmails(processedIds) {
    await browser.storage.local.set({ processedEmailIds: processedIds });
}

// Bereits verarbeitete E-Mails laden
async function getProcessedEmails() {
    const result = await browser.storage.local.get('processedEmailIds');
    return result.processedEmailIds || [];
}

// Parse die strukturierte Antwort von Ollama
function parseAIResponse(response) {
    const result = {
        summary: '',
        targetFolder: ''
    };

    // Entferne alles vor ---START--- und nach ---ENDE---
    const contentMatch = response.match(/---START---([\s\S]*?)---ENDE---/);
    if (!contentMatch) {
        console.log('Kein START/ENDE Block gefunden in:', response);
        return result;
    }
    
    const content = contentMatch[1];

    // Extrahiere die Abschnitte mit #-Überschriften
    const summaryMatch = content.match(/#ZUSAMMENFASSUNG\s*\n([^\n#]+)/);
    const folderMatch = content.match(/#ORDNER\s*\n([^\n#]+)/);

    if (summaryMatch) {
        result.summary = summaryMatch[1].trim();
        console.log('Gefundene Zusammenfassung:', result.summary);
    } else {
        console.log('Keine Zusammenfassung gefunden');
    }

    if (folderMatch) {
        result.targetFolder = folderMatch[1].trim();
        console.log('Gefundener Zielordner:', result.targetFolder);
    } else {
        console.log('Kein Zielordner gefunden');
    }

    return result;
}

// Formatiere die Ordnerstruktur für den Prompt
function formatFolderStructure(folders, accounts) {
    let structure = [];
    
    // Erstelle ein Mapping von Account-IDs zu E-Mail-Adressen
    const accountMapping = {};
    for (const account of accounts) {
        accountMapping[account.id] = account.name;  // name enthält die E-Mail-Adresse
    }
    
    // Gruppiere Ordner nach Account
    const foldersByAccount = {};
    for (const folderValue of folders) {
        const { accountId, path } = splitFolderValue(folderValue);
        if (!foldersByAccount[accountId]) {
            foldersByAccount[accountId] = [];
        }
        foldersByAccount[accountId].push({
            path: path,
            fullValue: `${accountMapping[accountId]} - ${path}`  // Speichere den vollständigen Wert
        });
    }

    // Formatiere jeden Account mit seinen Ordnern
    for (const accountId in foldersByAccount) {
        if (accountMapping[accountId]) {
            structure.push(`Postfach: ${accountMapping[accountId]}`);
            foldersByAccount[accountId].forEach(folder => {
                structure.push(`  └─ ${folder.fullValue}`);
            });
            structure.push('');  // Leerzeile zwischen Accounts
        }
    }

    return structure.join('\n');
}

// Zusammenfassungs-E-Mail erstellen
async function createSummaryEmail(summaries, settings, errors = []) {
    const today = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    const subject = `E-Mail Verarbeitungs-Report vom ${today} ${time}`;
    let body = `Verarbeitungsbericht:\n\n`;

    if (summaries.length > 0) {
        body += `Erfolgreich verarbeitete E-Mails:\n\n`;
        for (const summary of summaries) {
            body += `Von: ${summary.from}\n`;
            body += `Betreff: ${summary.subject}\n`;
            body += `Zusammenfassung: ${summary.parsedResult.summary}\n`;
            body += `Verschoben nach: ${summary.movedTo}\n\n`;
            body += `-----------------\n\n`;
        }
    } else {
        body += `Keine E-Mails wurden verarbeitet.\n\n`;
    }

    if (errors.length > 0) {
        body += `Fehler während der Verarbeitung:\n\n`;
        for (const error of errors) {
            body += `- ${error}\n`;
        }
        body += `\n-----------------\n\n`;
    }

    try {
        // Erstelle eine neue E-Mail
        await browser.compose.beginNew({
            to: [],  // Leer, da wir die E-Mail direkt in den Ordner speichern
            subject: subject,
            body: body,
            plainTextBody: true,
            type: 'draft'  // Erstelle als Entwurf
        });

        // Hole die gerade erstellte E-Mail (sollte die letzte im Drafts-Ordner sein)
        const draftsFolder = await browser.folders.getDraftsFolder();
        const drafts = await browser.messages.list(draftsFolder);
        const lastDraft = drafts.messages[drafts.messages.length - 1];

        if (lastDraft) {
            // Verschiebe den Entwurf in den Zusammenfassungsordner
            await browser.messages.move([lastDraft.id], settings.summaryFolderId);
            console.log('Zusammenfassungs-E-Mail erstellt und verschoben');
        } else {
            throw new Error('Konnte erstellte E-Mail nicht finden');
        }
    } catch (error) {
        console.error('Fehler beim Erstellen der Zusammenfassungs-E-Mail:', error);
        throw error;
    }
}

// Extrahiere Account-ID und Pfad aus dem kombinierten Wert
function splitFolderValue(folderValue) {
    const [accountId, path] = folderValue.split('|');
    return { accountId, path };
}

// Finde einen Ordner anhand des Pfads
async function findFolderByPath(account, targetPath) {
    // Normalisiere den Pfad (entferne doppelte Slashes, führende/nachfolgende Slashes)
    targetPath = targetPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    
    // Hole alle Ordner des Accounts
    const folders = await browser.folders.getSubFolders(account);
    
    // Rekursive Hilfsfunktion zum Durchsuchen der Ordner
    function searchInFolders(folders, remainingPath) {
        for (const folder of folders) {
            // Normalisiere den Ordnerpfad
            const normalizedFolderPath = folder.path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
            
            if (normalizedFolderPath === targetPath) {
                return folder;
            }
            
            if (folder.subFolders && folder.subFolders.length > 0) {
                const found = searchInFolders(folder.subFolders, remainingPath);
                if (found) return found;
            }
        }
        return null;
    }
    
    return searchInFolders(folders, targetPath);
}

// Hilfsfunktion zum Abrufen eines Ordners aus dem kombinierten Wert
async function getFolderFromValue(folderValue) {
    const { accountId, path } = splitFolderValue(folderValue);
    try {
        const account = await browser.accounts.get(accountId);
        if (!account) return null;
        
        return await findFolderByPath(account, path);
    } catch (error) {
        console.error('Fehler beim Abrufen des Ordners:', error);
        return null;
    }
}

// Extrahiere Zielordner aus AI-Antwort
function extractTargetFolder(aiResponse, availableFolders) {
    const parsedResult = parseAIResponse(aiResponse);
    console.log('Verfügbare Ordner:', availableFolders);
    
    if (!parsedResult.targetFolder) {
        console.log('Kein Zielordner in der AI-Antwort gefunden');
        return null;
    }

    // Normalisiere den gefundenen Ordner
    const normalizedTarget = parsedResult.targetFolder.trim();
    console.log('Normalisierter Zielordner:', normalizedTarget);

    // Suche den passenden Ordner in den verfügbaren Ordnern
    for (const folder of availableFolders) {
        const { accountId, path } = splitFolderValue(folder);
        
        // Erstelle den vollständigen Pfad für den Vergleich
        const fullPath = `${accountId}|${path}`;
        console.log('Vergleiche mit:', fullPath);

        // Exakter Vergleich des normalisierten Pfads
        if (normalizedTarget === fullPath) {
            console.log('Exakter Match gefunden:', folder);
            return folder;
        }
    }

    // Wenn kein exakter Match gefunden wurde, versuche einen flexibleren Vergleich
    for (const folder of availableFolders) {
        const { accountId, path } = splitFolderValue(folder);
        
        // Extrahiere E-Mail und Pfad aus der AI-Antwort
        const match = normalizedTarget.match(/([^@\s]+@[^@\s]+\.[^@\s]+)\s*-\s*(\/.+)/);
        if (match) {
            const [_, email, targetPath] = match;
            console.log('Flexibler Vergleich:', { email, targetPath, accountId, path });

            // Vergleiche Pfade und prüfe, ob die Account-ID die E-Mail enthält
            if (path === targetPath && (accountId.includes(email) || email.includes(accountId))) {
                console.log('Flexibler Match gefunden:', folder);
                return folder;
            }
        }
    }
    
    console.log('Kein passender Ordner in den verfügbaren Ordnern gefunden');
    return null;
}

// Validiere und erstelle den Prompt
function buildPrompt(template, content, folders) {
    // Prüfe ob die erforderlichen Platzhalter vorhanden sind
    if (!template.includes('{email_content}') || !template.includes('{available_folders}')) {
        throw new Error('Prompt-Template enthält nicht alle erforderlichen Platzhalter');
    }

    // Prüfe ob die erforderlichen Inhalte vorhanden sind
    if (!content || content.trim() === '') {
        throw new Error('Kein E-Mail-Inhalt verfügbar');
    }

    if (!folders || folders.trim() === '') {
        throw new Error('Keine Ordnerstruktur verfügbar');
    }

    // Erstelle den Prompt
    const prompt = template
        .replace('{available_folders}', folders)
        .replace('{email_content}', content);

    // Validiere den fertigen Prompt
    if (prompt.includes('{email_content}') || prompt.includes('{available_folders}')) {
        throw new Error('Platzhalter wurden nicht korrekt ersetzt');
    }

    return prompt;
}

// Batch-Verarbeitung
async function processBatch() {
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

    const processedIds = await getProcessedEmails();
    const summaries = [];
    const errors = [];

    // Hole alle Accounts für die Ordnerstruktur
    const accounts = await browser.accounts.list();

    // Erstelle formatierte Ordnerstruktur für den Prompt
    const formattedFolders = formatFolderStructure(settings.targetFolders || [], accounts);

    // Erstelle Liste der verfügbaren Zielordner für den Prompt
    const availableFolders = [];
    for (const folderValue of settings.targetFolders || []) {
        const { accountId, path } = splitFolderValue(folderValue);
        try {
            const account = await browser.accounts.get(accountId);
            if (account) {
                availableFolders.push(`${account.name} - ${path}`);
            }
        } catch (error) {
            console.error(`Fehler beim Laden des Zielordners ${folderValue}:`, error);
        }
    }

    // Verarbeite jeden ausgewählten Quellordner
    for (const folderValue of settings.sourceFolders || []) {
        const { accountId, path } = splitFolderValue(folderValue);
        
        try {
            // Hole den Account
            const account = await browser.accounts.get(accountId);
            if (!account) {
                console.error(`Account nicht gefunden: ${accountId}`);
                continue;
            }

            // Hole den Ordner
            const folder = await findFolderByPath(account, path);
            if (!folder) {
                console.error(`Ordner nicht gefunden: ${path} in Account ${account.name}`);
                continue;
            }

            console.log(`Verarbeite Ordner: ${account.name} - ${folder.path}`);

            try {
                // Hole Nachrichten
                const messageList = await browser.messages.list(folder);
                if (!messageList || !messageList.messages) {
                    console.log(`Keine Nachrichten in ${folder.path}`);
                    continue;
                }

                // Verarbeite jede Nachricht
                for (const message of messageList.messages) {
                    try {
                        // Überspringe bereits verarbeitete oder gelesene E-Mails
                        if (processedIds.includes(message.id)) {
                            console.log(`Überspringe bereits verarbeitete Nachricht: ${message.subject}`);
                            continue;
                        }

                        // Hole detaillierte Nachrichteninformationen für den read/unread Status
                        const messageDetails = await browser.messages.get(message.id);
                        console.log(`Status für ${message.subject}: ${messageDetails.read ? 'gelesen' : 'ungelesen'}`);
                        
                        if (settings.unreadOnly && messageDetails.read) {
                            console.log(`Überspringe gelesene Nachricht: ${message.subject}`);
                            continue;
                        }

                        console.log(`Verarbeite Nachricht: ${message.subject}`);

                        const content = await getMessageContent(message.id);
                        console.log('E-Mail Inhalt Länge:', content ? content.length : 0);

                        try {
                            // Erstelle und validiere den Prompt
                            const prompt = buildPrompt(
                                settings.processingPrompt,
                                content,
                                formattedFolders
                            );

                            console.log('Prompt erfolgreich erstellt, Länge:', prompt.length);

                            // Nur wenn der Prompt valide ist, mache die API-Anfrage
                            let result;
                            if (settings.aiService === 'ollama') {
                                result = await callOllama(prompt, settings.ollamaEndpoint, settings.ollamaModel);
                            } else {
                                throw new Error('OpenAI noch nicht implementiert');
                            }

                            console.log('KI-Antwort erhalten, Länge:', result.length);

                            const parsedResult = parseAIResponse(result);
                            
                            // Extrahiere Zielordner aus der AI-Antwort
                            const targetFolderValue = extractTargetFolder(result, settings.targetFolders);
                            if (targetFolderValue) {
                                const targetFolder = await getFolderFromValue(targetFolderValue);
                                if (targetFolder) {
                                    // Verschiebe E-Mail
                                    await browser.messages.move([message.id], targetFolder);
                                    console.log(`Nachricht verschoben nach: ${targetFolder.path}`);

                                    // Speichere Zusammenfassung
                                    summaries.push({
                                        from: message.author,
                                        subject: message.subject,
                                        parsedResult,
                                        movedTo: `${account.name} - ${targetFolder.path}`
                                    });

                                    // Markiere als verarbeitet
                                    processedIds.push(message.id);
                                    await saveProcessedEmails(processedIds);
                                } else {
                                    console.error(`Zielordner nicht gefunden: ${targetFolderValue}`);
                                }
                            } else {
                                const errorMsg = `Keine passende Ordnerzuordnung gefunden für: ${message.subject}`;
                                console.log(errorMsg);
                                errors.push(errorMsg);
                            }
                        } catch (error) {
                            const errorMsg = `Fehler bei der Verarbeitung von "${message.subject}": ${error.message}`;
                            console.error(errorMsg);
                            errors.push(errorMsg);
                            continue;
                        }
                    } catch (error) {
                        const errorMsg = `Fehler bei der Verarbeitung der Nachricht ${message.subject}: ${error.message}`;
                        console.error(errorMsg);
                        errors.push(errorMsg);
                        continue;
                    }
                }
            } catch (error) {
                const errorMsg = `Fehler beim Abrufen der Nachrichten aus ${folder.path}: ${error.message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }
        } catch (error) {
            const errorMsg = `Fehler beim Verarbeiten von Ordner ${folderValue}: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
        }
    }

    // Erstelle immer eine Zusammenfassungs-E-Mail
    try {
        const { accountId, path } = splitFolderValue(settings.summaryFolderId);
        const account = await browser.accounts.get(accountId);
        const summaryFolder = await findFolderByPath(account, path);
        
        if (summaryFolder) {
            await createSummaryEmail(summaries, { summaryFolderId: summaryFolder }, errors);
            console.log(`Zusammenfassungs-E-Mail erstellt mit ${summaries.length} Einträgen und ${errors.length} Fehlern`);
        } else {
            console.error('Zusammenfassungsordner nicht gefunden:', settings.summaryFolderId);
            errors.push('Zusammenfassungsordner nicht gefunden: ' + settings.summaryFolderId);
        }
    } catch (error) {
        console.error('Fehler beim Erstellen der Zusammenfassungs-E-Mail:', error);
        errors.push('Fehler beim Erstellen der Zusammenfassungs-E-Mail: ' + error.message);
    }

    return { 
        success: errors.length === 0, 
        processedCount: summaries.length,
        errorCount: errors.length
    };
}

// Message Handler
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        if (request.action === 'startBatchProcessing') {
            return await processBatch();
        } else if (request.action === 'analyzeEmail' || request.action === 'summarizeEmail') {
            const messageContent = await getMessageContent(request.message.id);
            let prompt = '';
            let result = '';

            if (request.action === 'analyzeEmail') {
                prompt = `Analysiere diese E-Mail und gib eine kurze Einschätzung über Wichtigkeit, Dringlichkeit und empfohlene Aktionen:\n\n${messageContent}`;
            } else if (request.action === 'summarizeEmail') {
                prompt = `Fasse diese E-Mail kurz und prägnant zusammen:\n\n${messageContent}`;
            }

            if (request.service === 'ollama') {
                result = await callOllama(prompt, request.endpoint);
            } else {
                throw new Error('OpenAI noch nicht implementiert');
            }

            return { result };
        }
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}); 