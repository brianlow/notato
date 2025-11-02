# notato - Image Annotation Tool Specification

**Version:** 1.0
**Last Updated:** November 1, 2025

---

## 1. Overview

### 1.1 Purpose
notato is a lightweight, browser-based image annotation tool for creating bounding box annotations in YOLO and COCO formats. Designed for simplicity and ease of distribution.

### 1.2 Goals
- Single HTML file distribution (development uses modular files)
- Native YOLO and COCO format support (no import/export conversions)
- Zero installation required
- Simple, intuitive UI
- Works offline

### 1.3 Non-Goals
- Polygon/segmentation annotation
- Multi-user collaboration
- Cloud storage integration
- Advanced image processing (filters, adjustments)
- Version control for annotations

---

## 2. User Interface

### 2.1 Layout

**Two-column layout:**
```
┌─────────────────┬──────────────────────────────┐
│   Left Sidebar  │      Main Canvas Area        │
│   (320px wide)  │      (flexible width)        │
│                 │                              │
│  - Format       │   - Image display            │
│  - Folder       │   - Bounding boxes           │
│  - File list    │   - Toolbar                  │
│  - Thumbnails   │   - Class selector           │
│                 │                              │
└─────────────────┴──────────────────────────────┘
```

### 2.2 Left Sidebar

**Format Selection (top)**
- Radio buttons: ○ YOLO  ○ COCO
- "Open Folder" button
- Shows current folder path when loaded

**File List**
- Grouped by subfolder (collapsible sections)
- Each image shows:
  - Thumbnail (100x100px)
  - Filename
  - Annotation count badge (e.g., "3 boxes")
  - Visual indicator: annotated (green dot) / unannotated (gray dot)
- Click thumbnail to load image in canvas
- Search/filter input at top of list
- Scrollable area

### 2.3 Main Canvas Area

Mockups: SPEC-mockup.png, SPEC-mockup-2.png

**Toolbar (top)**
- File info: `filename.jpg (1920 x 1080)`
- Annotation count: `5 boxes`
- Zoom controls: `-` `100%` `+` buttons
- "Save" button (highlights when unsaved changes exist)
- "Show/Hide Boxes" toggle

**Class Selector**
- Dropdown or text input for current class
- Shows all available classes
- "Add Class" button
- Color indicator next to each class

**Canvas**
- Image displayed at fit-to-container size by default
- Bounding boxes rendered on top
- Zoom/pan enabled
- Crosshair cursor: dot at cursor, cross hairs intersecting cursor except right around dot

**Status Bar (bottom)**
- Mouse coordinates (when hovering)
- Current tool/mode indicator
- Keyboard shortcut hints

---

## 3. Functionality

### 3.1 File Management

**Opening a Folder**
- User clicks "Open Folder" button
- Browser shows folder picker dialog (File System Access API)
- System scans for image files (jpg, jpeg, png, gif, webp, bmp)
- Loads corresponding annotation files based on format:
  - YOLO: `.txt` files with same base name
  - COCO: `annotations.json` or `instances_default.json`

**File System Access API Fallback**
- If API unavailable (Firefox, Safari), show drag-drop zone
- User drags folder onto the application
- Process files from DataTransfer items

**Supported Folder Structures**

YOLO:
```
/dataset
  /images
    image1.jpg
    image2.jpg
  /labels
    image1.txt
    image2.txt
```
OR
```
/dataset
  image1.jpg
  image1.txt
  image2.jpg
  image2.txt
```

COCO:
```
/dataset
  /images
    image1.jpg
    image2.jpg
  annotations.json
```

### 3.2 Format Specifications

**YOLO Format**
- One `.txt` file per image
- Each line: `<class_id> <center_x> <center_y> <width> <height>`
- All coordinates normalized (0.0 to 1.0)
- Example: `0 0.5 0.5 0.3 0.4`

**COCO Format**
- Single JSON file for entire dataset
- Structure:
```json
{
  "images": [
    {
      "id": 1,
      "file_name": "image1.jpg",
      "width": 1920,
      "height": 1080
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [x, y, width, height],
      "area": 12000,
      "iscrowd": 0
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "person",
      "supercategory": "none"
    }
  ]
}
```
- bbox format: `[top_left_x, top_left_y, width, height]` in pixels
- Area calculated automatically

