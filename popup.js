// Popup JavaScript - User interface logic

let isActive = false;
let currentImage = null;
let conversionRules = []; // List of conversion rules
let imagePickerShortcut = null; // Image picker mode shortcut
let imageReplaceShortcut = null; // Image replace mode shortcut

// DOM elements
const activateBtn = document.getElementById('activateBtn');
const deactivateBtn = document.getElementById('deactivateBtn');
const sourceFormatSelect = document.getElementById('sourceFormat');
const targetFormatSelect = document.getElementById('targetFormat');
const qualitySection = document.getElementById('qualitySection');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const addRuleBtn = document.getElementById('addRuleBtn');
const rulesList = document.getElementById('rulesList');
const statusMessage = document.getElementById('statusMessage');
const clipboardPreview = document.getElementById('clipboardPreview');
const previewImage = document.getElementById('previewImage');
const imageInfo = document.getElementById('imageInfo');
const shortcutInput = document.getElementById('shortcutInput');
const clearShortcutBtn = document.getElementById('clearShortcutBtn');
const replaceShortcutInput = document.getElementById('replaceShortcutInput');
const clearReplaceShortcutBtn = document.getElementById('clearReplaceShortcutBtn');
const editClipboardBtn = document.getElementById('editClipboardBtn');

// Check state when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadState();
    await checkClipboard();
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    activateBtn.addEventListener('click', activateFeature);
    deactivateBtn.addEventListener('click', deactivateFeature);
    addRuleBtn.addEventListener('click', addConversionRule);
    clearShortcutBtn.addEventListener('click', clearShortcut);
    clearReplaceShortcutBtn.addEventListener('click', clearReplaceShortcut);
    editClipboardBtn.addEventListener('click', editClipboardImage);
    
    // Keydown listener for shortcut input
    shortcutInput.addEventListener('keydown', captureShortcut);
    
    // Keydown listener for replace shortcut input
    replaceShortcutInput.addEventListener('keydown', captureReplaceShortcut);
    
    targetFormatSelect.addEventListener('change', (e) => {
        const format = e.target.value;
        // Show quality setting for JPEG, WebP
        if (format === 'jpeg' || format === 'webp') {
            qualitySection.style.display = 'block';
        } else {
            qualitySection.style.display = 'none';
        }
    });
    
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value;
    });
}

// Save state
async function saveState() {
    const state = {
        isActive: isActive,
        conversionRules: conversionRules,
        imagePickerShortcut: imagePickerShortcut,
        imageReplaceShortcut: imageReplaceShortcut
    };
    await chrome.storage.local.set(state);
}

// Load state
async function loadState() {
    const state = await chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut', 'imageReplaceShortcut']);
    
    if (state.isActive) {
        isActive = true;
        activateBtn.style.display = 'none';
        deactivateBtn.style.display = 'block';
        showStatus('Feature active - Click on file input fields', 'success');
    }
    
    if (state.conversionRules && state.conversionRules.length > 0) {
        conversionRules = state.conversionRules;
        renderRulesList();
    }
    
    if (state.imagePickerShortcut) {
        imagePickerShortcut = state.imagePickerShortcut;
        displayShortcut();
    }
    
    if (state.imageReplaceShortcut) {
        imageReplaceShortcut = state.imageReplaceShortcut;
        displayReplaceShortcut();
    }
}

// Add conversion rule
function addConversionRule() {
    const sourceFormat = sourceFormatSelect.value;
    const targetFormat = targetFormatSelect.value;
    const quality = parseInt(qualitySlider.value);
    
    if (targetFormat === 'original') {
        showStatus('Please select a target format', 'error');
        return;
    }
    
    const rule = {
        id: Date.now(),
        source: sourceFormat,
        target: targetFormat,
        quality: quality
    };
    
    conversionRules.push(rule);
    renderRulesList();
    saveState();
    showStatus('Rule added', 'success');
}

