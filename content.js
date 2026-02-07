// Content Script - Page interaction

let isActive = false;
let conversionRules = []; // [{source: 'jpeg', target: 'png', quality: 100}, ...]
let isInitialized = false;

// Variables for Image Picker Mode
let imagePickerMode = false;
let imagePickerOverlay = null;
let imagePickerCloseButton = null;
let currentHighlightedElement = null;
let imagePickerShortcut = null; // Shortcut set by user
let mouseMoveTimeout = null; // For debounce

// Variables for Image Replace Mode
let imageReplaceMode = false;
let imageReplaceOverlay = null;
let imageReplaceCloseButton = null;
let currentReplaceHighlightedElement = null;
let imageReplaceShortcut = null; // Shortcut set by user
let replaceMouseMoveTimeout = null; // For debounce

// Variables for Color Picker Mode
let colorPickerMode = false;
let colorPickerOverlay = null;
let colorPickerUI = null;
let colorPickerShortcut = null; // Shortcut set by user
let eyeDropperSupported = typeof window.EyeDropper !== 'undefined';

// Image Editor Settings Storage Key
const IMAGE_EDITOR_SETTINGS_KEY = 'imageEditorLastSettings';

// Check if Chrome extension context is still valid
function isChromeContextValid() {
    try {
        return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
        return false;
    }
}

// Initialization function
function initialize() {
    if (isInitialized) {
        return;
    }
    isInitialized = true;
    
    // Check if Chrome Extension APIs are available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        // Listen for messages from extension
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'activate') {
                isActive = true;
                conversionRules = request.conversionRules || [];
                attachFileInputListeners();
                sendResponse({ success: true });
            } else if (request.action === 'deactivate') {
                isActive = false;
                removeFileInputListeners();
                sendResponse({ success: true });
            } else if (request.action === 'updateShortcut') {
                imagePickerShortcut = request.shortcut;
                sendResponse({ success: true });
            } else if (request.action === 'openImageEditor') {
                // Open image editor with data from popup
                handleOpenImageEditorFromPopup(request, sendResponse);
                return true; // Keep message channel open for async response
            } else if (request.action === 'storageUpdate') {
                // Apply storage changes
                if ('isActive' in request.changes) {
                    const wasActive = isActive;
                    isActive = request.changes.isActive;
                    
                    if (isActive && !wasActive) {
                        attachFileInputListeners();
                    } else if (!isActive && wasActive) {
                        removeFileInputListeners();
                    }
                }
                
                if ('conversionRules' in request.changes) {
                    conversionRules = request.changes.conversionRules || [];
                }
                
                if ('imagePickerShortcut' in request.changes) {
                    imagePickerShortcut = request.changes.imagePickerShortcut;
                }
                
                if ('imageReplaceShortcut' in request.changes) {
                    imageReplaceShortcut = request.changes.imageReplaceShortcut;
                }
                
                if ('colorPickerShortcut' in request.changes) {
                    colorPickerShortcut = request.changes.colorPickerShortcut;
                }
                
                sendResponse({ success: true });
            }
            return true;
        });

        // Check state when page loads
        chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut', 'imageReplaceShortcut', 'colorPickerShortcut'], (result) => {
            if (result.isActive) {
                isActive = true;
                conversionRules = result.conversionRules || [];
                attachFileInputListeners();
            }
            if (result.imagePickerShortcut) {
                imagePickerShortcut = result.imagePickerShortcut;
            }
            if (result.imageReplaceShortcut) {
                imageReplaceShortcut = result.imageReplaceShortcut;
            }
            if (result.colorPickerShortcut) {
                colorPickerShortcut = result.colorPickerShortcut;
            }
        });
    } else {
        console.warn('⚠️ Chrome Extension API not found - Manual mode active');
        // Enable manually for testing
        isActive = true;
        conversionRules = [];
        attachFileInputListeners();
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // If already loaded, start immediately
    initialize();
}

// Add listeners to file input elements
function attachFileInputListeners() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach((input, index) => {
        if (!input.dataset.imageCopyIntercepted) {
            // Method 1: Event listener
            input.removeEventListener('click', handleFileInputClick, true);
            input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
            
            // Method 2: Override click method (more aggressive)
            if (!input._originalClick) {
                input._originalClick = input.click.bind(input);
                input.click = function() {
                    if (isActive) {
                        // Create fake event and call handler
                        const fakeEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        Object.defineProperty(fakeEvent, 'target', { value: input, enumerable: true });
                        handleFileInputClick(fakeEvent);
                    } else {
                        input._originalClick();
                    }
                };
            }
            
            input.dataset.imageCopyIntercepted = 'true';
        }
    });
    
    observeNewFileInputs();
}

// Remove file input listeners
function removeFileInputListeners() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.removeEventListener('click', handleFileInputClick, { capture: true });
        
        // Restore overridden click method
        if (input._originalClick) {
            input.click = input._originalClick;
            delete input._originalClick;
        }
        
        delete input.dataset.imageCopyIntercepted;
    });
}

// Handle file input click
async function handleFileInputClick(event) {
    if (!isActive) return;
    
    const input = event.target;
    
    // Prevent recursive calls
    if (input._isProcessing) return;
    input._isProcessing = true;
    
    // PREVENT event first (before async operations!)
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Helper function to open native file dialog
    const openNativeDialog = () => {
        input.removeEventListener('click', handleFileInputClick, { capture: true });
        
        // Restore original click if exists
        if (input._originalClick) {
            const origClick = input._originalClick;
            input.click = origClick;
        }
        
        setTimeout(() => {
            input.click();
            
            setTimeout(() => {
                input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
                // Re-apply override
                if (input._originalClick) {
                    input.click = function() {
                        if (isActive && !input._isProcessing) {
                            const fakeEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            Object.defineProperty(fakeEvent, 'target', { value: input, enumerable: true });
                            handleFileInputClick(fakeEvent);
                        } else if (input._originalClick) {
                            input._originalClick();
                        }
                    };
                }
                input._isProcessing = false;
            }, 100);
        }, 50);
    };
    
    // Check if document is focused - if not, open native dialog
    if (!document.hasFocus()) {
        openNativeDialog();
        return;
    }
    
    // Check if there is an image in the clipboard
    try {
        const items = await navigator.clipboard.read();
        let hasImage = false;
        
        for (const item of items) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            if (imageTypes.length > 0) {
                hasImage = true;
                break;
            }
        }
        
        // If no image in clipboard, open browser dialog MANUALLY
        if (!hasImage) {
            openNativeDialog();
            return;
        }
        
        // Image in clipboard - continue
        // Get the image
        for (const item of items) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            
            if (imageTypes.length > 0) {
                const imageType = imageTypes[0];
                let blob = await item.getType(imageType);
                // Show modal
                const userChoice = await showImageChoiceModal(blob, imageType);
                
                if (userChoice.action === 'clipboard') {
                    // Use copied image (or edited image)
                    const currentFormat = userChoice.format;
                    
                    // If edited blob exists, use it instead
                    if (userChoice.editedBlob) {
                        blob = userChoice.editedBlob;
                    }
                    
                    // Find conversion rule
                    const matchingRule = conversionRules.find(rule => 
                        rule.source === 'all' || rule.source === currentFormat
                    );
                    
                    
                    if (matchingRule && !userChoice.editedBlob) {
                        // Only apply conversion if not already edited
                        blob = await convertImageFormat(blob, matchingRule.target, matchingRule.quality);
                        
                        const fileName = generateFileName(matchingRule.target);
                        const mimeType = `image/${matchingRule.target}`;
                        const file = new File([blob], fileName, { type: mimeType });
                        
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        showNotification(`Image converted to ${matchingRule.target.toUpperCase()} format! ✓`, 'success');
                    } else {
                        // If no rule or already edited, add as is
                        const fileName = generateFileName(currentFormat);
                        const mimeType = `image/${currentFormat}`;
                        const file = new File([blob], fileName, { type: mimeType });
                        
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        showNotification(userChoice.editedBlob ? 'Edited image added successfully! ✓' : 'Copied image added successfully! ✓', 'success');
                    }
                    
                } else if (userChoice.action === 'browse') {
                    openNativeDialog();
                    return;
                }
                
                input._isProcessing = false;
                return;
            }
        }
        
        input._isProcessing = false;
        
    } catch (error) {
        // Silently handle clipboard errors and open native dialog
        openNativeDialog();
        return;
    }
}

// Detect the real format of the blob (magic bytes check)
async function detectImageFormat(blob) {
    const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return 'jpeg';
    }
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return 'png';
    }
    // GIF: 47 49 46
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return 'gif';
    }
    // WebP: RIFF....WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return 'webp';
    }
    // BMP: 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
        return 'bmp';
    }
    
    // Unknown format
    return null;
}

// Show modal and wait for user selection
async function showImageChoiceModal(blob, imageType) {
    // Detect real format
    const realFormat = await detectImageFormat(blob);
    const actualFormat = realFormat || imageType.split('/')[1];
    
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'image-copy-choice-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            animation: fadeIn 0.2s ease;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.3s ease;
        `;
        
        const title = document.createElement('h2');
        title.textContent = '📸 Select Image Source';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
        `;
        
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            margin-bottom: 25px;
            text-align: center;
        `;
        
        const previewTitle = document.createElement('p');
        previewTitle.textContent = 'Image in Clipboard:';
        previewTitle.style.cssText = `
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            font-weight: 500;
        `;
        
        const previewImg = document.createElement('img');
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.cssText = `
            max-width: 100%;
            max-height: 300px;
            border-radius: 8px;
            border: 2px solid #e9ecef;
        `;
        
        const imageInfo = document.createElement('div');
        imageInfo.style.cssText = `
            margin-top: 10px;
            font-size: 13px;
            color: #6c757d;
        `;
        
        const img = new Image();
        img.onload = () => {
            const sizeKB = (blob.size / 1024).toFixed(2);
            const format = actualFormat.toUpperCase();
            imageInfo.textContent = `${img.width}x${img.height} | ${format} | ${sizeKB} KB`;
        };
        img.src = url;
        
        previewContainer.appendChild(previewTitle);
        previewContainer.appendChild(previewImg);
        previewContainer.appendChild(imageInfo);
        
        let formatInfo = null;
        // Show conversion rule if exists
        const matchingRule = conversionRules.find(rule => 
            rule.source === 'all' || rule.source === actualFormat
        );
        
        if (matchingRule) {
            formatInfo = document.createElement('div');
            formatInfo.style.cssText = `
                background: #e7f3ff;
                border: 1px solid #b3d9ff;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 20px;
                font-size: 13px;
                color: #004085;
                text-align: center;
            `;
            formatInfo.innerHTML = `
                <strong>🔄 Format Conversion Active</strong><br>
                ${actualFormat.toUpperCase()} → ${matchingRule.target.toUpperCase()}${(matchingRule.target === 'jpeg' || matchingRule.target === 'webp') ? ` (Quality: ${matchingRule.quality}%)` : ''}
            `;
        }
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        const useClipboardBtn = document.createElement('button');
        useClipboardBtn.textContent = '✓ Use Copied Image';
        useClipboardBtn.style.cssText = `
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s ease;
            font-family: inherit;
        `;
        useClipboardBtn.onmouseover = () => useClipboardBtn.style.transform = 'translateY(-2px)';
        useClipboardBtn.onmouseout = () => useClipboardBtn.style.transform = 'translateY(0)';
        useClipboardBtn.onclick = () => {
            URL.revokeObjectURL(url);
            modal.remove();
            resolve({ action: 'clipboard', format: actualFormat });
        };
        
        // Edit Image Button - Photoshop-like editor
        const editImageBtn = document.createElement('button');
        editImageBtn.textContent = '✏️ Edit Image';
        editImageBtn.style.cssText = `
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        `;
        editImageBtn.onmouseover = () => {
            editImageBtn.style.transform = 'translateY(-2px)';
            editImageBtn.style.boxShadow = '0 4px 15px rgba(240, 147, 251, 0.4)';
        };
        editImageBtn.onmouseout = () => {
            editImageBtn.style.transform = 'translateY(0)';
            editImageBtn.style.boxShadow = 'none';
        };
        editImageBtn.onclick = async () => {
            URL.revokeObjectURL(url);
            modal.remove();
            // Open image editor
            const editedResult = await openImageEditor(blob, actualFormat);
            if (editedResult) {
                resolve({ action: 'clipboard', format: editedResult.format, editedBlob: editedResult.blob });
            } else {
                resolve({ action: 'cancel' });
            }
        };
        
        const browseBtn = document.createElement('button');
        browseBtn.textContent = '📁 Select File from Computer';
        browseBtn.style.cssText = `
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            color: #667eea;
            background: white;
            border: 2px solid #667eea;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        `;
        browseBtn.onmouseover = () => {
            browseBtn.style.background = '#f8f9fa';
            browseBtn.style.transform = 'translateY(-2px)';
        };
        browseBtn.onmouseout = () => {
            browseBtn.style.background = 'white';
            browseBtn.style.transform = 'translateY(0)';
        };
        browseBtn.onclick = () => {
            URL.revokeObjectURL(url);
            modal.remove();
            resolve({ action: 'browse' });
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✗ Cancel';
        cancelBtn.style.cssText = `
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            color: #6c757d;
            background: transparent;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s ease;
            font-family: inherit;
        `;
        cancelBtn.onmouseover = () => cancelBtn.style.background = '#f8f9fa';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'transparent';
        cancelBtn.onclick = () => {
            URL.revokeObjectURL(url);
            modal.remove();
            resolve({ action: 'cancel' });
        };
        
        buttonContainer.appendChild(useClipboardBtn);
        buttonContainer.appendChild(editImageBtn);
        buttonContainer.appendChild(browseBtn);
        buttonContainer.appendChild(cancelBtn);
        
        modalContent.appendChild(title);
        modalContent.appendChild(previewContainer);
        if (formatInfo) {
            modalContent.appendChild(formatInfo);
        }
        modalContent.appendChild(buttonContainer);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                URL.revokeObjectURL(url);
                modal.remove();
                resolve({ action: 'cancel' });
            }
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                URL.revokeObjectURL(url);
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
                resolve({ action: 'cancel' });
            }
        };
        document.addEventListener('keydown', escapeHandler);
    });
}

