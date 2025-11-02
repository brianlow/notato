# notato - Image Annotation Tool

A lightweight, browser-based image annotation tool for creating bounding box annotations in YOLO and COCO formats.

## Features

- 🎯 **Zero Installation**: Single HTML file - download and open in your browser
- 📦 **Multiple Formats**: Native support for YOLO and COCO annotation formats
- 🖼️ **Intuitive UI**: Simple two-column layout with thumbnail preview
- ⚡ **Works Offline**: No internet connection required
- 🎨 **Visual Editing**: Draw, resize, and move bounding boxes with ease
- ⌨️ **Keyboard Shortcuts**: Speed up your workflow with shortcuts

## Quick Start

1. **Download** the `notato.html` file from the `dist/` folder
2. **Start a local server** (required for file access):
   ```bash
   python3 -m http.server 8000
   ```
3. **Open** `http://localhost:8000/notato.html` in your browser
4. **Select format** (YOLO or COCO)
5. **Open folder** with your images
6. **Start annotating!**

## Development

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Then open `http://localhost:8080` in your browser.

### Build

```bash
npm run build
```

This creates `dist/notato.html` - a single file containing the entire application.

## Supported Formats

### YOLO Format

One `.txt` file per image with normalized coordinates:

```
<class_id> <center_x> <center_y> <width> <height>
```

Example folder structure:
```
/dataset
  /images
    image1.jpg
    image2.jpg
  /labels
    image1.txt
    image2.txt
```

### COCO Format

Single `annotations.json` file for the entire dataset:

```json
{
  "images": [...],
  "annotations": [...],
  "categories": [...]
}
```

## Keyboard Shortcuts

- `Delete` - Delete selected box
- `Escape` - Deselect box / cancel drawing
- `Arrow keys` - Navigate between images
- `+/-` - Zoom in/out
- `0` - Fit to screen
- `H` - Toggle hide/show all boxes
- `Ctrl+S` / `Cmd+S` - Save

## Browser Compatibility

- **Chrome/Edge 86+**: Full support with File System Access API
- **Firefox**: Drag-drop fallback
- **Safari**: Drag-drop fallback

## Troubleshooting

### File access not working?

Make sure you're running the app from a local server (not opening the file directly). The File System Access API requires a server context.

### Can't see my annotations?

- For YOLO: Check that `.txt` files have the same name as images
- For COCO: Look for `annotations.json` or `instances_default.json`
- Verify the format matches the selected mode

### Images not loading?

Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## License

MIT