// List rules
function renderRulesList() {
    if (conversionRules.length === 0) {
        rulesList.innerHTML = '<p class="no-rules">No rules added yet</p>';
        return;
    }
    
    rulesList.innerHTML = conversionRules.map(rule => `
        <div class="rule-item" data-id="${rule.id}">
            <span class="rule-text">
                ${rule.source === 'all' ? 'All Formats' : rule.source.toUpperCase()} 
                → ${rule.target.toUpperCase()}
                ${(rule.target === 'jpeg' || rule.target === 'webp') ? ` (${rule.quality}%)` : ''}
            </span>
            <button class="btn-delete" data-rule-id="${rule.id}">×</button>
        </div>
    `).join('');
    
    // Listen for delete buttons with event delegation
    rulesList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ruleId = parseInt(e.target.getAttribute('data-rule-id'));
            deleteRule(ruleId);
        });
    });
}

// Delete rule
function deleteRule(ruleId) {
    conversionRules = conversionRules.filter(rule => rule.id !== ruleId);
    renderRulesList();
    saveState();
    showStatus('Rule deleted', 'info');
}

// Check clipboard
async function checkClipboard() {
    try {
        const items = await navigator.clipboard.read();
        
        for (const item of items) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            
            if (imageTypes.length > 0) {
                const imageType = imageTypes[0];
                const blob = await item.getType(imageType);
                currentImage = blob;
                
                // Show preview
                const url = URL.createObjectURL(blob);
                previewImage.src = url;
                clipboardPreview.style.display = 'block';
                
                // Image info
                const img = new Image();
                img.onload = () => {
                    const sizeKB = (blob.size / 1024).toFixed(2);
                    const format = imageType.split('/')[1].toUpperCase();
                    imageInfo.textContent = `${img.width}x${img.height} | ${format} | ${sizeKB} KB`;
                };
                img.src = url;
                
                return true;
            }
        }
        
        // Clipboard empty
        clipboardPreview.style.display = 'none';
        currentImage = null;
        return false;
        
    } catch (error) {
        console.error('Clipboard read error:', error);
        clipboardPreview.style.display = 'none';
        return false;
    }
}

// Enable feature
async function activateFeature() {
    // Reload rules from storage (to ensure up-to-date)
    const state = await chrome.storage.local.get(['conversionRules']);
    if (state.conversionRules) {
        conversionRules = state.conversionRules;
    }
    
    
    isActive = true;
    activateBtn.style.display = 'none';
    deactivateBtn.style.display = 'block';
    
    // Save state - storage change event will be broadcast to all tabs automatically
    await saveState();
    
    showStatus('✅ Feature enabled! Active in all tabs.', 'success');
}

// Disable feature
async function deactivateFeature() {
    isActive = false;
    activateBtn.style.display = 'block';
    deactivateBtn.style.display = 'none';
    
    // Save state - storage change event will be broadcast to all tabs automatically
    await saveState();
    
    showStatus('Feature disabled.', 'info');
}

// Capture shortcut
function captureShortcut(e) {
    e.preventDefault();
    
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    // Add special keys
    if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.push(e.key.toUpperCase());
    }
    
    if (keys.length >= 2) { // At least modifier + one key
        imagePickerShortcut = {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
            key: e.key,
            code: e.code,
            display: keys.join('+')
        };
        
        displayShortcut();
        // Save to storage - background script will broadcast to all tabs
        saveState();
        
        showStatus('✅ Shortcut saved: ' + imagePickerShortcut.display + ' (Available in all tabs)', 'success');
    }
}

// Display shortcut
function displayShortcut() {
    if (imagePickerShortcut) {
        shortcutInput.value = imagePickerShortcut.display;
    } else {
        shortcutInput.value = '';
    }
}

// Clear shortcut
function clearShortcut() {
    imagePickerShortcut = null;
    shortcutInput.value = '';
    // Save to storage - background script will broadcast to all tabs
    saveState();
    
    // Notify all tabs
    
    showStatus('Shortcut cleared', 'info');
}