### 3.3 Bounding Box Creation

**Drawing Mode (default)**
1. User clicks on canvas to start box
2. Drag to opposite corner
3. Release to complete box
4. Box assigned to currently selected class
5. Box immediately editable

**Alternative: Click-Click Mode**
1. Click first corner
2. Move mouse (box preview follows)
3. Click second corner to complete

### 3.4 Bounding Box Editing

**Selection**
- Click on any box to select it
- Selected box shows 8 handles:
  - 4 corner handles (squares, 8px)
  - 4 midpoint handles (squares, 8px, resize one dimension)
- Selected box highlighted with different border style

**Resizing**
- Drag corner handles to resize from that corner
- Drag midpoint handles to resize along that edge
- Opposite corner/edge remains anchored

**Moving**
- Drag box interior (not on handles) to move
- Box maintains size during move
- Constrained to image bounds

**Class Change**
- Select box, choose different class from dropdown
- Box color updates immediately

**Deletion**
- Select box, press Delete key
- Or click delete icon when box selected

### 3.5 Canvas Interactions

**Zoom**
- Mouse wheel: zoom in/out centered on cursor
- Zoom buttons: +/- in toolbar
- Zoom levels: 25%, 50%, 75%, 100%, 150%, 200%, 300%
- Fit to screen (default): press `0` key

**Pan**
- When zoomed: click and drag background to pan
- Or hold Spacebar + drag

**Keyboard Shortcuts**
- `Delete`: Delete selected box
- `Escape`: Deselect box / cancel drawing
- `Arrow keys`: Navigate between images
- `+/-`: Zoom in/out
- `0`: Fit to screen
- `H`: Toggle hide/show all boxes
- `S`: Save (Ctrl+S / Cmd+S)

### 3.6 Saving

**Auto-detection of Changes**
- Track modifications in memory
- "Save" button highlights when unsaved changes exist
- Show unsaved indicator on image thumbnails

**Save Behavior - YOLO**
- Write updated `.txt` file for current image
- Create file if doesn't exist
- Overwrite existing file
- Format: one line per box

**Save Behavior - COCO**
- Update in-memory COCO JSON structure
- Write entire `annotations.json` on save
- Maintain existing IDs where possible
- Generate new IDs for new annotations
- Calculate area automatically

**Save All**
- Optional button to save all modified images at once

### 3.7 Class Management

**Class Definition**
- YOLO: classes defined in `classes.txt` (one per line) or inferred from annotations
- COCO: classes defined in "categories" section of JSON

**Adding Classes**
- "Add Class" button opens input dialog
- User enters class name
- Class assigned next available ID
- Color assigned automatically from palette

**Class Colors**
- Pre-defined color palette (10-20 distinct colors, use HSL models: vary hue, consistent sat/lightness)
- Colors cycle if more classes than colors
- Saved in localStorage for consistency across sessions

**Class Display**
- Each box rendered in its class color
- Class label shown on hover or inside box
- Legend/list of classes with colors in sidebar

---

## 4. Technical Architecture

### 4.1 File Structure

**Development:**
```
notato/
├── package.json
├── build.js
├── README.md
├── src/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── main.js
│       ├── FileManager.js
│       ├── AnnotationStore.js
│       ├── ImageCanvas.js
│       ├── BoxEditor.js
│       ├── YOLOHandler.js
│       ├── COCOHandler.js
│       └── UIController.js
└── dist/
    └── notato.html
```

**Distribution:**
- Single file: `notato.html`
- All CSS and JavaScript embedded

### 4.2 Module Responsibilities

**main.js**
- Application initialization
- Wire up modules
- Event listener setup

**FileManager.js**
- Detect File System Access API support
- Handle folder selection (API or drag-drop)
- Read image files
- Read/write annotation files
- Directory traversal and grouping

**AnnotationStore.js**
- In-memory data model for annotations
- Tracks modifications
- Provides CRUD operations for boxes
- Converts between internal format and YOLO/COCO

**ImageCanvas.js**
- Canvas rendering
- Image loading and display
- Zoom/pan calculations
- Coordinate transformations (screen ↔ image space)
- Box rendering with colors

**BoxEditor.js**
- Mouse event handling for canvas
- Box creation (click-drag)
- Box selection detection (hit testing)
- Handle rendering and interaction
- Drag operations (move, resize)

