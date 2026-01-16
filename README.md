#  Image Copy & Converter Extension

Chrome extension to paste clipboard images into file input fields, upload with format conversion, and select & copy images from any webpage.

##  Features

###  Main Feature: Clipboard to File Input Upload
- **Automatic file input detection**: Captures file input fields you click
- **Clipboard support**: Automatically detects images in clipboard (copied with Ctrl+C)
- **Format conversion**: Converts images to your desired format
- **Quality control**: Adjustable quality settings for JPEG/WebP
- **Convenient interface**: Easy to use modal window

###  Visual Image Picker Mode
- **Keyboard shortcut activation**: Default `Ctrl+Alt+S` (customizable)
- **Visual highlight system**: Images are highlighted as you move your mouse
- **Smart image detection**: Finds both `<img>` tags and images defined with CSS `background-image`
- **Click-to-copy**: Click on highlighted image to copy to clipboard
- **Large X button**: Prominent close button in top-right corner to exit mode
- **Independent operation**: Works independently from main feature (file input)

###  Supported Format Conversions

- **Source formats**: PNG, JPEG, WebP, BMP, GIF
- **Target formats**: PNG, JPEG, WebP, BMP
- **Quality control**: Adjustable from 1% to 100% for JPEG and WebP

###  Usage Scenarios

1. **Social media profile photo**: Copy  Convert  Upload
2. **Form filling**: Quickly upload your documents
3. **E-commerce**: Easily add product images
4. **File format conversion**: Copy image, change format, upload
5. **Web image selection & copying**: Select and copy images from any webpage to clipboard

##  Installation

### From Chrome Web Store (Coming Soon)
*Not yet published*

### Manual Installation (Developer Mode)

1. **Download or clone the repository**
   ```bash
   git clone https://github.com/yourusername/ImageCopyExtension.git
   ```

2. **Open Chrome Extensions page**
   - Go to `chrome://extensions/` in Chrome
   - Or: Menu  Extensions  Manage Extensions

3. **Enable Developer mode**
   - Turn on the "Developer mode" toggle in the top right

4. **Load the extension**
   - Click "Load unpacked" button
   - Select the downloaded folder

5. **Ready!**
   - Extension is now active
   - Icon will appear in toolbar

##  Usage Guide

### Clipboard to File Input Upload

1. **Copy an image** (Ctrl+C or right-click  Copy)
   
2. **Enable the extension**
   - Click the extension icon in the toolbar
   - Press the "Enable" button
   - It will be active in all tabs

3. **Create conversion rule** (optional)
   - Select source format (e.g., PNG)
   - Select target format (e.g., JPEG)
   - Set quality (90% recommended)
   - Click "Add Rule" button

4. **Click on a file input field**
   - Click any file selection field on a website
   - Modal window opens automatically

5. **Choose upload option**
   - **"Paste from clipboard"**: Uses image from clipboard
   - **"Browse files"**: Allows you to select files from computer

6. **Image uploads automatically**
   - Format conversion is applied if configured
   - File is assigned to the input field

### Visual Image Picker Mode

1. **Activate the mode**
   - Press the keyboard shortcut (default: `Ctrl+Alt+S`)
   - Or customize the shortcut from extension popup

2. **Select an image**
   - Move your mouse around the page
   - Images are automatically highlighted (blue border + semi-transparent background)
   - Detects both normal `<img>` tags and images defined with CSS `background-image`

3. **Copy**
   - Click on the highlighted image
   - Image is automatically copied to clipboard in PNG format
   - Success message is displayed

4. **Exit the mode**
   - Click the large X button in the top-right corner
   - Or press the `Escape` key

**Note**: This feature is completely independent from the main extension feature (paste to file input). It works even when the extension is not active.

### Customize Shortcut

1. Open extension popup
2. Click the input field in "Image Picker Shortcut" section
3. Press your desired key combination (e.g., `Ctrl+Shift+P`)
4. Shortcut is automatically saved and active in all tabs

##  Settings

### Conversion Rules

Automatic format conversion when extension is active:

- **Add rule**: Source  Target format mapping
- **Quality setting**: 1-100% for JPEG/WebP
- **Delete rule**: Click trash icon on the right side of the rule
- **Real-time synchronization**: Changes made in popup are instantly reflected in all tabs

### Example Conversion Rules

| Source | Target | Quality | Purpose |
|--------|--------|---------|---------|
| PNG | JPEG | 90% | Reduce file size |
| JPEG | WebP | 85% | Modern web optimization |
| PNG | WebP | 95% | High quality + small size |
| WebP | PNG | - | For compatibility |
| BMP | PNG | - | Standard format |

##  Format Comparison

### PNG
-  Lossless compression
-  Transparency support
-  Large file size
-  **Usage**: Logos, graphics, transparent images

### JPEG
-  Small file size
-  Lossy compression
-  No transparency
-  **Usage**: Photos, complex images

### WebP
-  25-35% smaller than JPEG
-  Transparency support
-  Both lossless and lossy
-  Not supported in older browsers
-  **Usage**: Modern websites

### BMP
-  Simple format
-  Very large file size
-  No compression
-  **Usage**: Rarely used

##  Tips and Recommendations

### Best Quality Settings

- **JPEG 90% quality**: Generally best quality/size balance
- **JPEG 75% quality**: Ideal for web usage
- **WebP 90% quality**: 25-35% smaller than JPEG
- **PNG**: Use when transparency is needed

### Browser Compatibility

-  Chrome 88+
-  Edge 88+
-  Opera 74+
-  Brave 1.20+

##  Permissions

Extension uses the following permissions:

- **activeTab**: For interaction with active tab
- **scripting**: To inject scripts into pages
- **clipboardRead**: To read images from clipboard
- **storage**: To save settings
- **host_permissions (<all_urls>)**: To work on all websites

##  Development

### File Structure

```
ImageCopyExtension/
 manifest.json         # Extension configuration
 popup.html           # User interface
 popup.js             # UI logic
 styles.css           # Style file
 content.js           # Page interaction
 background.js        # Background service
 icons/               # Extension icons
    icon16.png
    icon32.png
    icon48.png
    icon128.png
 README.md            # Documentation
```

### Customization

#### Change Default Quality
In popup.js:
```javascript
qualitySlider.value = 90;  // Your desired value (1-100)
```

#### Change Supported Formats
Edit the `<select>` element in popup.html

##  Troubleshooting

### Image Not Uploading
1. Make sure there's actually an image in the clipboard
2. Check if image preview appears in the popup
3. Refresh the page and try again
4. Disable and re-enable the extension

### Format Conversion Not Working
1. Make sure the target format is supported in your browser
2. WebP format may not work in older browsers
3. BMP and GIF formats can create large files

### File Input Not Detected
1. Some sites use custom file upload widgets
2. Refresh the page and re-enable the extension
3. Make sure it's a standard HTML file input element

##  Notes

- Extension only works with **image** files
- Maximum file size limits depend on the website
- Format conversion is done in the browser (client-side)
- No data is sent to any server (privacy preserved)

##  Privacy

- Images are processed **only on your device**
- No data is sent to external servers
- Clipboard access is only used to read images
- Settings are stored in your browser's local storage

##  License

This project is open source and free to use.

##  Contributing

You can open issues for bug reports and suggestions.

##  Contact

You can contact via GitHub for your questions.

---

**Note**: This extension is not published on Chrome Web Store. It must be loaded in developer mode.