// Convert image format
async function convertImageFormat(blob, format, quality) {
    // If quality is 100% and target format is JPEG, copy original JPEG as is
    if (quality === 100 && format === 'jpeg') {
        const sourceFormat = await detectImageFormat(blob);
        if (sourceFormat === 'jpeg') {
            return blob; // Return original blob as-is
        }
    }
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            let mimeType;
            switch (format) {
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case 'png':
                    mimeType = 'image/png';
                    break;
                case 'webp':
                    mimeType = 'image/webp';
                    break;
                case 'bmp':
                    mimeType = 'image/bmp';
                    break;
                case 'gif':
                    mimeType = 'image/gif';
                    break;
                default:
                    mimeType = 'image/png';
            }
            
            const qualityValue = (format === 'jpeg' || format === 'webp') ? quality / 100 : undefined;
            
            canvas.toBlob(
                (newBlob) => {
                    URL.revokeObjectURL(url);
                    if (newBlob) {
                        resolve(newBlob);
                    } else {
                        console.error('❌ Format conversion failed');
                        reject(new Error('Format conversion failed'));
                    }
                },
                mimeType,
                qualityValue
            );
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            console.error('❌ Image load failed');
            reject(new Error('Image load failed'));
        };
        
        img.src = url;
    });
}

// Generate file name
function generateFileName(format) {
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `image_${timestamp}_${randomStr}.${format}`;
}

// Show notification
function showNotification(message, type) {
    const existingNotification = document.getElementById('image-copy-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'image-copy-notification';
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    
    if (!document.getElementById('image-copy-notification-style')) {
        style.id = 'image-copy-notification-style';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Observe newly added file input elements
function observeNewFileInputs() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // If the added node is a file input
                    if (node.tagName === 'INPUT' && node.type === 'file' && !node.dataset.imageCopyIntercepted) {
                        // Add event listener
                        node.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
                        
                        // Override click method
                        if (!node._originalClick) {
                            node._originalClick = node.click.bind(node);
                            node.click = function() {
                                if (isActive) {
                                    const fakeEvent = new MouseEvent('click', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    });
                                    Object.defineProperty(fakeEvent, 'target', { value: node, enumerable: true });
                                    handleFileInputClick(fakeEvent);
                                } else {
                                    node._originalClick();
                                }
                            };
                        }
                        
                        node.dataset.imageCopyIntercepted = 'true';
                    }
                    
                        // Check file inputs in child elements
                    const fileInputs = node.querySelectorAll?.('input[type="file"]');
                    fileInputs?.forEach(input => {
                        if (!input.dataset.imageCopyIntercepted) {
                            input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
                            
                            if (!input._originalClick) {
                                input._originalClick = input.click.bind(input);
                                input.click = function() {
                                    if (isActive) {
                                        const fakeEvent = new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        });
                                        Object.defineProperty(fakeEvent, 'target', { value: input, enumerable: true });
                                        handleFileInputClick(fakeEvent);
                                    } else {
                                        input._originalClick();
                                    }
                                };
                            }
                            
                            input.dataset.imageCopyIntercepted = 'true';
                        }
                    });
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================
// IMAGE PICKER MODE - Select image with Ctrl+Alt+S
// ============================================

// Keyboard shortcut listener: Dynamic shortcut
document.addEventListener('keydown', (e) => {
    // Check image picker shortcut
    if (imagePickerShortcut) {
        const pickerMatches = 
            (imagePickerShortcut.ctrl === e.ctrlKey) &&
            (imagePickerShortcut.alt === e.altKey) &&
            (imagePickerShortcut.shift === e.shiftKey) &&
            (imagePickerShortcut.meta === e.metaKey) &&
            (imagePickerShortcut.key === e.key || imagePickerShortcut.code === e.code);
        
        if (pickerMatches) {
            e.preventDefault();
            toggleImagePickerMode();
            return;
        }
    }
    
    // Check image replace shortcut
    if (imageReplaceShortcut) {
        const replaceMatches = 
            (imageReplaceShortcut.ctrl === e.ctrlKey) &&
            (imageReplaceShortcut.alt === e.altKey) &&
            (imageReplaceShortcut.shift === e.shiftKey) &&
            (imageReplaceShortcut.meta === e.metaKey) &&
            (imageReplaceShortcut.key === e.key || imageReplaceShortcut.code === e.code);
        
        if (replaceMatches) {
            e.preventDefault();
            toggleImageReplaceMode();
            return;
        }
    }
    
    // Check color picker shortcut
    if (colorPickerShortcut) {
        const colorMatches = 
            (colorPickerShortcut.ctrl === e.ctrlKey) &&
            (colorPickerShortcut.alt === e.altKey) &&
            (colorPickerShortcut.shift === e.shiftKey) &&
            (colorPickerShortcut.meta === e.metaKey) &&
            (colorPickerShortcut.key === e.key || colorPickerShortcut.code === e.code);
        
        if (colorMatches) {
            e.preventDefault();
            toggleColorPickerMode();
            return;
        }
    }
});


// Toggle image picker mode
function toggleImagePickerMode() {
    if (imagePickerMode) {
        deactivateImagePickerMode();
    } else {
        activateImagePickerMode();
    }
}

