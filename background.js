// Background Script - Service worker

// On install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            isActive: false,
            conversionRules: [],
            imagePickerShortcut: null
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
    if (request.action === 'getClipboard') {
        handleClipboardRequest(sendResponse);
        return true;
    }
});

// Handle clipboard requests
async function handleClipboardRequest(sendResponse) {
    try {
        sendResponse({ success: true });
    } catch (error) {
        console.error('Clipboard processing error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// On tab update, send current state to newly loaded pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut'], (result) => {
            chrome.tabs.sendMessage(tabId, {
                action: 'storageUpdate',
                changes: {
                    isActive: result.isActive || false,
                    conversionRules: result.conversionRules || [],
                    imagePickerShortcut: result.imagePickerShortcut || null
                }
            }).catch(() => {
                // Content script may not be loaded yet; ignore silently
            });
        });
    }
});
