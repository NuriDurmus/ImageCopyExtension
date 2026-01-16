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
                
                sendResponse({ success: true });
            }
            return true;
        });

        // Check state when page loads
        chrome.storage.local.get(['isActive', 'conversionRules', 'imagePickerShortcut'], (result) => {
            if (result.isActive) {
                isActive = true;
                conversionRules = result.conversionRules || [];
                attachFileInputListeners();
            }
            if (result.imagePickerShortcut) {
                imagePickerShortcut = result.imagePickerShortcut;
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
    
    // PREVENT event first (before async operations!)
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
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
            // Temporarily remove listener
            input.removeEventListener('click', handleFileInputClick, { capture: true });
            
            setTimeout(() => {
                input.click();
                
                // Add listener back
                setTimeout(() => {
                    input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
                }, 100);
            }, 50);
            
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
                    // Use copied image
                    const currentFormat = userChoice.format;
                    
                    
                    // Find conversion rule
                    const matchingRule = conversionRules.find(rule => 
                        rule.source === 'all' || rule.source === currentFormat
                    );
                    
                    
                    if (matchingRule) {
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
                        // If no rule, add as original
                        const fileName = generateFileName(currentFormat);
                        const mimeType = `image/${currentFormat}`;
                        const file = new File([blob], fileName, { type: mimeType });
                        
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        showNotification('Copied image added successfully! ✓', 'success');
                    }
                    
                } else if (userChoice.action === 'browse') {
                    
                    // TEMPORARILY remove listener
                    input.removeEventListener('click', handleFileInputClick, { capture: true });
                    
                    // FULLY restore override (restore original click method)
                    if (input._originalClick) {
                        input.click = input._originalClick;
                    }
                    
                    // Click after short delay
                    setTimeout(() => {
                        input.click();
                        
                        // Restore everything right after
                        setTimeout(() => {
                            // Add listener back
                            input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
                            
                            // Re-apply override
                            if (!input._originalClick) {
                                input._originalClick = input.click.bind(input);
                            }
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
                            
                        }, 100);
                    }, 100);
                } else {
                }
                
                return;
            }
        }
        
    } catch (error) {
    console.warn('ℹ️ Clipboard access error, opening browser dialog manually:', error.message);
        
        // In case of error, open manually as well
        input.removeEventListener('click', handleFileInputClick, { capture: true });
        
        setTimeout(() => {
            input.click();
            
            setTimeout(() => {
                input.addEventListener('click', handleFileInputClick, { capture: true, passive: false });
            }, 100);
        }, 50);
        
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
    // Exit if shortcut is not set
    if (!imagePickerShortcut) return;
    
    // Check shortcut match
    const matches = 
        (imagePickerShortcut.ctrl === e.ctrlKey) &&
        (imagePickerShortcut.alt === e.altKey) &&
        (imagePickerShortcut.shift === e.shiftKey) &&
        (imagePickerShortcut.meta === e.metaKey) &&
        (imagePickerShortcut.key === e.key || imagePickerShortcut.code === e.code);
    
    if (matches) {
        e.preventDefault();
        toggleImagePickerMode();
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

