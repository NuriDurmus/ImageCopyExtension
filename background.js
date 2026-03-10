// Background Script - Service worker

// On install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            isActive: false,
            conversionRules: [],
            imagePickerShortcut: null,
            imageReplaceShortcut: null,
            colorPickerShortcut: null,
            pdfPickerShortcut: null
        });
    } else if (details.reason === 'update') {
    }
});

// Listen for storage changes and broadcast to all tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        const updateMessage = {
            action: 'storageUpdate',
            changes: {}
        };
        
        if (changes.isActive) {
            updateMessage.changes.isActive = changes.isActive.newValue;
        }
        if (changes.conversionRules) {
            updateMessage.changes.conversionRules = changes.conversionRules.newValue;
        }
        if (changes.imagePickerShortcut) {
            updateMessage.changes.imagePickerShortcut = changes.imagePickerShortcut.newValue;
        }
        if (changes.imageReplaceShortcut) {
            updateMessage.changes.imageReplaceShortcut = changes.imageReplaceShortcut.newValue;
        }
        if (changes.colorPickerShortcut) {
            updateMessage.changes.colorPickerShortcut = changes.colorPickerShortcut.newValue;
        }
        if (changes.pdfPickerShortcut) {
            updateMessage.changes.pdfPickerShortcut = changes.pdfPickerShortcut.newValue;
        }
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, updateMessage).catch(() => {
                    // Content script may not be loaded yet; ignore silently
                });
            });
        });
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchPdfForUpload') {
        handlePdfFetchRequest(request, sendResponse);
        return true;
    }
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'pdfFetchStream') return;

    port.onMessage.addListener((message) => {
        if (message?.type === 'startPdfStream') {
            handlePdfFetchStream(port, message).catch((error) => {
                try {
                    port.postMessage({
                        type: 'error',
                        requestId: message?.requestId,
                        error: error?.message || 'Background stream failed'
                    });
                } catch (_) {
                    // Port may already be closed.
                }
            });
        }
    });
});

async function handlePdfFetchStream(port, message) {
    const url = message?.url;
    const requestId = message?.requestId;
    if (!url) {
        port.postMessage({ type: 'error', requestId, error: 'Missing PDF URL' });
        return;
    }

    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`Server error: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    const contentLengthHeader = response.headers.get('content-length');
    const total = Number.parseInt(contentLengthHeader || '0', 10) || 0;

    if (!response.body || typeof response.body.getReader !== 'function') {
        const arrayBuffer = await response.arrayBuffer();
        port.postMessage({
            type: 'chunk',
            requestId,
            chunk: new Uint8Array(arrayBuffer),
            received: arrayBuffer.byteLength,
            total,
            contentType
        });
        port.postMessage({
            type: 'done',
            requestId,
            received: arrayBuffer.byteLength,
            total: total || arrayBuffer.byteLength,
            contentType
        });
        return;
    }

    const reader = response.body.getReader();
    let received = 0;
    let lastProgressTs = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        received += value.byteLength;
        port.postMessage({
            type: 'chunk',
            requestId,
            chunk: value,
            received,
            total,
            contentType
        });

        const now = Date.now();
        if (now - lastProgressTs > 120) {
            lastProgressTs = now;
            port.postMessage({
                type: 'progress',
                requestId,
                received,
                total,
                contentType
            });
        }
    }

    port.postMessage({
        type: 'done',
        requestId,
        received,
        total: total || received,
        contentType
    });
}

async function handlePdfFetchRequest(request, sendResponse) {
    try {
        const url = request?.url;
        if (!url) {
            sendResponse({ success: false, error: 'Missing PDF URL' });
            return;
        }

        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Server error: HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'application/pdf';
        const contentLengthHeader = response.headers.get('content-length');
        const contentLength = Number.parseInt(contentLengthHeader || '0', 10) || null;
        const arrayBuffer = await response.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);

        sendResponse({
            success: true,
            arrayBuffer,
            byteArray,
            contentType,
            contentLength
        });
    } catch (error) {
        console.error('[PDF Picker] background fetch error:', error);
        sendResponse({ success: false, error: error?.message || 'Failed to fetch PDF' });
    }
}

// On tab update, send current state to newly loaded pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut', 'imageReplaceShortcut', 'colorPickerShortcut', 'pdfPickerShortcut'], (result) => {
            chrome.tabs.sendMessage(tabId, {
                action: 'storageUpdate',
                changes: {
                    isActive: result.isActive || false,
                    conversionRules: result.conversionRules || [],
                    imagePickerShortcut: result.imagePickerShortcut || null,
                    imageReplaceShortcut: result.imageReplaceShortcut || null,
                    colorPickerShortcut: result.colorPickerShortcut || null,
                    pdfPickerShortcut: result.pdfPickerShortcut || null
                }
            }).catch(() => {
                // Content script may not be loaded yet; ignore silently
            });
        });
    }
});