**YOLOHandler.js**
- Parse YOLO `.txt` files
- Write YOLO format
- Coordinate conversion (normalized ↔ pixels)
- Handle `classes.txt` file

**COCOHandler.js**
- Parse COCO JSON
- Write COCO JSON
- Maintain ID consistency
- Calculate bbox areas
- Handle categories section

**UIController.js**
- Sidebar updates (file list, thumbnails)
- Toolbar state management
- Class selector population
- Keyboard shortcut handling
- Status bar updates

### 4.3 Data Models

**Internal Box Representation:**
```javascript
{
  id: "box_123",           // Unique ID
  classId: 0,              // Class index/ID
  className: "person",     // Class name
  x: 100,                  // Top-left X (pixels)
  y: 50,                   // Top-left Y (pixels)
  width: 200,              // Width (pixels)
  height: 300,             // Height (pixels)
  imageId: "img_1"         // Reference to parent image
}
```

**Internal Image Representation:**
```javascript
{
  id: "img_1",
  fileName: "image1.jpg",
  filePath: "images/image1.jpg",
  width: 1920,
  height: 1080,
  boxes: [],               // Array of box IDs
  modified: false,         // Unsaved changes flag
  subfolder: "train"       // Grouping
}
```

### 4.4 State Management

**Application State:**
```javascript
{
  format: "yolo",          // "yolo" or "coco"
  folderHandle: null,      // File System API handle
  images: Map,             // imageId -> Image object
  boxes: Map,              // boxId -> Box object
  classes: [],             // Array of class definitions
  currentImageId: null,    // Currently displayed image
  selectedBoxId: null,     // Currently selected box
  currentClassId: 0,       // Active class for new boxes
  zoom: 1.0,               // Zoom level
  panX: 0,                 // Pan offset X
  panY: 0,                 // Pan offset Y
  showBoxes: true,         // Visibility toggle
  modified: Set            // Set of modified image IDs
}
```

### 4.5 Coordinate Systems

**Canvas Coordinates** (screen space)
- Origin: top-left of canvas element
- Used for mouse events, rendering

**Image Coordinates** (image space)
- Origin: top-left of actual image
- Independent of zoom/pan
- Used for storage

**Normalized Coordinates** (YOLO space)
- Range: 0.0 to 1.0
- Origin: top-left of image
- Center-based for YOLO format

**Conversions:**
```javascript
// Screen -> Image (accounting for zoom/pan)
imageX = (screenX - panX) / zoom
imageY = (screenY - panY) / zoom

// Image -> Normalized (YOLO)
normX = imageX / imageWidth
normY = imageY / imageHeight

// YOLO center -> top-left
x = centerX - width / 2
y = centerY - height / 2
```

### 4.6 Build Process

**Simple Node.js Script:**
```javascript
// build.js
const fs = require('fs');
const path = require('path');

// Read all source files
const css = fs.readFileSync('src/css/styles.css', 'utf8');
const jsFiles = [
  'main.js',
  'FileManager.js',
  'AnnotationStore.js',
  'ImageCanvas.js',
  'BoxEditor.js',
  'YOLOHandler.js',
  'COCOHandler.js',
  'UIController.js'
].map(f => fs.readFileSync(`src/js/${f}`, 'utf8')).join('\n\n');

// Read HTML template
let html = fs.readFileSync('src/index.html', 'utf8');

// Inject CSS and JS
html = html.replace('<!-- CSS_PLACEHOLDER -->', `<style>\n${css}\n</style>`);
html = html.replace('<!-- JS_PLACEHOLDER -->', `<script>\n${jsFiles}\n</script>`);

// Write bundled file
fs.writeFileSync('dist/notato.html', html);
console.log('Build complete: dist/notato.html');
```

**package.json:**
```json
{
  "name": "notato",
  "version": "1.0.0",
  "scripts": {
    "build": "node build.js",
    "dev": "live-server src --port=8080"
  },
  "devDependencies": {
    "live-server": "^1.2.2"
  }
}
```

---

## 5. Browser Compatibility

### 5.1 Target Browsers
- Chrome/Edge 86+ (full support with File System Access API)
- Firefox (latest) - drag-drop fallback
- Safari (latest) - drag-drop fallback

### 5.2 Required Features
- HTML5 Canvas
- ES6+ JavaScript (classes, async/await, modules during dev)
- CSS Grid and Flexbox
- File System Access API (with fallback)