// Activate image picker mode
function activateImagePickerMode() {
    if (!imagePickerShortcut) {
        console.warn('⚠️ Shortcut not set! Please set a shortcut from the popup.');
        showImagePickerNotification('⚠️ Please set a shortcut from the popup first', 'error');
        return;
    }
    
    imagePickerMode = true;
    
    // Create overlay (transparent layer covering the whole screen)
    imagePickerOverlay = document.createElement('div');
    imagePickerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        cursor: crosshair;
        pointer-events: auto;
    `;
    
    // Create close button
    imagePickerCloseButton = document.createElement('div');
    imagePickerCloseButton.innerHTML = '✕';
    imagePickerCloseButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: #ff4444;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        z-index: 9999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    imagePickerCloseButton.onmouseover = () => {
        imagePickerCloseButton.style.transform = 'scale(1.1)';
    };
    imagePickerCloseButton.onmouseout = () => {
        imagePickerCloseButton.style.transform = 'scale(1)';
    };
    imagePickerCloseButton.onclick = (e) => {
        e.stopPropagation();
        deactivateImagePickerMode();
    };
    
    document.body.appendChild(imagePickerOverlay);
    document.body.appendChild(imagePickerCloseButton);
    
    // Event listeners
    imagePickerOverlay.addEventListener('mousemove', handleImagePickerMouseMove);
    imagePickerOverlay.addEventListener('click', handleImagePickerClick);
}

// Deactivate image picker mode
function deactivateImagePickerMode() {
    imagePickerMode = false;
    
    // Remove overlay and button
    if (imagePickerOverlay) {
        imagePickerOverlay.remove();
        imagePickerOverlay = null;
    }
    if (imagePickerCloseButton) {
        imagePickerCloseButton.remove();
        imagePickerCloseButton = null;
    }
    
    // Remove highlight
    if (currentHighlightedElement) {
        removeHighlight(currentHighlightedElement);
        currentHighlightedElement = null;
    }
}

// On mouse move, detect image and highlight
function handleImagePickerMouseMove(e) {
    // For performance, debounce - run every 50ms
    if (mouseMoveTimeout) {
        return; // Previous cycle still running
    }
    
    mouseMoveTimeout = setTimeout(() => {
        mouseMoveTimeout = null;
    }, 50);
    
    // Hide overlay itself so we can find elements underneath
    imagePickerOverlay.style.pointerEvents = 'none';
    
    // Get element at mouse position
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    
    // Reactivate overlay
    imagePickerOverlay.style.pointerEvents = 'auto';
    
    if (!elementAtPoint) return;
    
    // Find nearest image element
    const imageElement = findNearestImageElement(elementAtPoint, e.clientX, e.clientY);
    
    // Remove previous highlight
    if (currentHighlightedElement && currentHighlightedElement !== imageElement) {
        removeHighlight(currentHighlightedElement);
    }
    
    // Highlight new element
    if (imageElement && imageElement !== currentHighlightedElement) {
        highlightElement(imageElement);
        currentHighlightedElement = imageElement;
    } else if (!imageElement && currentHighlightedElement) {
        // If no image, remove highlight
        removeHighlight(currentHighlightedElement);
        currentHighlightedElement = null;
    }
}

// On click, copy image
async function handleImagePickerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentHighlightedElement) return;
    
    try {
        // Copy image
        await copyImageFromElement(currentHighlightedElement);
        
        // Show success message
        showImagePickerNotification('✓ Image copied!', 'success');
        
        // Close mode
        setTimeout(() => deactivateImagePickerMode(), 500);
    } catch (error) {
        console.error('Image copy error:', error);
        showImagePickerNotification('✗ Copy failed', 'error');
    }
}

// Find nearest image element (img or background-image)
function findNearestImageElement(startElement, mouseX, mouseY) {
    const candidates = [];
    
    // 1. Traverse up from start element (parent chain)
    let element = startElement;
    while (element && element !== document.body) {
        // IMG tag check
        if (element.tagName === 'IMG' && element.src) {
            candidates.push({
                element: element,
                distance: calculateDistance(element, mouseX, mouseY),
                type: 'img'
            });
        }
        
        // Background image check
        const bgImage = window.getComputedStyle(element).backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
            candidates.push({
                element: element,
                distance: calculateDistance(element, mouseX, mouseY),
                type: 'background'
            });
        }
        
        element = element.parentElement;
    }
    
    // 2. Check all IMG elements in visible area
    const allImages = document.querySelectorAll('img[src]');
    allImages.forEach(img => {
        const rect = img.getBoundingClientRect();
        
        // Check if in visible area
        if (rect.width > 0 && rect.height > 0 && 
            rect.top < window.innerHeight && 
            rect.bottom > 0 &&
            rect.left < window.innerWidth && 
            rect.right > 0) {
            
            const distance = calculateDistance(img, mouseX, mouseY);
            if (distance < 500) { // Within 500px
                candidates.push({
                    element: img,
                    distance: distance,
                    type: 'img'
                });
            }
        }
    });
    
    // 3. Search all elements for background-image (visible ones)
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        
        // Check if visible and large enough
        if (rect.width > 10 && rect.height > 10 && 
            rect.top < window.innerHeight && 
            rect.bottom > 0 &&
            rect.left < window.innerWidth && 
            rect.right > 0) {
            
            const bgImage = window.getComputedStyle(el).backgroundImage;
            if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
                const distance = calculateDistance(el, mouseX, mouseY);
                if (distance < 500) { // Within 500px
                    candidates.push({
                        element: el,
                        distance: distance,
                        type: 'background'
                    });
                }
            }
        }
    });
    
    // Remove duplicates (same element may be added more than once)
    const uniqueCandidates = [];
    const seenElements = new Set();
    
    candidates.forEach(candidate => {
        if (!seenElements.has(candidate.element)) {
            seenElements.add(candidate.element);
            uniqueCandidates.push(candidate);
        }
    });
    
    // Return the nearest one
    if (uniqueCandidates.length === 0) return null;
    
    uniqueCandidates.sort((a, b) => a.distance - b.distance);
    
    return uniqueCandidates[0].element;
}

// Calculate distance between element and mouse
function calculateDistance(element, mouseX, mouseY) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    return Math.sqrt(
        Math.pow(centerX - mouseX, 2) + 
        Math.pow(centerY - mouseY, 2)
    );
}

// Highlight element
function highlightElement(element) {
    element.dataset.imagePickerHighlighted = 'true';
    element.style.outline = '3px solid #00ff00';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
    element.style.position = element.style.position || 'relative';
    element.style.zIndex = (parseInt(element.style.zIndex) || 0) + 10000;
}

// Remove highlight
function removeHighlight(element) {
    if (element.dataset.imagePickerHighlighted) {
        delete element.dataset.imagePickerHighlighted;
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.boxShadow = '';
        // Restore z-index
        const currentZ = parseInt(element.style.zIndex) || 0;
        if (currentZ >= 10000) {
            element.style.zIndex = currentZ - 10000;
        }
    }
}

// Copy image from element
async function copyImageFromElement(element) {
    let imageUrl = null;
    
    // If IMG tag, get src directly
    if (element.tagName === 'IMG') {
        imageUrl = element.src;
    } 
    // If background image, extract URL
    else {
        const bgImage = window.getComputedStyle(element).backgroundImage;
        const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch) {
            imageUrl = urlMatch[1];
        }
    }
    
    if (!imageUrl) {
        throw new Error('Image URL not found');
    }
    
    
    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
    });
    
    // Draw to canvas and convert to PNG
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Create PNG blob (Clipboard API only supports PNG)
    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
    });
    
    // Copy to clipboard
    await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
    ]);
    
}

// Show notification
function showImagePickerNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px 40px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        z-index: 99999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: fadeInOut 1s ease-in-out;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
        style.remove();
    }, 1000);
}

// ============================================
// IMAGE REPLACE MODE - Replace page images with clipboard image
// ============================================

// Toggle image replace mode
function toggleImageReplaceMode() {
    if (imageReplaceMode) {
        deactivateImageReplaceMode();
    } else {
        activateImageReplaceMode();
    }
}

// Activate image replace mode
async function activateImageReplaceMode() {
    if (!imageReplaceShortcut) {
        console.warn('⚠️ Replace shortcut not set! Please set a shortcut from the popup.');
        showImageReplaceNotification('⚠️ Please set a replace shortcut from the popup first', 'error');
        return;
    }
    
    // Check if there's an image in clipboard
    try {
        const items = await navigator.clipboard.read();
        let hasImage = false;
        
        for (const item of items) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            if (imageTypes.length > 0) {
                hasImage = true;
                break;
            }
        }
        
        if (!hasImage) {
            showImageReplaceNotification('⚠️ No image in clipboard! Copy an image first.', 'error');
            return;
        }
    } catch (error) {
        console.error('Clipboard check error:', error);
        showImageReplaceNotification('⚠️ Cannot access clipboard', 'error');
        return;
    }
    
    imageReplaceMode = true;
    
    // Create overlay
    imageReplaceOverlay = document.createElement('div');
    imageReplaceOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        cursor: crosshair;
        pointer-events: auto;
    `;
    
    // Create close button
    imageReplaceCloseButton = document.createElement('div');
    imageReplaceCloseButton.innerHTML = '✕';
    imageReplaceCloseButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: #ff4444;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        z-index: 9999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    imageReplaceCloseButton.onmouseover = () => {
        imageReplaceCloseButton.style.transform = 'scale(1.1)';
    };
    imageReplaceCloseButton.onmouseout = () => {
        imageReplaceCloseButton.style.transform = 'scale(1)';
    };
    imageReplaceCloseButton.onclick = (e) => {
        e.stopPropagation();
        deactivateImageReplaceMode();
    };
    
    // Create info panel
    const infoPanel = document.createElement('div');
    infoPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(33, 150, 243, 0.95);
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        z-index: 9999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    infoPanel.innerHTML = '🔄 <strong>Image Replace Mode</strong> - Hover over images and click to replace';
    
    // ESC key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            deactivateImageReplaceMode();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Store ESC handler for cleanup
    imageReplaceOverlay._escHandler = escHandler;
    
    // Mouse move handler with debounce
    const handleMouseMove = (e) => {
        clearTimeout(replaceMouseMoveTimeout);
        replaceMouseMoveTimeout = setTimeout(() => {
            findAndHighlightReplaceImage(e.clientX, e.clientY);
        }, 50);
    };
    
    // Click handler
    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (currentReplaceHighlightedElement) {
            await replaceImageWithClipboard(currentReplaceHighlightedElement);
        }
    };
    
    imageReplaceOverlay.addEventListener('mousemove', handleMouseMove);
    imageReplaceOverlay.addEventListener('click', handleClick);
    
    document.body.appendChild(imageReplaceOverlay);
    document.body.appendChild(imageReplaceCloseButton);
    document.body.appendChild(infoPanel);
    
    imageReplaceOverlay._infoPanel = infoPanel;
}

// Deactivate image replace mode
function deactivateImageReplaceMode() {
    imageReplaceMode = false;
    
    if (currentReplaceHighlightedElement) {
        removeReplaceHighlight(currentReplaceHighlightedElement);
        currentReplaceHighlightedElement = null;
    }
    
    // Remove ESC key listener
    if (imageReplaceOverlay && imageReplaceOverlay._escHandler) {
        document.removeEventListener('keydown', imageReplaceOverlay._escHandler);
    }
    
    if (imageReplaceOverlay) {
        // Remove info panel first
        if (imageReplaceOverlay._infoPanel) {
            imageReplaceOverlay._infoPanel.remove();
        }
        imageReplaceOverlay.remove();
        imageReplaceOverlay = null;
    }
    
    if (imageReplaceCloseButton) {
        imageReplaceCloseButton.remove();
        imageReplaceCloseButton = null;
    }
}

// Find and highlight image for replace
function findAndHighlightReplaceImage(mouseX, mouseY) {
    const element = document.elementFromPoint(mouseX, mouseY);
    
    if (!element) return;
    
    // Use the same advanced algorithm as image picker mode
    const imageElement = findNearestImageElementForReplace(element, mouseX, mouseY);
    
    // If found same element, return
    if (imageElement === currentReplaceHighlightedElement) {
        return;
    }
    
    // Remove old highlight
    if (currentReplaceHighlightedElement) {
        removeReplaceHighlight(currentReplaceHighlightedElement);
    }
    
    // Add new highlight
    if (imageElement) {
        currentReplaceHighlightedElement = imageElement;
        addReplaceHighlight(imageElement);
    } else {
        currentReplaceHighlightedElement = null;
    }
}

// Find nearest image element for replace (same as picker mode)
function findNearestImageElementForReplace(startElement, mouseX, mouseY) {
    const candidates = [];
    
    // 1. Traverse up from start element (parent chain)
    let element = startElement;
    while (element && element !== document.body) {
        // IMG tag check
        if (element.tagName === 'IMG' && element.src) {
            candidates.push({
                element: element,
                distance: calculateDistanceForReplace(element, mouseX, mouseY),
                type: 'img'
            });
        }
        
        // Background image check
        const bgImage = window.getComputedStyle(element).backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
            candidates.push({
                element: element,
                distance: calculateDistanceForReplace(element, mouseX, mouseY),
                type: 'background'
            });
        }
        
        element = element.parentElement;
    }
    
    // 2. Check all IMG elements in visible area
    const allImages = document.querySelectorAll('img[src]');
    allImages.forEach(img => {
        const rect = img.getBoundingClientRect();
        
        // Check if in visible area
        if (rect.width > 0 && rect.height > 0 && 
            rect.top < window.innerHeight && 
            rect.bottom > 0 &&
            rect.left < window.innerWidth && 
            rect.right > 0) {
            
            const distance = calculateDistanceForReplace(img, mouseX, mouseY);
            if (distance < 500) { // Within 500px
                candidates.push({
                    element: img,
                    distance: distance,
                    type: 'img'
                });
            }
        }
    });
    
    // 3. Search all elements for background-image (visible ones)
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        
        // Check if visible and large enough
        if (rect.width > 10 && rect.height > 10 && 
            rect.top < window.innerHeight && 
            rect.bottom > 0 &&
            rect.left < window.innerWidth && 
            rect.right > 0) {
            
            const bgImage = window.getComputedStyle(el).backgroundImage;
            if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
                const distance = calculateDistanceForReplace(el, mouseX, mouseY);
                if (distance < 500) { // Within 500px
                    candidates.push({
                        element: el,
                        distance: distance,
                        type: 'background'
                    });
                }
            }
        }
    });
    
    // Remove duplicates (same element may be added more than once)
    const uniqueCandidates = [];
    const seenElements = new Set();
    
    candidates.forEach(candidate => {
        if (!seenElements.has(candidate.element)) {
            seenElements.add(candidate.element);
            uniqueCandidates.push(candidate);
        }
    });
    
    // Return the nearest one
    if (uniqueCandidates.length === 0) return null;
    
    uniqueCandidates.sort((a, b) => a.distance - b.distance);
    
    return uniqueCandidates[0].element;
}

// Calculate distance between element and mouse for replace
function calculateDistanceForReplace(element, mouseX, mouseY) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    return Math.sqrt(
        Math.pow(centerX - mouseX, 2) + 
        Math.pow(centerY - mouseY, 2)
    );
}

