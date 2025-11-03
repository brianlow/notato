![alt text](images/header.png "Image of potatoe characters")


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

1. **Visit** [https://brianlow.github.io/notato/](https://brianlow.github.io/notato/)
2. **Select format** (YOLO or COCO)
3. **Open folder** with your images
4. **Start annotating!**

## Running Locally

If you prefer to run notato locally:

1. **Download** the `notato.html` file from the `dist/` folder
2. **Start a local server** (required for file access):
   ```bash
   python3 -m http.server 8000
   ```
3. **Open** `http://localhost:8000/notato.html` in your browser

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

### Testing

#### Unit Tests

Run the unit test suite (80 tests covering core functionality):

```bash
npm test                 # Run all unit tests once
npm run test:watch       # Run tests in watch mode (re-runs on changes)
npm run test:ui          # Open Vitest UI in browser
```

The unit test suite includes:
- **YOLOHandler**: Coordinate conversions, parsing, real file integration
- **COCOHandler**: JSON parsing, box retrieval, category management
- **AnnotationStore**: State management, CRUD operations, event system

#### End-to-End Tests

Run Playwright E2E tests that verify dataset loading in a real browser:

**First-time setup:**
```bash
npm run test:e2e:install  # Install Chromium browser (one-time setup)
```

**Running tests:**
```bash
npm run test:e2e         # Run E2E tests (headless)
npm run test:e2e:headed  # Run E2E tests with visible browser
npm run test:e2e:ui      # Open Playwright UI for debugging tests
```

The E2E test suite includes:
- **YOLO Dataset**: Load samples/yolo folder and verify bounding boxes display
- **COCO Dataset**: Load samples/coco/train folder and verify annotations display
- **Navigation**: Verify switching between images with different annotations

**Configuration Notes:**
- Tests run in headless Chromium with `--single-process` flag for compatibility
- Average test execution time: ~6 seconds for all 4 tests
- Test reports are saved to `playwright-report/` (viewable with `npx playwright show-report`)
- CI/CD uses browser caching to speed up installation (~20-30s on cache hit vs ~60-90s cold)

## Supported Formats

### YOLO Format

One `.txt` file per image with normalized coordinates:

```
<class_id> <center_x> <center_y> <width> <height>
```

Example folder structure:
```
image1.jpg
image1.txt
image2.jpg
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
