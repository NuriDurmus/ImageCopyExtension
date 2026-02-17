// Popup JavaScript - User interface logic

let isActive = false;
let currentImage = null;
let currentClipboardItem = null;
let conversionRules = []; // List of conversion rules
let imagePickerShortcut = null; // Image picker mode shortcut
let imageReplaceShortcut = null; // Image replace mode shortcut
let colorPickerShortcut = null; // Color picker mode shortcut

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
const colorPickerShortcutInput = document.getElementById('colorPickerShortcutInput');
const clearColorPickerShortcutBtn = document.getElementById('clearColorPickerShortcutBtn');
const editClipboardBtn = document.getElementById('editClipboardBtn');
const headerDownloadBtn = document.getElementById('headerDownloadBtn');
const headerFormatBadge = document.getElementById('headerFormatBadge');

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
    clearColorPickerShortcutBtn.addEventListener('click', clearColorPickerShortcut);
    editClipboardBtn.addEventListener('click', editClipboardImage);
    headerDownloadBtn.addEventListener('click', downloadClipboardItem);
    
    // Keydown listener for shortcut input
    shortcutInput.addEventListener('keydown', captureShortcut);
    
    // Keydown listener for replace shortcut input
    replaceShortcutInput.addEventListener('keydown', captureReplaceShortcut);
    
    // Keydown listener for color picker shortcut input
    colorPickerShortcutInput.addEventListener('keydown', captureColorPickerShortcut);
    
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
        imageReplaceShortcut: imageReplaceShortcut,
        colorPickerShortcut: colorPickerShortcut
    };
    await chrome.storage.local.set(state);
}