// Capture replace shortcut
function captureReplaceShortcut(e) {
    e.preventDefault();
    
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    // Add special keys
    if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.push(e.key.toUpperCase());
    }
    
    if (keys.length >= 2) { // At least modifier + one key
        imageReplaceShortcut = {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
            key: e.key,
            code: e.code,
            display: keys.join('+')
        };
        
        displayReplaceShortcut();
        // Save to storage - background script will broadcast to all tabs
        saveState();
        
        showStatus('✅ Replace shortcut saved: ' + imageReplaceShortcut.display + ' (Available in all tabs)', 'success');
    }
}

// Display replace shortcut
function displayReplaceShortcut() {
    if (imageReplaceShortcut) {
        replaceShortcutInput.value = imageReplaceShortcut.display;
    } else {
        replaceShortcutInput.value = '';
    }
}

// Clear replace shortcut
function clearReplaceShortcut() {
    imageReplaceShortcut = null;
    replaceShortcutInput.value = '';
    // Save to storage - background script will broadcast to all tabs
    saveState();
    
    showStatus('Replace shortcut cleared', 'info');
}

// Show status message
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    // Automatically hide error and info messages
    if (type === 'error' || type === 'info') {
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }, 5000);
    }
}

// Check clipboard again every time popup opens
setInterval(checkClipboard, 2000);

// Edit clipboard image - opens editor in active tab
async function editClipboardImage() {
    if (!currentImage) {
        showStatus('No image in clipboard!', 'error');
        return;
    }
    
    try {
        // Get all tabs and find a suitable one (web page, not extension/chrome pages)
        const allTabs = await chrome.tabs.query({});
        let targetTab = null;
        let needsScriptInjection = false;
        
        // First try to find an active web page tab
        const activeTabs = allTabs.filter(tab => 
            tab.active && 
            tab.url && 
            (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
        );
        
        if (activeTabs.length > 0) {
            targetTab = activeTabs[0];
        } else {
            // Find any web page tab
            const webTabs = allTabs.filter(tab => 
                tab.url && 
                (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
            );
            
            if (webTabs.length > 0) {
                targetTab = webTabs[0];
                // Switch to that tab
                await chrome.tabs.update(targetTab.id, { active: true });
            } else {
                // Create a new tab with a simple HTML page
                targetTab = await chrome.tabs.create({ 
                    url: 'data:text/html,<html><head><title>Image Editor</title></head><body style="margin:0;padding:0;background:#000;"></body></html>',
                    active: true 
                });
                needsScriptInjection = true;
                
                // Wait for tab to be ready
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        if (!targetTab || !targetTab.id) {
            showStatus('Cannot find or create a suitable tab', 'error');
            return;
        }
        
        // If we created a new tab, inject content script
        if (needsScriptInjection) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: targetTab.id },
                    files: ['content.js']
                });
                
                // Wait a bit for script to initialize
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (injectError) {
                console.error('Failed to inject content script:', injectError);
                showStatus('Failed to initialize editor', 'error');
                return;
            }
        }
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(currentImage);
        
        reader.onload = async () => {
            const base64Data = reader.result;
            const imageType = currentImage.type;
            
            // Send message to content script to open editor
            try {
                const response = await chrome.tabs.sendMessage(targetTab.id, {
                    action: 'openImageEditor',
                    imageData: base64Data,
                    imageType: imageType
                });
                
                if (response && response.success) {
                    showStatus('Editor opened successfully!', 'success');
                } else {
                    showStatus('Editor opening...', 'success');
                }
                
                // Close popup after a brief delay
                setTimeout(() => {
                    window.close();
                }, 400);
            } catch (error) {
                console.error('Error sending message:', error);
                // One more retry
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(targetTab.id, {
                            action: 'openImageEditor',
                            imageData: base64Data,
                            imageType: imageType
                        });
                        setTimeout(() => window.close(), 300);
                    } catch (retryError) {
                        showStatus('Failed to open editor. Try opening any webpage first.', 'error');
                    }
                }, 300);
            }
        };
        
        reader.onerror = () => {
            showStatus('Failed to read image data', 'error');
        };
        
    } catch (error) {
        console.error('Edit clipboard error:', error);
        showStatus('Failed to open editor', 'error');
    }
}