// Add replace highlight
function addReplaceHighlight(element) {
    element.style.outline = '4px solid #2196F3';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 20px rgba(33, 150, 243, 0.8)';
    element.style.transition = 'all 0.2s ease';
}

// Remove replace highlight
function removeReplaceHighlight(element) {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.boxShadow = '';
}

// Replace image with clipboard
async function replaceImageWithClipboard(element) {
    try {
        const items = await navigator.clipboard.read();
        
        for (const item of items) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            
            if (imageTypes.length > 0) {
                const imageType = imageTypes[0];
                const blob = await item.getType(imageType);
                
                // Convert blob to data URL
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                
                reader.onload = () => {
                    const dataUrl = reader.result;
                    
                    // Replace image source
                    if (element.tagName === 'IMG') {
                        // Store original attributes (don't touch them)
                        const originalSrc = element.src;
                        
                        // Only change src
                        element.src = dataUrl;
                        
                        // If has srcset, update it too
                        if (element.hasAttribute('srcset')) {
                            element.srcset = dataUrl;
                        }
                        
                        console.log('✓ Image src replaced:', originalSrc, '->', 'data:image/...');
                    } else {
                        // Background image
                        element.style.backgroundImage = `url("${dataUrl}")`;
                        console.log('✓ Background image replaced');
                    }
                    
                    showImageReplaceNotification('✓ Image replaced successfully!', 'success');
                    
                    // Continue mode (don't close)
                    removeReplaceHighlight(element);
                    currentReplaceHighlightedElement = null;
                };
                
                reader.onerror = () => {
                    showImageReplaceNotification('❌ Failed to read clipboard image', 'error');
                };
                
                return;
            }
        }
        
        showImageReplaceNotification('❌ No image in clipboard', 'error');
        
    } catch (error) {
        console.error('Replace image error:', error);
        showImageReplaceNotification('❌ Failed to replace image', 'error');
    }
}

// Show notification for image replace
function showImageReplaceNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px 40px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        z-index: 99999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: fadeInOut 1s ease-in-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 1000);
}

// ============================================
// COLOR PICKER MODE - Eyedropper Tool
// ============================================

// Toggle color picker mode
function toggleColorPickerMode() {
    if (colorPickerMode) {
        deactivateColorPickerMode();
    } else {
        activateColorPickerMode();
    }
}

// Activate color picker mode
async function activateColorPickerMode() {
    if (!colorPickerShortcut) {
        console.warn('⚠️ Color picker shortcut not set! Please set a shortcut from the popup.');
        showColorPickerNotification('⚠️ Please set a shortcut from the popup first', 'error');
        return;
    }
    
    colorPickerMode = true;
    
    // Create overlay with + cursor icon
    colorPickerOverlay = document.createElement('div');
    colorPickerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        cursor: crosshair;
        z-index: 999999998;
    `;
    
    // Create color picker UI panel with + icon
    colorPickerUI = document.createElement('div');
    colorPickerUI.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 999999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 280px;
            backdrop-filter: blur(10px);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 28px;">🎨</span>
                    <span style="font-size: 18px; font-weight: 600;">Color Picker</span>
                </div>
                <button id="colorPickerCloseBtn" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    font-size: 20px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    font-weight: bold;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
            </div>
            
            <div style="
                background: rgba(255,255,255,0.15);
                padding: 16px;
                border-radius: 12px;
                margin-bottom: 12px;
                text-align: center;
            ">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Selected Color</div>
                <div id="colorPreview" style="
                    width: 100%;
                    height: 60px;
                    background: #ffffff;
                    border-radius: 8px;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    border: 3px solid rgba(255,255,255,0.3);
                "></div>
                <div id="colorValue" style="
                    font-size: 20px;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    letter-spacing: 1px;
                ">#FFFFFF</div>
                <div id="colorRGB" style="
                    font-size: 12px;
                    opacity: 0.8;
                    margin-top: 4px;
                ">RGB(255, 255, 255)</div>
            </div>
            
            <button id="pickColorBtn" style="
                width: 100%;
                padding: 14px;
                background: rgba(255,255,255,0.25);
                border: 2px solid rgba(255,255,255,0.4);
                color: white;
                font-size: 15px;
                font-weight: 600;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-bottom: 8px;
            " onmouseover="this.style.background='rgba(255,255,255,0.35)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.25)'; this.style.transform='translateY(0)'">
                <span style="font-size: 20px;">➕</span>
                <span>Pick Color from Screen</span>
            </button>
            
            <button id="copyColorBtn" style="
                width: 100%;
                padding: 12px;
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 14px;
                font-weight: 500;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                📋 Copy Color Code
            </button>
            
            <div style="
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255,255,255,0.2);
                font-size: 12px;
                opacity: 0.8;
                text-align: center;
            ">
                Press <strong>ESC</strong> to close
            </div>
        </div>
    `;
    
    document.body.appendChild(colorPickerOverlay);
    document.body.appendChild(colorPickerUI);
    
    // Add event listeners
    const pickColorBtn = document.getElementById('pickColorBtn');
    const copyColorBtn = document.getElementById('copyColorBtn');
    const closeBtn = document.getElementById('colorPickerCloseBtn');
    
    pickColorBtn.addEventListener('click', pickColorWithEyedropper);
    copyColorBtn.addEventListener('click', copyColorToClipboard);
    closeBtn.addEventListener('click', deactivateColorPickerMode);
    
    // ESC key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            deactivateColorPickerMode();
        }
    };
    colorPickerOverlay._escHandler = escHandler;
    document.addEventListener('keydown', escHandler);
    
    // Automatically start color picking
    setTimeout(() => {
        pickColorWithEyedropper();
    }, 100);
}

// Deactivate color picker mode
function deactivateColorPickerMode() {
    colorPickerMode = false;
    
    if (colorPickerOverlay) {
        // Remove ESC key listener
        if (colorPickerOverlay._escHandler) {
            document.removeEventListener('keydown', colorPickerOverlay._escHandler);
        }
        colorPickerOverlay.remove();
        colorPickerOverlay = null;
    }
    
    if (colorPickerUI) {
        colorPickerUI.remove();
        colorPickerUI = null;
    }
}

// Pick color using EyeDropper API
async function pickColorWithEyedropper() {
    try {
        // Check if EyeDropper API is supported
        if (!window.EyeDropper) {
            // Fallback: Use canvas-based color picking for PDFs and unsupported browsers
            await pickColorFromCanvas();
            return;
        }
        
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        
        if (result && result.sRGBHex) {
            updateColorDisplay(result.sRGBHex);
            // Otomatik clipboard'a kopyala
            try {
                await navigator.clipboard.writeText(result.sRGBHex);
                showColorPickerNotification('✓ Color copied to clipboard!', 'success', 1500);
            } catch (error) {
                console.error('Failed to copy color:', error);
                showColorPickerNotification('✓ Color picked successfully!', 'success', 1500);
            }
            // Reset cursor to default after picking
            if (colorPickerOverlay) {
                colorPickerOverlay.style.cursor = 'default';
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('EyeDropper error:', error);
            // Try canvas fallback
            await pickColorFromCanvas();
        }
    }
}

// Fallback: Canvas-based color picking (works with PDFs and all content)
async function pickColorFromCanvas() {
    return new Promise((resolve, reject) => {
        showColorPickerNotification('📍 Click anywhere to pick color', 'info');
        
        // Create a temporary handler for clicking
        const clickHandler = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // Capture the entire screen using screenshot
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size to viewport
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                
                // Use html2canvas or capture via tab capture API
                // For now, we'll use a different approach: capture from the clicked element
                const x = e.clientX;
                const y = e.clientY;
                
                // Try to get color from element at point
                const element = document.elementFromPoint(x, y);
                if (element) {
                    const color = getColorAtPoint(element, x, y);
                    if (color) {
                        updateColorDisplay(color);
                        // Otomatik clipboard'a kopyala
                        try {
                            await navigator.clipboard.writeText(color);
                            showColorPickerNotification('✓ Color copied to clipboard!', 'success', 1500);
                        } catch (error) {
                            console.error('Failed to copy color:', error);
                            showColorPickerNotification('✓ Color picked successfully!', 'success', 1500);
                        }
                        // Reset cursor to default after picking
                        if (colorPickerOverlay) {
                            colorPickerOverlay.style.cursor = 'default';
                        }
                    }
                }
                
                // Remove the click handler
                colorPickerOverlay.removeEventListener('click', clickHandler);
                resolve();
            } catch (error) {
                console.error('Canvas color pick error:', error);
                showColorPickerNotification('❌ Failed to pick color', 'error');
                colorPickerOverlay.removeEventListener('click', clickHandler);
                reject(error);
            }
        };
        
        // Add click listener to overlay
        if (colorPickerOverlay) {
            colorPickerOverlay.addEventListener('click', clickHandler, { once: true });
        }
    });
}

// Get color at specific point from element
function getColorAtPoint(element, x, y) {
    try {
        // Try to get computed background color
        const computedStyle = window.getComputedStyle(element);
        let color = computedStyle.backgroundColor;
        
        // If transparent or rgba(0,0,0,0), try parent elements
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
                const parentStyle = window.getComputedStyle(parent);
                color = parentStyle.backgroundColor;
                if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                    break;
                }
                parent = parent.parentElement;
            }
        }
        
        // Try to get color from image if element is an image
        if (element.tagName === 'IMG' || computedStyle.backgroundImage !== 'none') {
            // For images, we need to use canvas to get pixel color
            return getColorFromImage(element, x, y);
        }
        
        // Convert rgb/rgba to hex
        if (color && color.startsWith('rgb')) {
            return rgbToHex(color);
        }
        
        return color || '#FFFFFF';
    } catch (error) {
        console.error('Error getting color:', error);
        return '#FFFFFF';
    }
}

// Get color from image element
function getColorFromImage(element, x, y) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let img;
        if (element.tagName === 'IMG') {
            img = element;
        } else {
            // Try to get background image
            const bgImage = window.getComputedStyle(element).backgroundImage;
            const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch) {
                img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = urlMatch[1];
            }
        }
        
        if (img && img.complete) {
            const rect = element.getBoundingClientRect();
            const relX = x - rect.left;
            const relY = y - rect.top;
            
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            ctx.drawImage(img, 0, 0);
            
            // Calculate position on the image
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const pixelX = Math.floor(relX * scaleX);
            const pixelY = Math.floor(relY * scaleY);
            
            const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
            return `#${componentToHex(pixel[0])}${componentToHex(pixel[1])}${componentToHex(pixel[2])}`;
        }
    } catch (error) {
        console.error('Error getting color from image:', error);
    }
    
    return null;
}

// Convert RGB to Hex
function rgbToHex(rgb) {
    const match = rgb.match(/\d+/g);
    if (match && match.length >= 3) {
        const r = parseInt(match[0]);
        const g = parseInt(match[1]);
        const b = parseInt(match[2]);
        return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
    }
    return '#000000';
}

// Convert color component to hex
function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

// Hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Update color display in UI
function updateColorDisplay(hexColor) {
    const colorPreview = document.getElementById('colorPreview');
    const colorValue = document.getElementById('colorValue');
    const colorRGB = document.getElementById('colorRGB');
    
    if (colorPreview && colorValue && colorRGB) {
        colorPreview.style.background = hexColor;
        colorValue.textContent = hexColor.toUpperCase();
        
        const rgb = hexToRgb(hexColor);
        if (rgb) {
            colorRGB.textContent = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
    }
}

// Copy color to clipboard
async function copyColorToClipboard() {
    const colorValue = document.getElementById('colorValue');
    if (!colorValue) return;
    
    const color = colorValue.textContent;
    
    try {
        await navigator.clipboard.writeText(color);
        showColorPickerNotification('✓ Color copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy color:', error);
        // Fallback method
        const textarea = document.createElement('textarea');
        textarea.value = color;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showColorPickerNotification('✓ Color copied to clipboard!', 'success');
    }
}

// Show notification for color picker
function showColorPickerNotification(message, type, duration = 1000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px 40px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        z-index: 999999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// ============================================
// IMAGE EDITOR - Photoshop-like Pro Editor
// ============================================

// Load saved settings
async function loadEditorSettings() {
    return new Promise((resolve) => {
        try {
            if (isChromeContextValid() && chrome.storage) {
                chrome.storage.local.get([IMAGE_EDITOR_SETTINGS_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                        return;
                    }
                    resolve(result[IMAGE_EDITOR_SETTINGS_KEY] || null);
                });
            } else {
                try {
                    const saved = localStorage.getItem(IMAGE_EDITOR_SETTINGS_KEY);
                    resolve(saved ? JSON.parse(saved) : null);
                } catch (e) {
                    resolve(null);
                }
            }
        } catch (e) {
            resolve(null);
        }
    });
}

// Save editor settings
async function saveEditorSettings(settings) {
    return new Promise((resolve) => {
        try {
            if (isChromeContextValid() && chrome.storage) {
                chrome.storage.local.set({ [IMAGE_EDITOR_SETTINGS_KEY]: settings }, () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                    resolve();
                });
            } else {
                try {
                    localStorage.setItem(IMAGE_EDITOR_SETTINGS_KEY, JSON.stringify(settings));
                } catch (e) { /* ignore */ }
                resolve();
            }
        } catch (e) {
            resolve();
        }
    });
}

// Clear editor settings
async function clearEditorSettings() {
    return new Promise((resolve) => {
        try {
            if (isChromeContextValid() && chrome.storage) {
                chrome.storage.local.remove([IMAGE_EDITOR_SETTINGS_KEY], () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                    resolve();
                });
            } else {
                try {
                    localStorage.removeItem(IMAGE_EDITOR_SETTINGS_KEY);
                } catch (e) { /* ignore */ }
                resolve();
            }
        } catch (e) {
            resolve();
        }
    });
}

