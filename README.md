# Image Copy & Converter Extension

A Chrome extension — upload clipboard images and PDFs to file input fields, convert formats, pick and copy images from any webpage, and capture colors from your screen.

---

## Features

### Clipboard → File Input Upload (Core Feature)

- **Auto-detection**: The file input you click is automatically captured
- **Unified selection modal**: A "Choose File" modal appears with available options:
  - 📄 **Selected PDF** card (if any) — shows the PDF name
  - 🖼️ **Clipboard image** card (if any) — small preview, size and format info
  - 📁 **Choose from computer** button (native dialog)
  - Cancel
- **Smart behavior**: If neither a PDF nor an image is available, the native file dialog opens directly
- **Post-upload cleanup**: After the file is injected into the input, clipboard and PDF selection are automatically cleared — the same content won't be suggested again

### PDF Selection & Upload

- **Select PDF links on any page**: Click any PDF link on the page using PDF Picker mode to select it
- **Persistent storage**: The selected PDF is saved to `chrome.storage.local` and remembered even after page refresh
- **CORS bypass**: PDFs are fetched via the background service worker, avoiding CORS errors
- **Smart filename**: Priority order is `download` attribute → URL path → link text; double `.pdf` extensions and unnecessary " PDF" suffixes are cleaned automatically
- **Popup preview**: When the popup opens, the selected PDF's name is shown and can be downloaded directly

### Format Conversion

- **Source formats**: PNG, JPEG, WebP, BMP, GIF, SVG
- **Target formats**: PNG, JPEG, WebP, BMP, GIF
- **Quality control**: 1–100% adjustment for JPEG/WebP
- **SVG note**: SVG → raster conversion is supported; raster → SVG auto-vectorization is not. If no explicit rule exists for SVG, the SVG file is uploaded as-is

### Image Editor

- **Modal editor**: Open the editor before uploading a clipboard image
- **Direct editing from popup**: Launch the editor without a file input using the "Edit Image" button
- **Tools**: Resize (presets + custom), crop with draggable handles, rotate, flip, zoom, undo (Ctrl+Z, 20 steps)
- **Paste with Ctrl+V**: While the editor is open, paste a new image from clipboard with Ctrl+V
- **Exit options**: Copy 📋 / Download ⬇️ / Use edited image ✓
- **Format + quality**: PNG/JPEG/WebP and quality slider are always available

### Popup Quick Download

- **Header download icon**: The `⬇️` icon is active when supported content exists in the clipboard
- **Format badge**: Shows the detected format such as `SVG`, `PNG`, `JPG`, etc.
- **PDF priority**: If a PDF is selected, it is shown as the content to download
- **SVG priority**: If the clipboard contains SVG, it is saved as `.svg`

### Visual Image Picker

- **Shortcut activation**: Default `Ctrl+Alt+S` (customizable)
- **Visual highlight**: Images are highlighted with a blue outline as you hover
- **Broad detection**: Detects `<img>`, inline `<svg>`, and CSS `background-image` elements
- **Click to copy**: Clicking a highlighted image copies it to the clipboard
- **Exit**: Large X button or `Escape`

### Image Replace Mode

- **Shortcut activation**: Customizable (e.g. `Ctrl+Alt+R`)
- **Replace with clipboard image**: Click any image on the page to replace it with clipboard content
- **Source-only change**: No HTML attributes, classes, or styles are affected other than `src`, `srcset`, or `background-image`
- **Multiple replacements**: Replace several images in a single session
- **Exit with ESC**: End the mode with `Escape` or the X button

### Color Picker

- **Shortcut activation**: Customizable (e.g. `Ctrl+Alt+C`)
- **EyeDropper API**: System-wide color picking on modern browsers (including outside the browser)
- **Canvas-based fallback**: Used automatically when EyeDropper is not supported or on PDFs
- **Real-time preview**: HEX + RGB values update live as you move the mouse
- **Auto-copy**: The picked color code is automatically copied to the clipboard
- **PDF compatible**: Works on PDF documents open in the browser
- **Exit with ESC**: `Escape` or the X button

