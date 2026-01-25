#  Image Copy & Converter Extension

Chrome extension to paste clipboard images into file input fields, upload with format conversion, select & copy images from any webpage, and pick colors from screen.

##  Features

###  Image Editor Enhancements
- **Integrated editing workspace**: Launch a modal editor from the extension to preview and fine-tune any clipboard image before upload.
- **Direct editing from popup**: Click the "Edit Image" button in the popup to open the editor instantly without needing file input fields.
- **Resize & crop toolset**: Resize with presets/custom ratios, crop with draggable handles, zoom controls, and undo history (Ctrl+Z) for safe experimentation.
- **Paste from clipboard (NEW!)**: Press Ctrl+V inside the editor to paste and replace the current image with a new one from clipboard - perfect for quick image swapping.
- **Smart undo with paste support**: Full undo history (up to 20 steps) works seamlessly with paste operations - replace an image and easily revert back with Ctrl+Z.
- **Automatic memory management**: Editor automatically cleans up all undo history when closed to prevent memory leaks and ensure optimal performance.
- **Custom output controls**: Select PNG/JPEG/WebP + quality slider; the editor always honors these settings when copying, downloading, or inserting images.
- **Copy to clipboard**: Use the 📋 Copy button in the editor to copy the edited image directly to clipboard with all your adjustments applied.
- **Fast downloads with feedback**: A dedicated ⬇️ Download button exports the edited result and shows a temporary confirmation banner with format/size meta.
- **Persistent, visible settings**: Badges constantly refresh resolution, file size, and format; last-used settings are saved for next time while active buttons highlight the current choice.

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

###  Image Replace Mode
- **Replace page images with clipboard content**: Replace any image on a webpage with the image currently in your clipboard
- **Keyboard shortcut activation**: Fully customizable shortcut (e.g., `Ctrl+Alt+R`)
- **Advanced image detection**: Uses the same sophisticated algorithm as Image Picker Mode to find all images on the page
- **Visual feedback**: Blue highlight and glow effect on hover to show which image will be replaced
- **Smart replacement**: Only replaces the image source (src/srcset/background-image) without affecting any other HTML attributes, classes, or styles
- **Continuous operation**: Replace multiple images in a single session without exiting the mode
- **ESC key support**: Press Escape or click the X button to exit the mode
- **Real-time verification**: Shows success/error notifications for each replacement