### 5.3 Fallback Strategies
- File System Access API → Drag-and-drop
- Modern file handling → Traditional file inputs (last resort)

---

## 6. User Workflows

### 6.1 First-Time User
1. Download `notato.html`
2. Start local server: `python3 -m http.server 8000`
3. Open `http://localhost:8000/notato.html`
4. Select format (YOLO or COCO)
5. Click "Open Folder"
6. Select dataset folder
7. Start annotating

### 6.2 Annotating Images
1. Click image thumbnail in sidebar
2. Image loads in canvas
3. Select class from dropdown
4. Click-drag to draw bounding box
5. Adjust box using handles if needed
6. Click "Save" to write annotations
7. Navigate to next image with arrow keys or click thumbnail

### 6.3 Editing Existing Annotations
1. Open folder with existing annotations
2. Annotations load automatically
3. Click on box to select
4. Drag handles to resize, drag interior to move
5. Change class via dropdown
6. Delete with Delete key
7. Save changes

### 6.4 Managing Classes
1. Click "Add Class" button
2. Enter class name
3. New class available in dropdown
4. Assign boxes to classes
5. Classes automatically saved to format (classes.txt or COCO categories)

---

## 7. Error Handling

### 7.1 File Access Errors
- **Folder permission denied:** Show message, retry button
- **Format mismatch:** Warn user if selected format doesn't match found files
- **Corrupted annotation files:** Skip and log error, continue with other files
- **Missing classes.txt (YOLO):** Create automatically from annotations or prompt user

### 7.2 Validation
- **Box bounds:** Constrain boxes to image dimensions
- **Invalid coordinates:** Clamp to valid ranges, log warning
- **Duplicate box IDs:** Regenerate IDs to ensure uniqueness
- **Empty annotations:** Allow saving with 0 boxes (valid use case)

### 7.3 User Feedback
- Toast notifications for saves, errors
- Loading indicators for folder operations
- Unsaved changes warnings before navigation
- Clear error messages with suggested actions

---

## 8. Future Enhancements (Out of Scope for v1.0)

### 8.1 Nice-to-Have Features
- Undo/redo functionality
- Batch operations (delete all boxes, change class for multiple)
- Image filtering (show only unannotated, show by class)
- Statistics dashboard (boxes per class, coverage)
- Export to additional formats (Pascal VOC, TFRecord)
- Keyboard shortcuts for class selection (1-9 keys)
- Copy/paste boxes between images
- Auto-save option
- Dark mode

### 8.2 Advanced Features
- Object tracking across images (same object, same ID)
- Pre-annotation with ML model integration
- Multi-user annotations and consensus
- Cloud storage backends (S3, GCS)
- Annotation history and versioning
- Custom class hierarchies
- Image augmentation preview

---

## 9. Testing Strategy

### 9.1 Manual Testing
- Test with sample YOLO dataset
- Test with sample COCO dataset
- Test in Chrome, Firefox, Safari
- Test file:// protocol vs. http:// server
- Test with large datasets (1000+ images)
- Test with various image sizes and aspect ratios

### 9.2 Edge Cases
- Empty folders
- Folders with no images
- Images with no annotations
- Malformed annotation files
- Very large images (> 10MB)
- Images with spaces/special characters in filenames
- Nested folder structures

### 9.3 Performance Targets
- Load folder of 100 images: < 2 seconds
- Switch between images: < 200ms
- Draw box: immediate feedback
- Save annotation: < 100ms
- Zoom/pan: 60fps

---

## 10. Documentation

### 10.1 README.md Contents
- Project description
- Quick start guide
- Installation instructions (local server setup)
- Format specifications
- Keyboard shortcuts reference
- Troubleshooting
- License

### 10.2 In-App Help
- "?" button for keyboard shortcuts overlay
- Tooltips on hover for buttons
- Format selection helper text
- First-run tutorial (optional)

---

## 11. Success Metrics

- **Primary:** Tool successfully loads and saves both YOLO and COCO formats
- **Usability:** Users can annotate 100 images in < 30 minutes
- **Reliability:** Zero data loss during normal operation
- **Distribution:** Single-file download works on all target browsers
- **Performance:** Smooth interaction at 60fps for typical datasets

---

**End of Specification**
