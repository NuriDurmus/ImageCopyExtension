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

async function handlePdfFetchRequest(request, sendResponse) {
    try {
        const url = request?.url;
        if (!url) {
            sendResponse({ success: false, error: 'PDF URL eksik' });
            return;
        }

        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Sunucu hatası: HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'application/pdf';
        const arrayBuffer = await response.arrayBuffer();

        sendResponse({
            success: true,
            bytes: Array.from(new Uint8Array(arrayBuffer)),
            contentType
        });
    } catch (error) {
        console.error('[PDF Picker] background fetch error:', error);
        sendResponse({ success: false, error: error?.message || 'PDF indirilemedi' });
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