// Load state
async function loadState() {
    const state = await chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut', 'imageReplaceShortcut', 'colorPickerShortcut']);
    
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
    
    if (state.colorPickerShortcut) {
        colorPickerShortcut = state.colorPickerShortcut;
        displayColorPickerShortcut();
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
            if (item.types.includes('text/plain')) {
                const textBlob = await item.getType('text/plain');
                const textContent = await textBlob.text();
                const trimmed = textContent ? textContent.trim() : '';

                if (trimmed && trimmed.toLowerCase().includes('<svg')) {
                    const svgBlob = new Blob([textContent], { type: 'image/svg+xml' });
                    const svgUrl = URL.createObjectURL(svgBlob);

                    currentImage = null;
                    currentClipboardItem = {
                        kind: 'svgText',
                        mimeType: 'image/svg+xml',
                        text: textContent,
                        blob: svgBlob
                    };

                    previewImage.src = svgUrl;
                    previewImage.style.display = 'block';
                    editClipboardBtn.style.display = 'none';
                    clipboardPreview.style.display = 'block';
                    setHeaderDownloadState(true, 'Download SVG', 'SVG');

                    const sizeKB = (svgBlob.size / 1024).toFixed(2);
                    imageInfo.textContent = `SVG | ${sizeKB} KB`;
                    return true;
                }
            }

            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            
            if (imageTypes.length > 0) {
                const imageType = imageTypes[0];
                const blob = await item.getType(imageType);
                currentImage = blob;
                currentClipboardItem = {
                    kind: 'image',
                    mimeType: imageType,
                    blob: blob
                };
                
                // Show preview
                const url = URL.createObjectURL(blob);
                previewImage.src = url;
                previewImage.style.display = 'block';
                editClipboardBtn.style.display = 'flex';
                clipboardPreview.style.display = 'block';
                const badgeFormat = getExtensionFromMime(imageType).toUpperCase();
                setHeaderDownloadState(true, imageType.includes('svg') ? 'Download SVG' : 'Download image', badgeFormat);
                
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
        currentClipboardItem = null;
        setHeaderDownloadState(false, 'Download clipboard item');
        return false;
        
    } catch (error) {
        // Silently ignore clipboard errors - they're common and harmless
        // (happens when popup doesn't have focus or clipboard is empty)
        clipboardPreview.style.display = 'none';
        currentImage = null;
        currentClipboardItem = null;
        setHeaderDownloadState(false, 'Download clipboard item');
        return false;
    }
}

function setHeaderDownloadState(enabled, title, format = '') {
    headerDownloadBtn.disabled = !enabled;
    headerDownloadBtn.title = title;

    if (enabled && format) {
        headerFormatBadge.textContent = format;
        headerFormatBadge.style.display = 'inline-block';
    } else {
        headerFormatBadge.textContent = '';
        headerFormatBadge.style.display = 'none';
    }
}

function getExtensionFromMime(mimeType) {
    if (!mimeType) return 'png';
    if (mimeType.includes('svg')) return 'svg';
    if (mimeType.includes('jpeg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('bmp')) return 'bmp';
    return 'png';
}

async function downloadClipboardItem() {
    if (!currentClipboardItem) {
        showStatus('No clipboard item to download', 'info');
        return;
    }

    try {
        const extension = getExtensionFromMime(currentClipboardItem.mimeType);
        const filename = `clipboard_${Date.now()}.${extension}`;
        let blobToDownload = currentClipboardItem.blob;

        if (!blobToDownload && currentClipboardItem.kind === 'svgText') {
            blobToDownload = new Blob([currentClipboardItem.text], { type: 'image/svg+xml' });
        }

        if (!blobToDownload) {
            showStatus('Download failed: missing data', 'error');
            return;
        }

        const downloadUrl = URL.createObjectURL(blobToDownload);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

        showStatus(`${extension.toUpperCase()} downloaded`, 'success');
    } catch (error) {
        showStatus('Download failed', 'error');
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
        // Convert blob to base64 first
        const reader = new FileReader();
        reader.readAsDataURL(currentImage);
        
        reader.onload = async () => {
            const base64Data = reader.result;
            const imageType = currentImage.type;
            
            try {
                let targetTab = null;
                
                // Get the active tab in the current window
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (activeTab && activeTab.url && 
                    (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://') || activeTab.url.startsWith('file://'))) {
                    targetTab = activeTab;
                } else {
                    // Active tab is restricted, find any usable tab in this window
                    const windowTabs = await chrome.tabs.query({ currentWindow: true });
                    const usableTab = windowTabs.find(tab => 
                        tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://') || tab.url.startsWith('file://'))
                    );
                    
                    if (usableTab) {
                        targetTab = usableTab;
                        await chrome.tabs.update(targetTab.id, { active: true });
                    } else {
                        // No usable tab, create editor.html
                        targetTab = await chrome.tabs.create({ 
                            url: chrome.runtime.getURL('editor.html'),
                            active: true 
                        });
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                if (!targetTab || !targetTab.id) {
                    showStatus('Cannot find or create a suitable tab', 'error');
                    return;
                }
                
                // Try to send message to content script
                try {
                    const response = await chrome.tabs.sendMessage(targetTab.id, {
                        action: 'openImageEditor',
                        imageData: base64Data,
                        imageType: imageType
                    });
                    
                    showStatus('Editor opening...', 'success');
                    
                    // Close popup after a brief delay
                    setTimeout(() => {
                        window.close();
                    }, 300);
                } catch (error) {
                    // Content script might not be injected, try injecting it first
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: targetTab.id },
                            files: ['content.js']
                        });
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        await chrome.tabs.sendMessage(targetTab.id, {
                            action: 'openImageEditor',
                            imageData: base64Data,
                            imageType: imageType
                        });
                        
                        setTimeout(() => window.close(), 300);
                    } catch (retryError) {
                        showStatus('⚠️ Cannot open editor on this page. Please open a regular webpage.', 'error');
                    }
                }
                
            } catch (error) {
                showStatus('Failed to open editor', 'error');
            }
        };
        
        reader.onerror = () => {
            showStatus('Failed to read image data', 'error');
        };
        
    } catch (error) {
        showStatus('Failed to open editor', 'error');
    }
}

// ============================================
// COLOR PICKER SHORTCUT MANAGEMENT
// ============================================

// Capture color picker shortcut
function captureColorPickerShortcut(e) {
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
        colorPickerShortcut = {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
            key: e.key,
            code: e.code,
            display: keys.join('+')
        };
        
        displayColorPickerShortcut();
        // Save to storage - background script will broadcast to all tabs
        saveState();
        
        showStatus('✅ Color Picker shortcut saved: ' + colorPickerShortcut.display + ' (Available in all tabs)', 'success');
    }
}

// Display color picker shortcut
function displayColorPickerShortcut() {
    if (colorPickerShortcut) {
        colorPickerShortcutInput.value = colorPickerShortcut.display;
    } else {
        colorPickerShortcutInput.value = '';
    }
}

// Clear color picker shortcut
function clearColorPickerShortcut() {
    colorPickerShortcut = null;
    colorPickerShortcutInput.value = '';
    // Save to storage - background script will broadcast to all tabs
    saveState();
    
    showStatus('Color Picker shortcut cleared', 'info');
}