// Open Image Editor
async function openImageEditor(blob, format) {
    const savedSettings = await loadEditorSettings();
    
    return new Promise((resolve) => {
        // Create editor modal
        const editor = document.createElement('div');
        editor.id = 'image-pro-editor';
        editor.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            z-index: 9999999;
            animation: editorFadeIn 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Add editor styles
        const editorStyles = document.createElement('style');
        editorStyles.id = 'image-editor-styles';
        editorStyles.textContent = `
            @keyframes editorFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from { 
                    transform: translateX(400px);
                    opacity: 0;
                }
                to { 
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from { 
                    transform: translateX(0);
                    opacity: 1;
                }
                to { 
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
            
            .editor-panel {
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
                color: #e4e4e4;
            }
            
            .editor-btn {
                padding: 10px 16px;
                font-size: 13px;
                font-weight: 500;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                font-family: inherit;
            }
            
            .editor-btn:hover:not(:disabled) {
                transform: translateY(-1px);
            }
            
            .editor-btn:disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }
            
            .editor-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .editor-btn-primary:hover {
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }
            
            .editor-btn-success {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
            }
            
            .editor-btn-success:hover {
                box-shadow: 0 4px 15px rgba(56, 239, 125, 0.4);
            }
            
            .editor-btn-danger {
                background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
                color: white;
            }
            
            .editor-btn-danger:hover {
                box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            }
            
            .editor-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #e4e4e4;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .editor-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .editor-input {
                padding: 8px 12px;
                font-size: 13px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                background: rgba(0, 0, 0, 0.3);
                color: #e4e4e4;
                outline: none;
                transition: border-color 0.2s;
                font-family: inherit;
            }
            
            .editor-input:focus {
                border-color: #667eea;
            }
            
            .editor-label {
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 4px;
                display: block;
            }
            
            .editor-section {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 16px;
            }
            
            .editor-section-title {
                font-size: 14px;
                font-weight: 600;
                color: #e4e4e4;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .editor-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #667eea;
            }
            
            .editor-range {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: rgba(255, 255, 255, 0.1);
                outline: none;
                -webkit-appearance: none;
            }
            
            .editor-range::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            }
            
            .crop-handle {
                position: absolute;
                width: 12px;
                height: 12px;
                background: #667eea;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .crop-overlay {
                position: absolute;
                background: rgba(0, 0, 0, 0.5);
                pointer-events: none;
            }
            
            .info-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: rgba(102, 126, 234, 0.2);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 20px;
                font-size: 12px;
                color: #a5b4fc;
            }
            
            .tab-btn {
                padding: 10px 20px;
                font-size: 13px;
                font-weight: 500;
                border: none;
                background: transparent;
                color: #9ca3af;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            }
            
            .tab-btn:hover {
                color: #e4e4e4;
            }
            
            .tab-btn.active {
                color: #667eea;
                border-bottom-color: #667eea;
            }
            
            .preset-btn {
                padding: 8px 14px;
                font-size: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #e4e4e4;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .preset-btn:hover {
                background: rgba(102, 126, 234, 0.2);
                border-color: #667eea;
            }
            
            .preset-btn.active {
                background: rgba(102, 126, 234, 0.3);
                border-color: #667eea;
            }
        `;
        document.head.appendChild(editorStyles);

        // State variables
        let originalImage = null;
        let currentImage = null;
        let cropMode = false;
        let cropData = { x: 0, y: 0, width: 0, height: 0 };
        let isDragging = false;
        let dragHandle = null;
        let dragStart = { x: 0, y: 0 };
        
        // Undo history
        let history = [];
        const MAX_HISTORY = 20;
        let activePreset = null;
        let activeRatio = 'free';
        
        // Settings
        let settings = savedSettings || {
            width: 0,
            height: 0,
            maintainAspectRatio: true,
            outputFormat: format,
            quality: 90
        };

        // Layout
        editor.innerHTML = `
            <div class="editor-panel" style="width: 300px; height: 100%; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.1);">
                <!-- Header -->
                <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">✏️</span> Image Editor
                    </h2>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">Professional editing tools</p>
                </div>
                
                <!-- Image Info -->
                <div style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <span class="info-badge" id="editor-resolution">📐 --x--</span>
                        <span class="info-badge" id="editor-filesize">💾 -- KB</span>
                        <span class="info-badge" id="editor-format">🖼️ ${format.toUpperCase()}</span>
                    </div>
                </div>
                
                <!-- Tools Panel -->
                <div style="flex: 1; overflow-y: auto; padding: 16px;">
                    <!-- Resize Section -->
                    <div class="editor-section">
                        <div class="editor-section-title">
                            <span>📏</span> Resize
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label class="editor-label">Width (px)</label>
                                <input type="number" id="resize-width" class="editor-input" style="width: 100%;" min="1" max="10000">
                            </div>
                            <div>
                                <label class="editor-label">Height (px)</label>
                                <input type="number" id="resize-height" class="editor-input" style="width: 100%;" min="1" max="10000">
                            </div>
                        </div>
                        <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="maintain-ratio" class="editor-checkbox" ${settings.maintainAspectRatio ? 'checked' : ''}>
                            <label for="maintain-ratio" style="font-size: 13px; cursor: pointer;">🔗 Maintain aspect ratio</label>
                        </div>
                        <div style="margin-top: 12px;">
                            <label class="editor-label">Quick Presets</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                                <button class="preset-btn" data-preset="50">50%</button>
                                <button class="preset-btn" data-preset="75">75%</button>
                                <button class="preset-btn" data-preset="100">100%</button>
                                <button class="preset-btn" data-preset="150">150%</button>
                                <button class="preset-btn" data-preset="200">200%</button>
                            </div>
                        </div>
                        <div style="margin-top: 12px;">
                            <label class="editor-label">Custom Size (W:H or single value)</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="custom-resize-ratio" class="editor-input" placeholder="e.g. 800:600 or 1920" style="flex: 1;">
                                <button class="editor-btn editor-btn-secondary" id="apply-custom-resize" style="padding: 8px 12px; white-space: nowrap;">
                                    ✓
                                </button>
                            </div>
                            <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Enter width:height, width only, or scale (2x)</p>
                        </div>
                        <button class="editor-btn editor-btn-primary" id="apply-resize" style="width: 100%; margin-top: 12px; justify-content: center;">
                            ✓ Apply Resize
                        </button>
                    </div>
                    
                    <!-- Crop Section -->
                    <div class="editor-section">
                        <div class="editor-section-title">
                            <span>✂️</span> Crop
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                            <button class="preset-btn" data-ratio="free">Free</button>
                            <button class="preset-btn" data-ratio="1:1">1:1</button>
                            <button class="preset-btn" data-ratio="4:3">4:3</button>
                            <button class="preset-btn" data-ratio="16:9">16:9</button>
                            <button class="preset-btn" data-ratio="3:2">3:2</button>
                            <button class="preset-btn" data-ratio="2:3">2:3</button>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label class="editor-label">Custom Ratio (W:H)</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="custom-crop-ratio" class="editor-input" placeholder="e.g. 21:9 or 5:4" style="flex: 1;">
                                <button class="editor-btn editor-btn-secondary" id="apply-custom-crop-ratio" style="padding: 8px 12px; white-space: nowrap;">
                                    ✓
                                </button>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div>
                                <label class="editor-label">X</label>
                                <input type="number" id="crop-x" class="editor-input" style="width: 100%;" min="0">
                            </div>
                            <div>
                                <label class="editor-label">Y</label>
                                <input type="number" id="crop-y" class="editor-input" style="width: 100%;" min="0">
                            </div>
                            <div>
                                <label class="editor-label">Width</label>
                                <input type="number" id="crop-width" class="editor-input" style="width: 100%;" min="1">
                            </div>
                            <div>
                                <label class="editor-label">Height</label>
                                <input type="number" id="crop-height" class="editor-input" style="width: 100%;" min="1">
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button class="editor-btn editor-btn-secondary" id="toggle-crop" style="flex: 1; justify-content: center;">
                                ✂️ Select Area
                            </button>
                            <button class="editor-btn editor-btn-primary" id="apply-crop" style="flex: 1; justify-content: center;">
                                ✓ Apply Crop
                            </button>
                        </div>
                    </div>
                    
                    <!-- Output Settings -->
                    <div class="editor-section">
                        <div class="editor-section-title">
                            <span>⚙️</span> Output Settings
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label class="editor-label">Format</label>
                            <select id="output-format" class="editor-input" style="width: 100%;">
                                <option value="png" ${format === 'png' ? 'selected' : ''}>PNG (Lossless)</option>
                                <option value="jpeg" ${format === 'jpeg' ? 'selected' : ''}>JPEG (Compressed)</option>
                                <option value="webp" ${format === 'webp' ? 'selected' : ''}>WebP (Modern)</option>
                            </select>
                        </div>
                        <div id="quality-container" style="${format === 'png' ? 'display: none;' : ''}">
                            <label class="editor-label">Quality: <span id="quality-value">${settings.quality}%</span></label>
                            <input type="range" id="output-quality" class="editor-range" min="10" max="100" value="${settings.quality}">
                        </div>
                    </div>
                    
                    <!-- Saved Settings -->
                    <div class="editor-section" id="saved-settings-section" style="${savedSettings ? '' : 'display: none;'}">
                        <div class="editor-section-title">
                            <span>💾</span> Last Used Settings
                        </div>
                        <p style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">
                            ${savedSettings ? `${savedSettings.width}x${savedSettings.height}, ${savedSettings.outputFormat.toUpperCase()}, ${savedSettings.quality}%` : ''}
                        </p>
                        <div style="display: flex; gap: 8px;">
                            <button class="editor-btn editor-btn-secondary" id="apply-saved" style="flex: 1; justify-content: center;">
                                ↩️ Apply
                            </button>
                            <button class="editor-btn editor-btn-danger" id="clear-saved" style="flex: 1; justify-content: center;">
                                🗑️ Clear
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Footer Actions -->
                <div style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 8px;">
                    <button class="editor-btn editor-btn-secondary" id="undo-btn" style="justify-content: center;" disabled>
                        ↶ Undo <span id="undo-count" style="opacity: 0.6; margin-left: 4px;">(0)</span>
                    </button>
                    <button class="editor-btn editor-btn-secondary" id="reset-btn" style="justify-content: center;">
                        ↺ Reset to Original
                    </button>
                </div>
            </div>
            
            <!-- Canvas Area -->
            <div style="flex: 1; display: flex; flex-direction: column; background: #0d0d0d;">
                <!-- Top Bar -->
                <div style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <button class="editor-btn editor-btn-secondary" id="undo-top-btn" title="Undo (Ctrl+Z)" disabled style="padding: 10px 12px;">
                            ↶
                        </button>
                        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.2);"></div>
                        <button class="editor-btn editor-btn-secondary" id="zoom-out">➖</button>
                        <span id="zoom-level" style="color: #e4e4e4; display: flex; align-items: center;">100%</span>
                        <button class="editor-btn editor-btn-secondary" id="zoom-in">➕</button>
                        <button class="editor-btn editor-btn-secondary" id="zoom-fit">Fit</button>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="editor-btn editor-btn-secondary" id="download-image" title="Download edited image">
                            ⬇️ Download
                        </button>
                        <button class="editor-btn editor-btn-secondary" id="copy-to-clipboard" title="Copy edited image to clipboard">
                            📋 Copy
                        </button>
                        <button class="editor-btn editor-btn-success" id="copy-edited">
                            ✓ Use Edited Image
                        </button>
                        <button class="editor-btn editor-btn-primary" id="copy-original">
                            📋 Use Original
                        </button>
                        <button class="editor-btn editor-btn-danger" id="close-editor">
                            ✕ Cancel
                        </button>
                    </div>
                </div>
                
                <!-- Canvas Container -->
                <div id="canvas-container" style="flex: 1; overflow: auto; padding: 20px; position: relative;">
                    <div style="min-height: 100%; display: flex; align-items: center; justify-content: center;">
                        <div id="canvas-wrapper" style="position: relative; line-height: 0;">
                            <canvas id="editor-canvas" style="display: block; box-shadow: 0 4px 20px rgba(0,0,0,0.5); max-width: none;"></canvas>
                            <div id="crop-overlay-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; pointer-events: none;">
                                <div id="crop-selection" style="position: absolute; border: 2px dashed #667eea; background: rgba(102, 126, 234, 0.1); pointer-events: auto; cursor: move;"></div>
                                <div class="crop-handle" id="handle-nw" style="top: -6px; left: -6px; cursor: nw-resize;"></div>
                                <div class="crop-handle" id="handle-ne" style="top: -6px; right: -6px; cursor: ne-resize;"></div>
                                <div class="crop-handle" id="handle-sw" style="bottom: -6px; left: -6px; cursor: sw-resize;"></div>
                                <div class="crop-handle" id="handle-se" style="bottom: -6px; right: -6px; cursor: se-resize;"></div>
                                <div class="crop-handle" id="handle-n" style="top: -6px; left: 50%; transform: translateX(-50%); cursor: n-resize;"></div>
                                <div class="crop-handle" id="handle-s" style="bottom: -6px; left: 50%; transform: translateX(-50%); cursor: s-resize;"></div>
                                <div class="crop-handle" id="handle-w" style="top: 50%; left: -6px; transform: translateY(-50%); cursor: w-resize;"></div>
                                <div class="crop-handle" id="handle-e" style="top: 50%; right: -6px; transform: translateY(-50%); cursor: e-resize;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(editor);

        // Get elements
        const canvas = editor.querySelector('#editor-canvas');
        const ctx = canvas.getContext('2d');
        const canvasWrapper = editor.querySelector('#canvas-wrapper');
        const cropOverlayContainer = editor.querySelector('#crop-overlay-container');
        const cropSelection = editor.querySelector('#crop-selection');
        
        // Zoom state
        let zoom = 1;
        
        // Load image
        const img = new Image();
        const imageUrl = URL.createObjectURL(blob);
        
        img.onload = () => {
            originalImage = img;
            currentImage = img;
            
            // Set initial dimensions
            settings.width = img.width;
            settings.height = img.height;
            
            // Update UI
            updateImageInfo();
            drawImage();
            updateResizeInputs();
            initCropArea();
            
            // Set default ratio selection
            updateRatioSelection('free');
            
            // Initialize undo buttons state
            updateUndoButtons();
            
            // Auto-fit large images to viewport
            setTimeout(() => {
                const container = editor.querySelector('#canvas-container');
                const containerWidth = container.clientWidth - 40;
                const containerHeight = container.clientHeight - 40;
                
                const scaleX = containerWidth / currentImage.width;
                const scaleY = containerHeight / currentImage.height;
                const fitZoom = Math.min(scaleX, scaleY, 1);
                
                // Only apply zoom if image is larger than viewport
                if (fitZoom < 1) {
                    zoom = fitZoom;
                    canvas.style.transform = `scale(${zoom})`;
                    editor.querySelector('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
                }
            }, 50);
        };
        img.src = imageUrl;
        
        // Update image info display
        function updateImageInfo() {
            const w = getImageWidth();
            const h = getImageHeight();
            editor.querySelector('#editor-resolution').textContent = `📐 ${w}x${h}`;
            
            // Calculate estimated file size
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(currentImage, 0, 0);
            
            tempCanvas.toBlob((b) => {
                if (b) {
                    const sizeKB = (b.size / 1024).toFixed(1);
                    editor.querySelector('#editor-filesize').textContent = `💾 ${sizeKB} KB`;
                }
            }, `image/${settings.outputFormat}`, settings.quality / 100);
        }
        
        // Save state to history
        function saveToHistory() {
            // Create a copy of current image
            const w = getImageWidth();
            const h = getImageHeight();
            
            const historyCanvas = document.createElement('canvas');
            historyCanvas.width = w;
            historyCanvas.height = h;
            const historyCtx = historyCanvas.getContext('2d');
            historyCtx.drawImage(currentImage, 0, 0);
            
            const dataUrl = historyCanvas.toDataURL('image/png');
            
            history.push({
                dataUrl: dataUrl,
                width: w,
                height: h
            });
            
            console.log('History saved, count:', history.length, 'dimensions:', w, 'x', h);
            
            // Limit history size
            if (history.length > MAX_HISTORY) {
                history.shift();
            }
            
            updateUndoButtons();
        }
        
        // Undo last action
        function undo() {
            console.log('Undo called, history length:', history.length);
            if (history.length === 0) return;
            
            const lastState = history.pop();
            console.log('Restoring state:', lastState.width, 'x', lastState.height);
            
            const undoImg = new Image();
            undoImg.onload = () => {
                currentImage = undoImg;
                settings.width = lastState.width;
                settings.height = lastState.height;
                drawImage();
                updateImageInfo();
                updateResizeInputs();
                initCropArea();
                updateUndoButtons();
                clearPresetSelection();
                console.log('Undo completed');
            };
            undoImg.onerror = (err) => {
                console.error('Undo image load error:', err);
            };
            undoImg.src = lastState.dataUrl;
        }
        
        // Update undo buttons state
        function updateUndoButtons() {
            const undoBtn = editor.querySelector('#undo-btn');
            const undoTopBtn = editor.querySelector('#undo-top-btn');
            const undoCount = editor.querySelector('#undo-count');
            
            const hasHistory = history.length > 0;
            
            undoBtn.disabled = !hasHistory;
            undoTopBtn.disabled = !hasHistory;
            undoCount.textContent = `(${history.length})`;
            
            if (hasHistory) {
                undoBtn.style.opacity = '1';
                undoTopBtn.style.opacity = '1';
            } else {
                undoBtn.style.opacity = '0.5';
                undoTopBtn.style.opacity = '0.5';
            }
        }
        
        // Clear preset selection
        function clearPresetSelection() {
            editor.querySelectorAll('[data-preset]').forEach(btn => btn.classList.remove('active'));
            activePreset = null;
        }
        
        // Update preset selection
        function updatePresetSelection(preset) {
            editor.querySelectorAll('[data-preset]').forEach(btn => {
                if (btn.dataset.preset === String(preset)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            activePreset = preset;
        }
        
        // Update ratio selection
        function updateRatioSelection(ratio) {
            editor.querySelectorAll('[data-ratio]').forEach(btn => {
                if (btn.dataset.ratio === ratio) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            activeRatio = ratio;
        }
        
        // Get image dimensions helper (handles both Image and canvas-created images)
        function getImageWidth() {
            return currentImage.naturalWidth || currentImage.width || settings.width;
        }
        
        function getImageHeight() {
            return currentImage.naturalHeight || currentImage.height || settings.height;
        }
        
        // Draw image on canvas
        function drawImage() {
            const w = getImageWidth();
            const h = getImageHeight();
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(currentImage, 0, 0);
            
            // Apply zoom
            canvas.style.transform = `scale(${zoom})`;
            canvas.style.transformOrigin = 'top left';
            
            // Update wrapper size to match scaled canvas
            canvasWrapper.style.width = `${w * zoom}px`;
            canvasWrapper.style.height = `${h * zoom}px`;
        }
        
        // Update resize inputs
        function updateResizeInputs() {
            editor.querySelector('#resize-width').value = settings.width;
            editor.querySelector('#resize-height').value = settings.height;
        }
        
        // Initialize crop area
        function initCropArea() {
            cropData = {
                x: 0,
                y: 0,
                width: getImageWidth(),
                height: getImageHeight()
            };
            updateCropInputs();
        }
        
        // Update crop inputs
        function updateCropInputs() {
            editor.querySelector('#crop-x').value = Math.round(cropData.x);
            editor.querySelector('#crop-y').value = Math.round(cropData.y);
            editor.querySelector('#crop-width').value = Math.round(cropData.width);
            editor.querySelector('#crop-height').value = Math.round(cropData.height);
        }
        
        // Update crop selection visual
        function updateCropSelection() {
            const scaleX = canvas.offsetWidth / currentImage.width;
            const scaleY = canvas.offsetHeight / currentImage.height;
            
            cropSelection.style.left = `${cropData.x * scaleX}px`;
            cropSelection.style.top = `${cropData.y * scaleY}px`;
            cropSelection.style.width = `${cropData.width * scaleX}px`;
            cropSelection.style.height = `${cropData.height * scaleY}px`;
            
            // Update handles
            const handles = cropOverlayContainer.querySelectorAll('.crop-handle');
            handles.forEach(handle => {
                if (handle.id.includes('nw')) {
                    handle.style.left = `${cropData.x * scaleX - 6}px`;
                    handle.style.top = `${cropData.y * scaleY - 6}px`;
                } else if (handle.id.includes('ne')) {
                    handle.style.left = `${(cropData.x + cropData.width) * scaleX - 6}px`;
                    handle.style.top = `${cropData.y * scaleY - 6}px`;
                } else if (handle.id.includes('sw')) {
                    handle.style.left = `${cropData.x * scaleX - 6}px`;
                    handle.style.top = `${(cropData.y + cropData.height) * scaleY - 6}px`;
                } else if (handle.id.includes('se')) {
                    handle.style.left = `${(cropData.x + cropData.width) * scaleX - 6}px`;
                    handle.style.top = `${(cropData.y + cropData.height) * scaleY - 6}px`;
                } else if (handle.id === 'handle-n') {
                    handle.style.left = `${(cropData.x + cropData.width / 2) * scaleX - 6}px`;
                    handle.style.top = `${cropData.y * scaleY - 6}px`;
                } else if (handle.id === 'handle-s') {
                    handle.style.left = `${(cropData.x + cropData.width / 2) * scaleX - 6}px`;
                    handle.style.top = `${(cropData.y + cropData.height) * scaleY - 6}px`;
                } else if (handle.id === 'handle-w') {
                    handle.style.left = `${cropData.x * scaleX - 6}px`;
                    handle.style.top = `${(cropData.y + cropData.height / 2) * scaleY - 6}px`;
                } else if (handle.id === 'handle-e') {
                    handle.style.left = `${(cropData.x + cropData.width) * scaleX - 6}px`;
                    handle.style.top = `${(cropData.y + cropData.height / 2) * scaleY - 6}px`;
                }
            });
        }
        
        // Resize image
        function resizeImage(width, height) {
            // Save current state to history before resize
            saveToHistory();
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Use better quality scaling
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(currentImage, 0, 0, width, height);
            
            // Create new image
            const newImg = new Image();
            newImg.onload = () => {
                currentImage = newImg;
                settings.width = width;
                settings.height = height;
                drawImage();
                updateImageInfo();
                initCropArea();
            };
            newImg.src = tempCanvas.toDataURL('image/png');
        }
        
        // Crop image
        function cropImage() {
            // Save current state to history before crop
            saveToHistory();
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cropData.width;
            tempCanvas.height = cropData.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.drawImage(
                currentImage,
                cropData.x, cropData.y, cropData.width, cropData.height,
                0, 0, cropData.width, cropData.height
            );
            
            const newImg = new Image();
            newImg.onload = () => {
                currentImage = newImg;
                settings.width = cropData.width;
                settings.height = cropData.height;
                drawImage();
                updateImageInfo();
                updateResizeInputs();
                initCropArea();
                
                // Exit crop mode
                cropMode = false;
                cropOverlayContainer.style.display = 'none';
                editor.querySelector('#toggle-crop').textContent = '✂️ Select Area';
            };
            newImg.src = tempCanvas.toDataURL('image/png');
        }
        
        // Export image
        async function exportImage(useEdited = true) {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = currentImage.width;
            exportCanvas.height = currentImage.height;
            const exportCtx = exportCanvas.getContext('2d');
            
            if (useEdited) {
                exportCtx.drawImage(currentImage, 0, 0);
            } else {
                exportCtx.drawImage(originalImage, 0, 0);
            }
            
            const mimeType = `image/${settings.outputFormat}`;
            const quality = (settings.outputFormat === 'jpeg' || settings.outputFormat === 'webp') 
                ? settings.quality / 100 
                : undefined;
            
            return new Promise((res) => {
                exportCanvas.toBlob((b) => {
                    res(b);
                }, mimeType, quality);
            });
        }
        
        // Event Listeners
        
        // Resize width input
        const widthInput = editor.querySelector('#resize-width');
        const heightInput = editor.querySelector('#resize-height');
        const maintainRatioCheckbox = editor.querySelector('#maintain-ratio');
        
        let aspectRatio = 1;
        
        widthInput.addEventListener('input', () => {
            if (maintainRatioCheckbox.checked && originalImage) {
                aspectRatio = originalImage.width / originalImage.height;
                heightInput.value = Math.round(widthInput.value / aspectRatio);
            }
            settings.width = parseInt(widthInput.value) || 1;
            settings.height = parseInt(heightInput.value) || 1;
        });
        
        heightInput.addEventListener('input', () => {
            if (maintainRatioCheckbox.checked && originalImage) {
                aspectRatio = originalImage.width / originalImage.height;
                widthInput.value = Math.round(heightInput.value * aspectRatio);
            }
            settings.width = parseInt(widthInput.value) || 1;
            settings.height = parseInt(heightInput.value) || 1;
        });
        
        maintainRatioCheckbox.addEventListener('change', () => {
            settings.maintainAspectRatio = maintainRatioCheckbox.checked;
        });
        
        // Preset buttons
        editor.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = parseInt(btn.dataset.preset);
                const newWidth = Math.round(originalImage.width * preset / 100);
                const newHeight = Math.round(originalImage.height * preset / 100);
                widthInput.value = newWidth;
                heightInput.value = newHeight;
                settings.width = newWidth;
                settings.height = newHeight;
                updatePresetSelection(preset);
            });
        });
        
        // Custom resize ratio
        editor.querySelector('#apply-custom-resize').addEventListener('click', () => {
            const input = editor.querySelector('#custom-resize-ratio').value.trim();
            if (!input) return;
            
            clearPresetSelection();
            
            // Parse input: "800:600", "1920", or "2x"
            if (input.includes(':')) {
                // Width:Height format
                const [w, h] = input.split(':').map(s => parseInt(s.trim()));
                if (w > 0 && h > 0) {
                    widthInput.value = w;
                    heightInput.value = h;
                    settings.width = w;
                    settings.height = h;
                }
            } else if (input.toLowerCase().includes('x')) {
                // Scale format (e.g., "2x")
                const scale = parseFloat(input.replace(/x/i, ''));
                if (scale > 0) {
                    const newWidth = Math.round(originalImage.width * scale);
                    const newHeight = Math.round(originalImage.height * scale);
                    widthInput.value = newWidth;
                    heightInput.value = newHeight;
                    settings.width = newWidth;
                    settings.height = newHeight;
                }
            } else {
                // Single width value, maintain aspect ratio
                const w = parseInt(input);
                if (w > 0 && originalImage) {
                    const aspectRatio = originalImage.width / originalImage.height;
                    const h = Math.round(w / aspectRatio);
                    widthInput.value = w;
                    heightInput.value = h;
                    settings.width = w;
                    settings.height = h;
                }
            }
        });
        
        // Custom resize ratio - Enter key support
        editor.querySelector('#custom-resize-ratio').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                editor.querySelector('#apply-custom-resize').click();
            }
        });
        
        // Apply resize
        editor.querySelector('#apply-resize').addEventListener('click', () => {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            if (width > 0 && height > 0) {
                resizeImage(width, height);
            }
        });
        
        // Crop ratio presets
        let cropAspectRatio = null;
        
        editor.querySelectorAll('[data-ratio]').forEach(btn => {
            btn.addEventListener('click', () => {
                const ratio = btn.dataset.ratio;
                updateRatioSelection(ratio);
                
                if (ratio === 'free') {
                    cropAspectRatio = null;
                } else {
                    const [w, h] = ratio.split(':').map(Number);
                    cropAspectRatio = w / h;
                    
                    // Update crop area to match ratio
                    if (cropMode) {
                        const maxWidth = getImageWidth() - cropData.x;
                        const maxHeight = getImageHeight() - cropData.y;
                        
                        if (maxWidth / maxHeight > cropAspectRatio) {
                            cropData.height = maxHeight;
                            cropData.width = maxHeight * cropAspectRatio;
                        } else {
                            cropData.width = maxWidth;
                            cropData.height = maxWidth / cropAspectRatio;
                        }
                        
                        updateCropInputs();
                        updateCropSelection();
                    }
                }
            });
        });
        
        // Custom crop ratio
        editor.querySelector('#apply-custom-crop-ratio').addEventListener('click', () => {
            const input = editor.querySelector('#custom-crop-ratio').value.trim();
            if (!input) return;
            
            // Parse input: "21:9" format
            if (input.includes(':')) {
                const [w, h] = input.split(':').map(s => parseFloat(s.trim()));
                if (w > 0 && h > 0) {
                    cropAspectRatio = w / h;
                    updateRatioSelection('custom');
                    
                    // Apply to current crop area if in crop mode
                    if (cropMode) {
                        const maxWidth = getImageWidth() - cropData.x;
                        const maxHeight = getImageHeight() - cropData.y;
                        
                        if (maxWidth / maxHeight > cropAspectRatio) {
                            cropData.height = maxHeight;
                            cropData.width = maxHeight * cropAspectRatio;
                        } else {
                            cropData.width = maxWidth;
                            cropData.height = maxWidth / cropAspectRatio;
                        }
                        
                        updateCropInputs();
                        updateCropSelection();
                    }
                }
            } else {
                // Single number means square with that ratio (e.g., "2" = 2:1)
                const ratio = parseFloat(input);
                if (ratio > 0) {
                    cropAspectRatio = ratio;
                    updateRatioSelection('custom');
                    
                    if (cropMode) {
                        const maxWidth = getImageWidth() - cropData.x;
                        const maxHeight = getImageHeight() - cropData.y;
                        
                        if (maxWidth / maxHeight > cropAspectRatio) {
                            cropData.height = maxHeight;
                            cropData.width = maxHeight * cropAspectRatio;
                        } else {
                            cropData.width = maxWidth;
                            cropData.height = maxWidth / cropAspectRatio;
                        }
                        
                        updateCropInputs();
                        updateCropSelection();
                    }
                }
            }
        });
        
        // Custom crop ratio - Enter key support
        editor.querySelector('#custom-crop-ratio').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                editor.querySelector('#apply-custom-crop-ratio').click();
            }
        });
        
        // Toggle crop mode
        editor.querySelector('#toggle-crop').addEventListener('click', () => {
            cropMode = !cropMode;
            cropOverlayContainer.style.display = cropMode ? 'block' : 'none';
            editor.querySelector('#toggle-crop').textContent = cropMode ? '❌ Cancel Crop' : '✂️ Select Area';
            
            if (cropMode) {
                updateCropSelection();
            }
        });
        
        // Apply crop
        editor.querySelector('#apply-crop').addEventListener('click', () => {
            if (cropData.width > 0 && cropData.height > 0) {
                cropImage();
            }
        });
        
        // Crop input changes
        ['crop-x', 'crop-y', 'crop-width', 'crop-height'].forEach(id => {
            editor.querySelector(`#${id}`).addEventListener('input', (e) => {
                const key = id.replace('crop-', '');
                cropData[key] = parseInt(e.target.value) || 0;
                
                // Clamp values
                cropData.x = Math.max(0, Math.min(cropData.x, currentImage.width - 1));
                cropData.y = Math.max(0, Math.min(cropData.y, currentImage.height - 1));
                cropData.width = Math.max(1, Math.min(cropData.width, currentImage.width - cropData.x));
                cropData.height = Math.max(1, Math.min(cropData.height, currentImage.height - cropData.y));
                
                if (cropMode) {
                    updateCropSelection();
                }
            });
        });
        
        // Crop dragging
        cropSelection.addEventListener('mousedown', (e) => {
            if (e.target === cropSelection) {
                isDragging = true;
                dragHandle = 'move';
                dragStart = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });
        
        cropOverlayContainer.querySelectorAll('.crop-handle').forEach(handle => {
            handle.style.pointerEvents = 'auto';
            handle.addEventListener('mousedown', (e) => {
                isDragging = true;
                dragHandle = handle.id.replace('handle-', '');
                dragStart = { x: e.clientX, y: e.clientY };
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !cropMode) return;
            
            const scaleX = currentImage.width / canvas.offsetWidth;
            const scaleY = currentImage.height / canvas.offsetHeight;
            
            const dx = (e.clientX - dragStart.x) * scaleX;
            const dy = (e.clientY - dragStart.y) * scaleY;
            
            if (dragHandle === 'move') {
                cropData.x = Math.max(0, Math.min(cropData.x + dx, currentImage.width - cropData.width));
                cropData.y = Math.max(0, Math.min(cropData.y + dy, currentImage.height - cropData.height));
            } else {
                // Handle resize
                const oldData = { ...cropData };
                
                if (dragHandle.includes('w')) {
                    cropData.x += dx;
                    cropData.width -= dx;
                }
                if (dragHandle.includes('e')) {
                    cropData.width += dx;
                }
                if (dragHandle.includes('n')) {
                    cropData.y += dy;
                    cropData.height -= dy;
                }
                if (dragHandle.includes('s')) {
                    cropData.height += dy;
                }
                
                // Maintain aspect ratio if set
                if (cropAspectRatio) {
                    if (dragHandle.includes('e') || dragHandle.includes('w')) {
                        cropData.height = cropData.width / cropAspectRatio;
                    } else {
                        cropData.width = cropData.height * cropAspectRatio;
                    }
                }
                
                // Clamp values
                if (cropData.width < 10 || cropData.height < 10 ||
                    cropData.x < 0 || cropData.y < 0 ||
                    cropData.x + cropData.width > currentImage.width ||
                    cropData.y + cropData.height > currentImage.height) {
                    Object.assign(cropData, oldData);
                }
            }
            
            dragStart = { x: e.clientX, y: e.clientY };
            updateCropInputs();
            updateCropSelection();
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            dragHandle = null;
        });
        
        // Output format
        editor.querySelector('#output-format').addEventListener('change', (e) => {
            settings.outputFormat = e.target.value;
            const qualityContainer = editor.querySelector('#quality-container');
            qualityContainer.style.display = e.target.value === 'png' ? 'none' : 'block';
            editor.querySelector('#editor-format').textContent = `🖼️ ${e.target.value.toUpperCase()}`;
            updateImageInfo();
        });
        
        // Quality slider
        editor.querySelector('#output-quality').addEventListener('input', (e) => {
            settings.quality = parseInt(e.target.value);
            editor.querySelector('#quality-value').textContent = `${settings.quality}%`;
            updateImageInfo();
        });
        
        // Zoom controls
        editor.querySelector('#zoom-in').addEventListener('click', () => {
            zoom = Math.min(zoom + 0.25, 5);
            canvas.style.transform = `scale(${zoom})`;
            canvasWrapper.style.width = `${currentImage.width * zoom}px`;
            canvasWrapper.style.height = `${currentImage.height * zoom}px`;
            editor.querySelector('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
        });
        
        editor.querySelector('#zoom-out').addEventListener('click', () => {
            zoom = Math.max(zoom - 0.25, 0.25);
            canvas.style.transform = `scale(${zoom})`;
            canvasWrapper.style.width = `${currentImage.width * zoom}px`;
            canvasWrapper.style.height = `${currentImage.height * zoom}px`;
            editor.querySelector('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
        });
        
        editor.querySelector('#zoom-fit').addEventListener('click', () => {
            const container = editor.querySelector('#canvas-container');
            const containerWidth = container.clientWidth - 40;
            const containerHeight = container.clientHeight - 40;
            
            const scaleX = containerWidth / currentImage.width;
            const scaleY = containerHeight / currentImage.height;
            zoom = Math.min(scaleX, scaleY, 1);
            
            canvas.style.transform = `scale(${zoom})`;
            canvasWrapper.style.width = `${currentImage.width * zoom}px`;
            canvasWrapper.style.height = `${currentImage.height * zoom}px`;
            editor.querySelector('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
        });
        
        // Undo buttons
        editor.querySelector('#undo-btn').addEventListener('click', undo);
        editor.querySelector('#undo-top-btn').addEventListener('click', undo);
        
        // Keyboard shortcut for undo (Ctrl+Z)
        const undoKeyHandler = (e) => {
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
        };
        document.addEventListener('keydown', undoKeyHandler);
        
        // Keyboard shortcut for paste (Ctrl+V)
        const pasteKeyHandler = async (e) => {
            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                try {
                    if (!navigator.clipboard || !document.hasFocus()) {
                        return;
                    }
                    
                    const clipboardItems = await navigator.clipboard.read();
                    for (const item of clipboardItems) {
                        for (const type of item.types) {
                            if (type.startsWith('image/')) {
                                const blob = await item.getType(type);
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        // Save current state before replacing
                                        saveToHistory();
                                        
                                        // Replace current image
                                        currentImage = img;
                                        settings.width = img.naturalWidth;
                                        settings.height = img.naturalHeight;
                                        drawImage();
                                        updateImageInfo();
                                        updateResizeInputs();
                                        initCropArea();
                                        clearPresetSelection();
                                    };
                                    img.src = event.target.result;
                                };
                                reader.readAsDataURL(blob);
                                return;
                            }
                        }
                    }
                } catch (err) {
                    // Silently fail if clipboard is empty or access denied
                }
            }
        };
        document.addEventListener('keydown', pasteKeyHandler);
        
        // Reset button
        editor.querySelector('#reset-btn').addEventListener('click', () => {
            // Save current state before reset
            if (currentImage !== originalImage) {
                saveToHistory();
            }
            
            currentImage = originalImage;
            settings.width = originalImage.width;
            settings.height = originalImage.height;
            drawImage();
            updateImageInfo();
            updateResizeInputs();
            initCropArea();
            clearPresetSelection();
            updateRatioSelection('free');
        });
        
        // Saved settings
        editor.querySelector('#apply-saved').addEventListener('click', () => {
            if (savedSettings) {
                widthInput.value = savedSettings.width;
                heightInput.value = savedSettings.height;
                settings.width = savedSettings.width;
                settings.height = savedSettings.height;
                settings.outputFormat = savedSettings.outputFormat;
                settings.quality = savedSettings.quality;
                
                editor.querySelector('#output-format').value = savedSettings.outputFormat;
                editor.querySelector('#output-quality').value = savedSettings.quality;
                editor.querySelector('#quality-value').textContent = `${savedSettings.quality}%`;
                
                resizeImage(savedSettings.width, savedSettings.height);
            }
        });
        
        editor.querySelector('#clear-saved').addEventListener('click', async () => {
            await clearEditorSettings();
            editor.querySelector('#saved-settings-section').style.display = 'none';
        });
        
        // Copy to Clipboard button
        editor.querySelector('#copy-to-clipboard').addEventListener('click', async () => {
            try {
                const exportedBlob = await exportImage(true);
                
                // Copy to clipboard
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [exportedBlob.type]: exportedBlob
                    })
                ]);
                
                // Show success notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 1000000;
                    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                    color: white; padding: 16px 24px; border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    font-size: 14px; font-weight: 500;
                    animation: slideIn 0.3s ease-out;
                `;
                const extension = settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat;
                const qualityInfo = (settings.outputFormat === 'jpeg' || settings.outputFormat === 'webp') 
                    ? `-q${settings.quality}` 
                    : '';
                notification.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px;">✓</span>
                        <div>
                            <div style="font-weight: 600;">Copied to Clipboard!</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                                ${extension.toUpperCase()} • ${currentImage.width}x${currentImage.height}${qualityInfo ? ` • Quality ${settings.quality}%` : ''}
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
                
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                
                // Show error notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 1000000;
                    background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                    color: white; padding: 16px 24px; border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    font-size: 14px; font-weight: 500;
                    animation: slideIn 0.3s ease-out;
                `;
                notification.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px;">✕</span>
                        <div>
                            <div style="font-weight: 600;">Failed to copy!</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                                ${error.message}
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
            }
        });
        
        // Download button
        editor.querySelector('#download-image').addEventListener('click', async () => {
            // Log current settings for debugging
            console.log('Downloading with settings:', {
                format: settings.outputFormat,
                quality: settings.quality,
                width: currentImage.width,
                height: currentImage.height
            });
            
            const exportedBlob = await exportImage(true);
            const url = URL.createObjectURL(exportedBlob);
            const a = document.createElement('a');
            a.href = url;
            
            // Generate filename with timestamp, format and quality
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const extension = settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat;
            const qualityInfo = (settings.outputFormat === 'jpeg' || settings.outputFormat === 'webp') 
                ? `-q${settings.quality}` 
                : '';
            a.download = `edited-${currentImage.width}x${currentImage.height}-${timestamp}${qualityInfo}.${extension}`;
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 1000000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; padding: 16px 24px; border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px; font-weight: 500;
                animation: slideIn 0.3s ease-out;
            `;
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">✓</span>
                    <div>
                        <div style="font-weight: 600;">Downloaded!</div>
                        <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                            ${extension.toUpperCase()} • ${currentImage.width}x${currentImage.height}${qualityInfo ? ` • Quality ${settings.quality}%` : ''}
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
        
        // Copy buttons
        // Cleanup function
        function cleanupEditor() {
            // Clear undo history to free memory
            history = [];
            
            URL.revokeObjectURL(imageUrl);
            editorStyles.remove();
            editor.remove();
            document.removeEventListener('keydown', undoKeyHandler);
            document.removeEventListener('keydown', pasteKeyHandler);
        }
        
        editor.querySelector('#copy-edited').addEventListener('click', async () => {
            // Save current settings
            await saveEditorSettings({
                width: currentImage.width,
                height: currentImage.height,
                maintainAspectRatio: settings.maintainAspectRatio,
                outputFormat: settings.outputFormat,
                quality: settings.quality
            });
            
            const exportedBlob = await exportImage(true);
            cleanupEditor();
            resolve({ blob: exportedBlob, format: settings.outputFormat });
        });
        
        editor.querySelector('#copy-original').addEventListener('click', async () => {
            cleanupEditor();
            resolve({ blob: blob, format: format });
        });
        
        // Close button
        editor.querySelector('#close-editor').addEventListener('click', () => {
            cleanupEditor();
            resolve(null);
        });
        
        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanupEditor();
                document.removeEventListener('keydown', escHandler);
                resolve(null);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}

// Handle image editor request from popup
async function handleOpenImageEditorFromPopup(request, sendResponse) {
    // Safe sendResponse wrapper - won't throw if context is invalidated
    function safeSendResponse(data) {
        try {
            if (isChromeContextValid()) {
                sendResponse(data);
            }
        } catch (e) {
            // Extension context invalidated - silently ignore
        }
    }
    
    try {
        const { imageData, imageType } = request;
        
        // Convert base64 to blob
        const response = await fetch(imageData);
        const blob = await response.blob();
        
        // Get format from MIME type
        const format = imageType.split('/')[1] || 'png';
        
        // Open the image editor
        const editedResult = await openImageEditor(blob, format);
        
        if (editedResult) {
            // Copy edited image to clipboard
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [editedResult.blob.type]: editedResult.blob
                    })
                ]);
                
                showNotification('✓ Edited image copied to clipboard!', 'success');
                safeSendResponse({ success: true, message: 'Image edited and copied to clipboard' });
            } catch (clipboardError) {
                showNotification('⚠️ Image edited but failed to copy to clipboard', 'error');
                safeSendResponse({ success: true, message: 'Image edited but clipboard update failed' });
            }
        } else {
            safeSendResponse({ success: false, message: 'Editor closed without saving' });
        }
        
    } catch (error) {
        console.error('Error opening image editor:', error);
        safeSendResponse({ success: false, error: error.message });
    }
}