---

## Installation

### Manual Installation (Developer Mode)

1. **Download or clone the repository**
   ```bash
   git clone https://github.com/yourusername/ImageCopyExtension.git
   ```

2. **Open Chrome Extensions page**
   Type `chrome://extensions/` in the address bar

3. **Enable Developer mode**
   Toggle "Developer mode" in the top right

4. **Load the extension**
   Click "Load unpacked" → select the downloaded folder

5. **Done!** The extension icon will appear in the toolbar

---

## Usage Guide

### Uploading a Clipboard Image or PDF to a File Input

1. Copy an image (Ctrl+C, Win+Shift+S, right-click → Copy) **and/or** select a PDF on the page using PDF Picker
2. Enable the extension (popup → Enable)
3. Click any file input field on a website
4. The **"Choose File"** modal appears:
   - **PDF card** → upload the PDF using the "Use PDF" button
   - **Image card** → upload directly with "Use Image" or open in editor with "✏️ Edit"
   - **"📁 Choose from computer"** → standard file dialog
5. After selection, clipboard and PDF memory are automatically cleared

### Selecting a PDF

1. Enable the extension
2. Navigate to a page with PDF links
3. Click any PDF link — it is selected and its name appears in the popup
4. When you click a file input, the PDF card is shown automatically in the modal

### Opening the Image Editor (from Popup)

1. Copy an image — a preview appears in the popup
2. Click the "Edit Image" button
3. Crop, resize, adjust format/quality
4. Exit with 📋 Copy / ⬇️ Download / ✓ Use

### Customizing Shortcuts

1. Open the popup
2. Click the relevant shortcut input field:
   - **Image Picker** — to copy images from the page
   - **Image Replace** — to replace images on the page
   - **Color Picker** — to capture colors from the screen
3. Press the new key combination — it is saved automatically

---

## Conversion Rules

### Adding a Rule

1. Open the popup
2. Select source format → target format
3. Adjust quality (for JPEG/WebP, recommended: 90%)
4. Click "Add Rule"

### Example Rules

| Source | Target | Quality | Purpose |
|--------|--------|---------|---------|
| PNG | JPEG | 90% | Reduce file size |
| JPEG | WebP | 85% | Modern web optimization |
| PNG | WebP | 95% | High quality + small size |
| WebP | PNG | — | Compatibility |
| BMP | PNG | — | Convert to standard format |

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Interact with the active tab |
| `scripting` | Inject scripts into pages |
| `clipboardRead` | Read images from clipboard |
| `storage` | Save settings and PDF selection |
| `host_permissions (<all_urls>)` | Work on all websites |

---

## File Structure

```
ImageCopyExtension/
├── manifest.json       # Extension configuration
├── popup.html          # User interface
├── popup.js            # Popup logic
├── styles.css          # Popup styles
├── content.js          # Page interaction script
├── editor.html         # Image editor interface
├── background.js       # Background service worker (CORS proxy)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Troubleshooting

### Image Not Uploading
- Check if the image preview is visible in the popup
- Refresh the page and re-enable the extension

### PDF Not Uploading
- A valid PDF link must be selected using PDF Picker
- PDFs opened with the `file://` protocol are not supported
- For CORS-restricted PDFs, the extension retries in the background

### Editor Not Opening
- Refresh the page and try again; the extension will automatically open a new tab if needed

### Format Conversion Not Working
- WebP may not be supported in older browsers

### File Input Not Detected
- Some sites use custom upload widgets instead of standard HTML inputs

---

## Privacy

- All processing happens **locally on your device**
- No data is sent to external servers
- Clipboard access is used only to read images
- Settings and PDF selection are stored in the browser's local storage

---

**Browser Compatibility**: Chrome 88+ · Edge 88+ · Opera 74+ · Brave 1.20+

**Note**: Not published on the Chrome Web Store; must be loaded in developer mode.