###  Color Picker Mode (NEW!)
- **Pick colors from anywhere**: Extract color codes from any pixel on screen, including PDFs
- **Keyboard shortcut activation**: Fully customizable shortcut (e.g., `Ctrl+Alt+C`)
- **Auto-start color picking**: No need to click any button - picker activates instantly with the shortcut for instant color capture
- **Modern EyeDropper API**: Uses browser's native EyeDropper API when available for system-wide color picking
- **Fallback support**: Smart canvas-based color picking for PDFs and unsupported browsers
- **Real-time color preview**: See live color preview as you move your mouse (mousemove tracking)
- **Transparent overlay**: Crystal clear view of the screen without any darkening or visual interference
- **Beautiful UI**: Gradient purple panel with real-time color preview and color values
- **Multiple color formats**: Displays both HEX (#RRGGBB) and RGB values simultaneously
- **Auto-copy to clipboard**: Selected color code automatically copies to clipboard - no extra click needed
- **+ Icon tool**: Clean crosshair cursor for precise color picking
- **ESC key support**: Press Escape or click the X button to exit mode
- **PDF compatible**: Works perfectly with PDF documents in browser
- **Non-blocking notifications**: Quick success messages that don't interfere with color picking

###  Supported Format Conversions

- **Source formats**: PNG, JPEG, WebP, BMP, GIF
- **Target formats**: PNG, JPEG, WebP, BMP
- **Quality control**: Adjustable from 1% to 100% for JPEG and WebP

###  Usage Scenarios

1. **Social media profile photo**: Copy → Edit (crop, resize, adjust) → Upload
2. **Screenshot editing**: Take a screenshot with Windows+Shift+S → Edit instantly → Copy to clipboard or upload
3. **Quick image swapping in editor**: Copy first image → Open editor → Paste second image with Ctrl+V → Compare and edit → Undo with Ctrl+Z if needed
4. **Color matching**: Pick colors from design mockups, PDFs, or any webpage → Auto-copied to clipboard → Paste in design tools
5. **Design color extraction**: Open PDF design file → Press color picker shortcut → Mouse over elements → Colors automatically copied
6. **Form filling**: Quickly upload your documents with format conversion
7. **E-commerce**: Easily add product images with automatic resizing and optimization
8. **File format conversion**: Copy image, change format, adjust quality, upload
9. **Web image selection & copying**: Select and copy images from any webpage to clipboard
10. **Bulk image replacement**: Replace placeholder images on a webpage with your own images from clipboard
11. **Design mockups**: Quickly swap images in web designs to preview different options

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

### Direct Image Editing from Popup

1. **Copy an image** (Ctrl+C, Windows+Shift+S, or right-click → Copy)
   
2. **Open the extension popup**
   - Click the extension icon in the toolbar
   - The copied image will be displayed in the preview section

3. **Click "Edit Image" button**
   - The image editor will open in a new or existing browser tab
   - No need to have a file input field or webpage open

4. **Edit your image**
   - Crop, resize, rotate, apply filters
   - Adjust output format (PNG/JPEG/WebP) and quality
   - Use the zoom controls for precise editing
   - **Paste new images**: Press Ctrl+V to replace current image with a new one from clipboard
   - **Full undo support**: Use Ctrl+Z to undo any changes including pasted images

5. **Export your result**
   - **📋 Copy button**: Copy the edited image to clipboard
   - **⬇️ Download button**: Download the edited image to your computer
   - **✓ Use Edited Image button**: If opened from a file input field, insert the image directly

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

### Image Replace Mode

1. **Copy an image to clipboard**
   - Use Ctrl+C, Windows+Shift+S, or any method to copy an image

2. **Set up the shortcut** (first time only)
   - Open the extension popup
   - Find the "Image Replace Mode Shortcut" section
   - Click in the input field and press your desired key combination (e.g., `Ctrl+Alt+R`)
   - The shortcut is automatically saved

3. **Activate the mode on any webpage**
   - Press your configured shortcut
   - A blue information banner appears at the top
   - The mode verifies that you have an image in clipboard

4. **Select and replace images**
   - Hover over any image on the page
   - Images are highlighted with a blue border and glow effect
   - The extension detects both `<img>` tags and CSS background images
   - Click on any highlighted image to replace it with your clipboard image

5. **Continue or exit**
   - Replace as many images as you want in one session
   - Press Escape or click the red X button to exit the mode

**Important**: This feature only replaces the image source (src, srcset, or background-image). All other HTML attributes, CSS classes, inline styles, and event handlers remain unchanged, ensuring the page functionality is preserved.

### Color Picker Mode

1. **Set up the shortcut** (first time only)
   - Open the extension popup
   - Find the "Color Picker Mode Shortcut" section
   - Click in the input field and press your desired key combination (e.g., `Ctrl+Alt+C`)
   - The shortcut is automatically saved

2. **Activate the mode**
   - Press your configured shortcut
   - A beautiful gradient purple panel appears in the top-right corner
   - The panel shows current color preview, HEX code, and RGB values

3. **Pick colors from screen**
   - **Auto-start feature**: The color picker starts automatically when you press the shortcut - no need to click any button
   - Move your mouse around to see real-time color preview in the panel
   
   - **Method 1 (EyeDropper API)**: Modern browsers with EyeDropper support
     - Your cursor becomes a system-wide color picker
     - Click anywhere on the screen (even outside the browser) to capture the color
     - Works on all visible content including images and backgrounds
   
   - **Method 2 (Canvas-based)**: If EyeDropper is not available or for PDF support
     - Automatically activates when shortcut is pressed
     - Move mouse over any element to see live color preview
     - Click to select the color
     - Automatically detects colors from backgrounds, borders, and images
     - **Perfect for PDFs**: Works seamlessly with PDF documents in browser

4. **Use the picked color**
   - The color preview updates in real-time as you move your mouse
   - HEX code is displayed (e.g., #FF5733)
   - RGB values are shown (e.g., RGB(255, 87, 51))
   - **Auto-copy**: Color code is automatically copied to clipboard when selected - ready to paste immediately
   - Success notification appears briefly without interfering with your workflow

5. **Exit the mode**
   - Press the Escape key
   - Or click the X button in the top-right of the color picker panel

**Special Features**:
- Works with PDF documents opened in browser
- Supports both modern EyeDropper API and fallback canvas method
- Auto-start: No button clicks needed - instantly starts picking when shortcut is pressed
- Transparent overlay: See the exact colors without any screen darkening
- Auto-copy: Color codes are automatically copied to clipboard
- Real-time preview: Live color updates as you move your mouse
- No permissions required - uses standard web APIs
- Beautiful gradient UI with smooth animations

### Customize Shortcut

1. Open extension popup
2. Find the shortcut section you want to customize:
   - **"Image Picker Mode Shortcut"**: For copying images from pages
   - **"Image Replace Mode Shortcut"**: For replacing page images with clipboard content
   - **"Color Picker Mode Shortcut"**: For picking colors from screen
3. Click the input field in the desired section
4. Press your desired key combination (e.g., `Ctrl+Shift+P`, `Ctrl+Alt+R`, `Ctrl+Alt+C`)
5. The shortcut is automatically saved and becomes active in all tabs immediately

**Tips for choosing shortcuts**:
- Use at least two modifier keys (Ctrl, Alt, Shift) plus a letter
- Avoid conflicts with browser shortcuts (e.g., Ctrl+T, Ctrl+W)
- Choose memorable combinations related to the action (R for Replace, S for Select, C for Color)

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

### Editor Not Opening
1. If you see "Content script not ready" error, the extension will automatically create a new tab for editing
2. Make sure you have at least one browser tab open
3. The extension needs proper permissions - check if any security software is blocking it
4. Try refreshing the page and clicking the Edit button again

### Image Replace Mode Issues
1. **No images detected**: Some images might be loaded dynamically or embedded in complex ways
2. **Replace not working**: Ensure you have a valid image in clipboard before activating the mode
3. **Page looks broken**: Refresh the page to restore original images - the extension never permanently modifies the page HTML
4. **Shortcut conflicts**: If your shortcut doesn't work, it might conflict with another extension or browser shortcut

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
