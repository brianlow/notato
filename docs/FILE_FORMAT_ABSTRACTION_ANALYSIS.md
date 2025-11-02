# File Format Abstraction Analysis & Refactoring Proposals

## Executive Summary

The current architecture couples format-specific knowledge throughout `main.js`, making it difficult to add new formats. This document proposes three refactoring approaches with increasing levels of abstraction, along with concrete implementation examples.

**Key Goals:**
- Easy to add new formats (e.g., Ultralytics YOLO with .yaml)
- Hide file-specific details from UI/main.js
- UI knows about labels, images, boxes but not load/save mechanics
- Maintain backward compatibility

---

## Current Architecture Issues

### 1. Format Knowledge Scattered Across Files

**main.js (364 lines):**
- Lines 49-58: Format selection in event listeners
- Lines 119-124: If/else branching for load
- Lines 145-193: `loadYOLOAnnotations()` with path logic
- Lines 198-247: `loadCOCOAnnotations()` with filename discovery
- Lines 291-297: If/else branching for save
- Lines 313-328: `saveYOLO()` with classes.txt creation
- Lines 333-363: `saveCOCO()` with class ID conversion (0→1 indexed)

**FileManager.js:**
- Line 201-207: `getYOLOLabelPath()` - format-specific method

**Problems:**
- Adding new format requires modifying main.js in 5+ places
- Format-specific transforms (class ID indexing) happen in wrong layer
- Hard-coded file naming conventions (`annotations.json`, `classes.txt`)
- No polymorphism - all format logic uses conditional branching

### 2. Inconsistent Handler APIs

**YOLOHandler API:**
```javascript
parse(content, imageWidth, imageHeight) → boxes[]
stringify(boxes, imageWidth, imageHeight) → string
parseClasses(content) → classes[]
stringifyClasses(classes) → string
```

**COCOHandler API:**
```javascript
parse(content) → void (populates internal state)
stringify() → string
getBoxesForImage(fileName) → boxes[]
setBoxesForImage(fileName, boxes, w, h) → void
getCategories() → categories[]
setCategories(categories) → void
```

**Problems:**
- Different signatures prevent polymorphic usage
- YOLO is stateless parser; COCO maintains full dataset state
- main.js must know which methods to call for each format
- No shared interface or base class

### 3. Missing Abstractions

**No Format Registry:**
- New formats can't be plugged in
- Format discovery hard-coded in UI buttons

**No Annotation File Discovery:**
- COCO filenames in array literal (lines 200-205)
- No extensible detection mechanism

**No Coordinate/Class Transformation Layer:**
- YOLO: normalized center → pixel top-left (in handler ✓)
- COCO: 0-indexed → 1-indexed classes (in main.js ✗)
- Inconsistent responsibility placement

---

## Refactoring Options

### Option 1: Minimal Refactoring - Unified Handler Interface

**Effort:** Low (2-3 days)
**Risk:** Low
**Extensibility:** Medium

#### Approach
Create a consistent interface without major restructuring. Extract format-specific logic from main.js into handlers.

#### Implementation

**New: `FormatHandler` base class**
```javascript
// src/js/FormatHandler.js
class FormatHandler {
    /**
     * Get format name
     * @returns {string}
     */
    getName() {
        throw new Error('Must implement getName()');
    }

    /**
     * Get possible annotation file patterns
     * @returns {string[]} - Array of glob patterns or filenames
     */
    getAnnotationFilePatterns() {
        throw new Error('Must implement getAnnotationFilePatterns()');
    }

    /**
     * Load annotations from folder
     * @param {FileManager} fileManager
     * @param {Array} images - Array of image objects
     * @returns {Promise<Object>} - {boxes: Map<imageId, boxes[]>, classes: string[]}
     */
    async load(fileManager, images) {
        throw new Error('Must implement load()');
    }

    /**
     * Save annotations for current image
     * @param {FileManager} fileManager
     * @param {Object} image - Image object
     * @param {Array} boxes - Box objects
     * @param {Array} classes - Class names
     * @returns {Promise<void>}
     */
    async save(fileManager, image, boxes, classes) {
        throw new Error('Must implement save()');
    }

    /**
     * Get label file path for an image (format-specific)
     * @param {string} imagePath - Image file path
     * @returns {string|null} - Label file path or null if N/A
     */
    getLabelPath(imagePath) {
        return null; // Override if format uses per-image files
    }
}

export default FormatHandler;
```

**Updated: `YOLOHandler` extends `FormatHandler`**
```javascript
// src/js/YOLOHandler.js
import FormatHandler from './FormatHandler.js';

class YOLOHandler extends FormatHandler {
    constructor() {
        super();
        this.classes = [];
    }

    getName() {
        return 'yolo';
    }

    getAnnotationFilePatterns() {
        return ['classes.txt', 'labels/classes.txt'];
    }

    /**
     * Load all annotations from folder
     */
    async load(fileManager, images) {
        const boxes = new Map();

        // Try to load classes.txt
        let classesContent = await fileManager.readTextFile('classes.txt');
        if (!classesContent) {
            classesContent = await fileManager.readTextFile('labels/classes.txt');
        }

        let classes = ['object'];
        if (classesContent) {
            classes = this.parseClasses(classesContent);
        }
        this.classes = classes;

        // Load annotations for each image
        for (const image of images) {
            const labelPath = this.getLabelPath(image.filePath);
            const content = await fileManager.readTextFile(labelPath);

            if (content) {
                const imageBoxes = this.parse(content, image.width, image.height);
                boxes.set(image.id, imageBoxes);
            }
        }

        // Infer classes if needed
        if (classes.length === 1) {
            const allBoxes = Array.from(boxes.values()).flat();
            const maxClassId = Math.max(0, ...allBoxes.map(b => b.classId));

            if (maxClassId > 0) {
                classes = [];
                for (let i = 0; i <= maxClassId; i++) {
                    classes.push(`class_${i}`);
                }
                this.classes = classes;
            }
        }

        return { boxes, classes };
    }

    /**
     * Save annotations for current image
     */
    async save(fileManager, image, boxes, classes) {
        const content = this.stringify(boxes, image.width, image.height);
        const labelPath = this.getLabelPath(image.filePath);
        await fileManager.writeTextFile(labelPath, content);

        // Save classes.txt if it doesn't exist
        const classesExist = await fileManager.fileExists('classes.txt');
        if (!classesExist) {
            this.classes = classes;
            const classesContent = this.stringifyClasses(classes);
            await fileManager.writeTextFile('classes.txt', classesContent);
        }
    }

    getLabelPath(imagePath) {
        const fileName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        return `${baseName}.txt`;
    }

    // Keep existing parse, stringify, parseClasses, stringifyClasses methods...
    parse(content, imageWidth, imageHeight) { /* existing code */ }
    stringify(boxes, imageWidth, imageHeight) { /* existing code */ }
    parseClasses(content) { /* existing code */ }
    stringifyClasses(classes) { /* existing code */ }
}

export default YOLOHandler;
```

**Updated: `COCOHandler` extends `FormatHandler`**
```javascript
// src/js/COCOHandler.js
import FormatHandler from './FormatHandler.js';

class COCOHandler extends FormatHandler {
    constructor() {
        super();
        this.data = { images: [], annotations: [], categories: [] };
        this.nextImageId = 1;
        this.nextAnnotationId = 1;
        this.imageIdMap = new Map();
        this.annotationFile = 'annotations.json'; // Track which file to save to
    }

    getName() {
        return 'coco';
    }

    getAnnotationFilePatterns() {
        return [
            'annotations.json',
            '_annotations.coco.json',
            'instances_default.json',
            'instances.json'
        ];
    }

    /**
     * Load all annotations from folder
     */
    async load(fileManager, images) {
        const boxes = new Map();

        // Try to find annotations file
        const patterns = this.getAnnotationFilePatterns();
        let content = null;
        for (const pattern of patterns) {
            content = await fileManager.readTextFile(pattern);
            if (content) {
                console.log(`Found COCO annotations: ${pattern}`);
                this.annotationFile = pattern;
                break;
            }
        }

        let classes = ['object'];

        if (content) {
            this.parse(content);

            // Load categories
            const categories = this.getCategories();
            if (categories.length > 0) {
                classes = categories.map(cat => cat.name);
            }

            // Load annotations for each image
            for (const image of images) {
                const imageBoxes = this.getBoxesForImage(image.fileName);

                // Convert COCO 1-indexed class IDs to 0-indexed
                const normalizedBoxes = imageBoxes.map(box => ({
                    ...box,
                    classId: box.classId - 1 // COCO uses 1-indexed
                }));

                boxes.set(image.id, normalizedBoxes);
            }
        } else {
            // No annotation file found
            console.log('No COCO annotations found. Starting with empty dataset.');
            this.annotationFile = '_annotations.coco.json';
            this.initEmpty();
        }

        return { boxes, classes };
    }

    /**
     * Save annotations for current image
     */
    async save(fileManager, image, boxes, classes) {
        // Set categories
        const cocoCategories = classes.map((name, index) => ({
            id: index + 1, // COCO uses 1-indexed
            name: name,
            supercategory: 'none'
        }));
        this.setCategories(cocoCategories);

        // Convert 0-indexed to COCO 1-indexed
        const cocoBoxes = boxes.map(box => ({
            ...box,
            classId: box.classId + 1
        }));

        this.setBoxesForImage(
            image.fileName,
            cocoBoxes,
            image.width,
            image.height
        );

        // Write to file
        const content = this.stringify();
        await fileManager.writeTextFile(this.annotationFile, content);
    }

    // Keep existing COCO-specific methods...
    parse(content) { /* existing code */ }
    stringify() { /* existing code */ }
    getBoxesForImage(fileName) { /* existing code */ }
    setBoxesForImage(fileName, boxes, w, h) { /* existing code */ }
    // ... etc
}

export default COCOHandler;
```

**Simplified: `main.js`**
```javascript
class NotatoApp {
    constructor() {
        this.store = new AnnotationStore();
        this.fileManager = new FileManager();

        // Format registry
        this.formatHandlers = new Map([
            ['yolo', new YOLOHandler()],
            ['coco', new COCOHandler()]
        ]);

        this.currentHandler = this.formatHandlers.get('yolo');
        // ... rest of initialization
    }

    setupEventListeners() {
        document.getElementById('loadYoloBtn').addEventListener('click', () => {
            this.store.setFormat('yolo');
            this.currentHandler = this.formatHandlers.get('yolo');
            this.handleOpenFolder();
        });

        document.getElementById('loadCocoBtn').addEventListener('click', () => {
            this.store.setFormat('coco');
            this.currentHandler = this.formatHandlers.get('coco');
            this.handleOpenFolder();
        });
    }

    async handleOpenFolder() {
        // ... existing setup code ...

        // Load images into store
        for (const file of files) {
            const imageData = await this.fileManager.loadImage(file.file);
            const imageId = this.store.addImage({
                fileName: file.name,
                filePath: file.path,
                width: imageData.width,
                height: imageData.height
            });
            this.currentImageCache.set(imageId, imageData.url);
        }

        // Load annotations using current handler
        const images = this.store.getAllImages();
        const { boxes, classes } = await this.currentHandler.load(
            this.fileManager,
            images
        );

        // Populate store
        this.store.setClasses(classes);
        for (const [imageId, imageBoxes] of boxes.entries()) {
            imageBoxes.forEach(box => {
                this.store.addBox({ ...box, imageId });
            });
        }

        // ... rest of loading code ...
    }

    async handleSave() {
        const currentImage = this.store.getCurrentImage();
        if (!currentImage || !this.store.isCurrentImageModified()) {
            return;
        }

        this.uiController.setStatus('Saving...');

        const boxes = this.store.getBoxesForImage(currentImage.id);
        const classes = this.store.getClasses();

        await this.currentHandler.save(
            this.fileManager,
            currentImage,
            boxes,
            classes
        );

        this.store.clearImageModified();
        this.uiController.showToast('success', 'Saved successfully');
    }
}
```

#### Changes Required
1. Create `FormatHandler.js` base class
2. Refactor `YOLOHandler` to extend base class and implement `load()`/`save()`
3. Refactor `COCOHandler` to extend base class and implement `load()`/`save()`
4. Simplify `main.js` - remove format-specific load/save methods
5. Remove `getYOLOLabelPath()` from `FileManager` (moved to handler)

#### Pros
- ✅ Reduces main.js from 364 → ~250 lines
- ✅ Format-specific logic encapsulated in handlers
- ✅ Class ID conversion moved to correct layer (handlers)
- ✅ Easy to add new formats - just create new handler
- ✅ Backward compatible - no data model changes

#### Cons
- ⚠️ Handlers still stateful (especially COCO)
- ⚠️ No validation or format detection
- ⚠️ UI still knows about format selection

---

### Option 2: Format Strategy Pattern with Auto-Detection

**Effort:** Medium (1 week)
**Risk:** Medium
**Extensibility:** High

#### Approach
Implement full Strategy pattern with format auto-detection. UI becomes format-agnostic.

#### Implementation

**New: `FormatDetector`**
```javascript
// src/js/FormatDetector.js
class FormatDetector {
    constructor(formatHandlers) {
        this.handlers = formatHandlers;
    }

    /**
     * Auto-detect format from folder contents
     * @param {FileManager} fileManager
     * @returns {Promise<FormatHandler|null>}
     */
    async detectFormat(fileManager) {
        for (const handler of this.handlers) {
            const detected = await this.checkFormat(fileManager, handler);
            if (detected) {
                console.log(`Auto-detected format: ${handler.getName()}`);
                return handler;
            }
        }
        return null;
    }

    /**
     * Check if folder matches a specific format
     */
    async checkFormat(fileManager, handler) {
        const patterns = handler.getAnnotationFilePatterns();

        for (const pattern of patterns) {
            const exists = await fileManager.fileExists(pattern);
            if (exists) {
                return true;
            }
        }

        // Check format-specific characteristics
        if (handler.getName() === 'yolo') {
            // Check for .txt files matching image names
            return await this.checkYOLOStructure(fileManager);
        }

        return false;
    }

    async checkYOLOStructure(fileManager) {
        // Implementation: check if .txt files exist alongside images
        return false; // Simplified
    }
}

export default FormatDetector;
```

**New: `AnnotationLoader` service**
```javascript
// src/js/AnnotationLoader.js
class AnnotationLoader {
    constructor(fileManager, formatHandlers) {
        this.fileManager = fileManager;
        this.formatDetector = new FormatDetector(formatHandlers);
    }

    /**
     * Load annotations with auto-detection or explicit format
     * @param {Array} images
     * @param {string|null} formatName - Force specific format or auto-detect
     * @returns {Promise<Object>} - {handler, boxes, classes}
     */
    async load(images, formatName = null) {
        let handler;

        if (formatName) {
            handler = this.formatHandlers.find(h => h.getName() === formatName);
        } else {
            handler = await this.formatDetector.detectFormat(this.fileManager);
        }

        if (!handler) {
            throw new Error('Could not detect annotation format');
        }

        const { boxes, classes } = await handler.load(this.fileManager, images);

        return { handler, boxes, classes };
    }

    /**
     * Save annotations
     */
    async save(handler, image, boxes, classes) {
        await handler.save(this.fileManager, image, boxes, classes);
    }
}

export default AnnotationLoader;
```

**Updated: `main.js` with auto-detection**
```javascript
class NotatoApp {
    constructor() {
        this.store = new AnnotationStore();
        this.fileManager = new FileManager();

        // Format handlers
        const handlers = [
            new YOLOHandler(),
            new COCOHandler()
        ];

        this.annotationLoader = new AnnotationLoader(this.fileManager, handlers);
        this.currentHandler = null;

        // ... rest
    }

    setupEventListeners() {
        // Single load button - auto-detects format
        document.getElementById('loadFolderBtn').addEventListener('click', () => {
            this.handleOpenFolder();
        });

        // Optional: force-load buttons
        document.getElementById('loadYoloBtn').addEventListener('click', () => {
            this.handleOpenFolder('yolo');
        });

        document.getElementById('loadCocoBtn').addEventListener('click', () => {
            this.handleOpenFolder('coco');
        });
    }

    async handleOpenFolder(formatName = null) {
        // ... load images ...

        const images = this.store.getAllImages();

        try {
            const { handler, boxes, classes } = await this.annotationLoader.load(
                images,
                formatName
            );

            this.currentHandler = handler;
            this.store.setFormat(handler.getName());

            // Populate store
            this.store.setClasses(classes);
            for (const [imageId, imageBoxes] of boxes.entries()) {
                imageBoxes.forEach(box => {
                    this.store.addBox({ ...box, imageId });
                });
            }

            this.uiController.showToast('success',
                `Loaded ${handler.getName().toUpperCase()} format`);

        } catch (error) {
            console.error('Error loading annotations:', error);
            this.uiController.showToast('error', error.message);
        }
    }

    async handleSave() {
        if (!this.currentHandler) {
            this.uiController.showToast('error', 'No format loaded');
            return;
        }

        const currentImage = this.store.getCurrentImage();
        const boxes = this.store.getBoxesForImage(currentImage.id);
        const classes = this.store.getClasses();

        await this.annotationLoader.save(
            this.currentHandler,
            currentImage,
            boxes,
            classes
        );
    }
}
```

#### Changes Required
1. All changes from Option 1
2. Create `FormatDetector` for auto-detection
3. Create `AnnotationLoader` service layer
4. Update UI to optionally support auto-detection
5. Update `AnnotationStore` to track format by name string

#### Pros
- ✅ All benefits from Option 1
- ✅ Auto-detection reduces user friction
- ✅ Service layer separates concerns
- ✅ UI can be format-agnostic
- ✅ Easy to add format-specific validation

#### Cons
- ⚠️ More complex architecture
- ⚠️ Auto-detection can be ambiguous
- ⚠️ More files to maintain

---

### Option 3: Full Plugin Architecture with Format Registry

**Effort:** High (2 weeks)
**Risk:** High
**Extensibility:** Very High

#### Approach
Create a pluggable format system with declarative configuration, validation, and transformation pipelines.

#### Implementation

**New: `FormatPlugin` architecture**
```javascript
// src/js/formats/FormatPlugin.js
class FormatPlugin {
    /**
     * Format metadata
     * @returns {Object}
     */
    getMetadata() {
        return {
            name: 'unknown',
            displayName: 'Unknown Format',
            description: '',
            filePatterns: [],
            extensions: [],
            supportsAutoDetection: false
        };
    }

    /**
     * Validate folder structure
     * @param {FileManager} fileManager
     * @returns {Promise<ValidationResult>}
     */
    async validate(fileManager) {
        throw new Error('Must implement validate()');
    }

    /**
     * Load annotations with progress callback
     * @param {Object} context - {fileManager, images, onProgress}
     * @returns {Promise<AnnotationData>}
     */
    async load({ fileManager, images, onProgress }) {
        throw new Error('Must implement load()');
    }

    /**
     * Save annotations
     * @param {Object} context
     * @returns {Promise<SaveResult>}
     */
    async save({ fileManager, image, boxes, classes }) {
        throw new Error('Must implement save()');
    }

    /**
     * Transform boxes from internal format to plugin format
     */
    transformBoxesToFormat(boxes) {
        return boxes;
    }

    /**
     * Transform boxes from plugin format to internal format
     */
    transformBoxesFromFormat(boxes) {
        return boxes;
    }
}

export default FormatPlugin;
```

**New: `FormatRegistry`**
```javascript
// src/js/formats/FormatRegistry.js
class FormatRegistry {
    constructor() {
        this.plugins = new Map();
    }

    /**
     * Register a format plugin
     */
    register(plugin) {
        const metadata = plugin.getMetadata();
        this.plugins.set(metadata.name, {
            plugin,
            metadata
        });
        console.log(`Registered format: ${metadata.displayName}`);
    }

    /**
     * Get plugin by name
     */
    getPlugin(name) {
        const entry = this.plugins.get(name);
        return entry ? entry.plugin : null;
    }

    /**
     * Get all registered plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values()).map(e => e.plugin);
    }

    /**
     * Get plugin metadata
     */
    getMetadata(name) {
        const entry = this.plugins.get(name);
        return entry ? entry.metadata : null;
    }

    /**
     * Auto-detect format
     */
    async detectFormat(fileManager) {
        for (const { plugin, metadata } of this.plugins.values()) {
            if (!metadata.supportsAutoDetection) continue;

            const validation = await plugin.validate(fileManager);
            if (validation.valid) {
                return plugin;
            }
        }
        return null;
    }
}

export default FormatRegistry;
```

**New: `YOLOPlugin`**
```javascript
// src/js/formats/plugins/YOLOPlugin.js
import FormatPlugin from '../FormatPlugin.js';
import YOLOHandler from '../../YOLOHandler.js';

class YOLOPlugin extends FormatPlugin {
    constructor() {
        super();
        this.handler = new YOLOHandler();
    }

    getMetadata() {
        return {
            name: 'yolo',
            displayName: 'YOLO Format',
            description: 'Darknet YOLO format with normalized coordinates',
            filePatterns: ['*.txt', 'classes.txt'],
            extensions: ['.txt'],
            supportsAutoDetection: true
        };
    }

    async validate(fileManager) {
        // Check for classes.txt or .txt files
        const classesExists = await fileManager.fileExists('classes.txt');

        return {
            valid: classesExists,
            confidence: classesExists ? 0.9 : 0.3,
            message: classesExists ? 'Found classes.txt' : 'No classes.txt found'
        };
    }

    async load({ fileManager, images, onProgress }) {
        const result = await this.handler.load(fileManager, images);

        return {
            boxes: result.boxes,
            classes: result.classes,
            metadata: {
                classesFile: 'classes.txt'
            }
        };
    }

    async save({ fileManager, image, boxes, classes }) {
        await this.handler.save(fileManager, image, boxes, classes);

        return {
            success: true,
            filesWritten: [
                this.handler.getLabelPath(image.filePath),
                'classes.txt'
            ]
        };
    }

    transformBoxesFromFormat(boxes) {
        // YOLO uses 0-indexed classes - no transform needed
        return boxes;
    }

    transformBoxesToFormat(boxes) {
        return boxes;
    }
}

export default YOLOPlugin;
```

**New: `COCOPlugin`**
```javascript
// src/js/formats/plugins/COCOPlugin.js
import FormatPlugin from '../FormatPlugin.js';
import COCOHandler from '../../COCOHandler.js';

class COCOPlugin extends FormatPlugin {
    constructor() {
        super();
        this.handler = new COCOHandler();
    }

    getMetadata() {
        return {
            name: 'coco',
            displayName: 'COCO Format',
            description: 'Microsoft COCO JSON format',
            filePatterns: ['annotations.json', '*.coco.json', 'instances*.json'],
            extensions: ['.json'],
            supportsAutoDetection: true
        };
    }

    async validate(fileManager) {
        const patterns = this.handler.getAnnotationFilePatterns();

        for (const pattern of patterns) {
            const exists = await fileManager.fileExists(pattern);
            if (exists) {
                return {
                    valid: true,
                    confidence: 1.0,
                    message: `Found COCO file: ${pattern}`
                };
            }
        }

        return {
            valid: false,
            confidence: 0.0,
            message: 'No COCO annotation file found'
        };
    }

    async load({ fileManager, images, onProgress }) {
        const result = await this.handler.load(fileManager, images);

        return {
            boxes: result.boxes,
            classes: result.classes,
            metadata: {
                annotationFile: this.handler.annotationFile
            }
        };
    }

    async save({ fileManager, image, boxes, classes }) {
        await this.handler.save(fileManager, image, boxes, classes);

        return {
            success: true,
            filesWritten: [this.handler.annotationFile]
        };
    }

    transformBoxesFromFormat(boxes) {
        // COCO uses 1-indexed classes - convert to 0-indexed
        return boxes.map(box => ({
            ...box,
            classId: box.classId - 1
        }));
    }

    transformBoxesToFormat(boxes) {
        // Convert 0-indexed to 1-indexed for COCO
        return boxes.map(box => ({
            ...box,
            classId: box.classId + 1
        }));
    }
}

export default COCOPlugin;
```

**New: Ultralytics YOLO format example**
```javascript
// src/js/formats/plugins/UltralyticsYOLOPlugin.js
import FormatPlugin from '../FormatPlugin.js';
import jsyaml from 'js-yaml'; // Would need to add dependency

class UltralyticsYOLOPlugin extends FormatPlugin {
    constructor() {
        super();
        this.config = null;
    }

    getMetadata() {
        return {
            name: 'ultralytics-yolo',
            displayName: 'Ultralytics YOLO',
            description: 'Ultralytics YOLO v5/v8 format with data.yaml',
            filePatterns: ['data.yaml', 'dataset.yaml'],
            extensions: ['.yaml', '.yml'],
            supportsAutoDetection: true
        };
    }

    async validate(fileManager) {
        const yamlExists = await fileManager.fileExists('data.yaml');

        if (yamlExists) {
            const content = await fileManager.readTextFile('data.yaml');
            try {
                const config = jsyaml.load(content);
                if (config.names || config.nc) {
                    return {
                        valid: true,
                        confidence: 1.0,
                        message: 'Valid Ultralytics YOLO data.yaml'
                    };
                }
            } catch (e) {
                // Invalid YAML
            }
        }

        return {
            valid: false,
            confidence: 0.0,
            message: 'No valid data.yaml found'
        };
    }

    async load({ fileManager, images, onProgress }) {
        // Read data.yaml
        const yamlContent = await fileManager.readTextFile('data.yaml');
        this.config = jsyaml.load(yamlContent);

        // Extract class names
        const classes = this.config.names || [];

        const boxes = new Map();

        // Load labels from path specified in YAML
        const labelsPath = this.config.path ?
            `${this.config.path}/labels/train` :
            'labels/train';

        for (const image of images) {
            const labelFile = `${labelsPath}/${this.getBaseName(image.fileName)}.txt`;
            const content = await fileManager.readTextFile(labelFile);

            if (content) {
                const imageBoxes = this.parseYOLO(content, image.width, image.height);
                boxes.set(image.id, imageBoxes);
            }

            if (onProgress) {
                onProgress(images.indexOf(image) / images.length);
            }
        }

        return {
            boxes,
            classes,
            metadata: {
                config: this.config,
                yamlFile: 'data.yaml'
            }
        };
    }

    async save({ fileManager, image, boxes, classes }) {
        // Update data.yaml if needed
        if (!this.config) {
            this.config = {
                path: '.',
                train: 'images/train',
                val: 'images/val',
                nc: classes.length,
                names: classes
            };

            const yamlContent = jsyaml.dump(this.config);
            await fileManager.writeTextFile('data.yaml', yamlContent);
        }

        // Save label file
        const labelPath = `labels/train/${this.getBaseName(image.fileName)}.txt`;
        const content = this.stringifyYOLO(boxes, image.width, image.height);
        await fileManager.writeTextFile(labelPath, content);

        return {
            success: true,
            filesWritten: [labelPath, 'data.yaml']
        };
    }

    parseYOLO(content, width, height) {
        // Similar to YOLOHandler.parse()
        // ... implementation
    }

    stringifyYOLO(boxes, width, height) {
        // Similar to YOLOHandler.stringify()
        // ... implementation
    }

    getBaseName(fileName) {
        return fileName.substring(0, fileName.lastIndexOf('.'));
    }
}

export default UltralyticsYOLOPlugin;
```

**Updated: `main.js` with registry**
```javascript
import FormatRegistry from './formats/FormatRegistry.js';
import YOLOPlugin from './formats/plugins/YOLOPlugin.js';
import COCOPlugin from './formats/plugins/COCOPlugin.js';
import UltralyticsYOLOPlugin from './formats/plugins/UltralyticsYOLOPlugin.js';

class NotatoApp {
    constructor() {
        this.store = new AnnotationStore();
        this.fileManager = new FileManager();

        // Initialize format registry
        this.formatRegistry = new FormatRegistry();
        this.formatRegistry.register(new YOLOPlugin());
        this.formatRegistry.register(new COCOPlugin());
        this.formatRegistry.register(new UltralyticsYOLOPlugin());

        this.currentPlugin = null;

        // ... rest of initialization
    }

    setupEventListeners() {
        // Auto-detect format
        document.getElementById('loadFolderBtn').addEventListener('click', () => {
            this.handleOpenFolder();
        });

        // Format-specific load buttons
        this.generateFormatButtons();
    }

    /**
     * Dynamically generate load buttons from registry
     */
    generateFormatButtons() {
        const container = document.getElementById('formatButtons');

        for (const plugin of this.formatRegistry.getAllPlugins()) {
            const metadata = plugin.getMetadata();
            const button = document.createElement('button');
            button.textContent = `Load ${metadata.displayName}`;
            button.title = metadata.description;
            button.addEventListener('click', () => {
                this.handleOpenFolder(metadata.name);
            });
            container.appendChild(button);
        }
    }

    async handleOpenFolder(formatName = null) {
        // ... load images ...

        const images = this.store.getAllImages();
        let plugin;

        if (formatName) {
            plugin = this.formatRegistry.getPlugin(formatName);
        } else {
            // Auto-detect
            plugin = await this.formatRegistry.detectFormat(this.fileManager);
        }

        if (!plugin) {
            throw new Error('Could not detect format');
        }

        // Validate
        const validation = await plugin.validate(this.fileManager);
        if (!validation.valid) {
            throw new Error(`Invalid format: ${validation.message}`);
        }

        // Load with progress
        const { boxes, classes, metadata } = await plugin.load({
            fileManager: this.fileManager,
            images,
            onProgress: (progress) => {
                this.uiController.setProgress(progress);
            }
        });

        this.currentPlugin = plugin;
        const pluginMetadata = plugin.getMetadata();
        this.store.setFormat(pluginMetadata.name);

        // Populate store
        this.store.setClasses(classes);
        for (const [imageId, imageBoxes] of boxes.entries()) {
            imageBoxes.forEach(box => {
                this.store.addBox({ ...box, imageId });
            });
        }

        this.uiController.showToast('success',
            `Loaded ${pluginMetadata.displayName} format`);
    }

    async handleSave() {
        if (!this.currentPlugin) {
            this.uiController.showToast('error', 'No format loaded');
            return;
        }

        const currentImage = this.store.getCurrentImage();
        const boxes = this.store.getBoxesForImage(currentImage.id);
        const classes = this.store.getClasses();

        const result = await this.currentPlugin.save({
            fileManager: this.fileManager,
            image: currentImage,
            boxes,
            classes
        });

        if (result.success) {
            console.log('Files written:', result.filesWritten);
            this.store.clearImageModified();
            this.uiController.showToast('success', 'Saved successfully');
        }
    }
}
```

#### Changes Required
1. Create full plugin architecture:
   - `FormatPlugin` base class
   - `FormatRegistry`
   - Plugin wrappers for YOLO/COCO
2. Move all format logic to plugins
3. Remove format-specific code from main.js
4. Dynamic UI generation from registry
5. Add validation and error handling
6. Optional: Add `UltralyticsYOLOPlugin` as example

#### Pros
- ✅ Fully extensible - new formats are drop-in plugins
- ✅ Validation and error handling built-in
- ✅ Transformation layer for coordinate/class conversions
- ✅ Progress callbacks for long operations
- ✅ Dynamic UI generation
- ✅ Easy to test - plugins are isolated
- ✅ Can distribute formats as separate packages

#### Cons
- ⚠️ Significant refactoring effort
- ⚠️ Over-engineered for current needs
- ⚠️ More complex mental model
- ⚠️ Harder to debug with extra abstraction layers

---

## Comparison Matrix

| Feature | Option 1 | Option 2 | Option 3 |
|---------|----------|----------|----------|
| **Effort** | 2-3 days | 1 week | 2 weeks |
| **Risk** | Low | Medium | High |
| **Code Reduction** | -30% | -40% | -50% |
| **New Format Time** | 1-2 days | 1 day | 2-4 hours |
| **Auto-Detection** | ❌ | ✅ | ✅ |
| **Validation** | ❌ | ❌ | ✅ |
| **Plugin System** | ❌ | ❌ | ✅ |
| **Backward Compat** | ✅ | ✅ | ⚠️ |
| **Testing Complexity** | Low | Medium | High |
| **Maintenance** | Medium | Medium | Low (after initial setup) |

---

## Recommendations

### For Immediate Implementation: **Option 1**
- Lowest risk, quickest win
- Addresses 80% of coupling issues
- Can evolve to Option 2 later
- Good balance of simplicity and extensibility

### For Long-Term: **Option 2**
- Best balance of features and complexity
- Auto-detection is valuable UX improvement
- Service layer provides good separation
- Natural evolution from Option 1

### For Framework/Library: **Option 3**
- Only if planning to support 5+ formats
- Over-engineered for current needs
- Good if distributing as library/framework
- Can implement incrementally from Option 2

---

## Migration Path

### Phase 1: Option 1 (Week 1)
1. Create `FormatHandler` base class
2. Refactor `YOLOHandler` to implement interface
3. Refactor `COCOHandler` to implement interface
4. Simplify `main.js` load/save methods
5. Add tests for handlers

### Phase 2: Option 2 (Week 2-3)
1. Create `FormatDetector`
2. Create `AnnotationLoader` service
3. Add validation logic
4. Update UI for auto-detection
5. Add integration tests

### Phase 3: Option 3 (Future)
1. Create `FormatPlugin` architecture
2. Migrate handlers to plugins
3. Create `FormatRegistry`
4. Dynamic UI generation
5. Add `UltralyticsYOLOPlugin` as proof-of-concept

---

## Example: Adding New Format (Comparison)

### Option 1: Unified Interface
**Time:** 1-2 days
**Files Modified:** 2 (new handler + main.js registration)

```javascript
// 1. Create new handler
class PascalVOCHandler extends FormatHandler {
    getName() { return 'pascal-voc'; }
    getAnnotationFilePatterns() { return ['*.xml']; }
    async load(fileManager, images) { /* ... */ }
    async save(fileManager, image, boxes, classes) { /* ... */ }
}

// 2. Register in main.js
this.formatHandlers.set('pascal-voc', new PascalVOCHandler());
```

### Option 2: Strategy with Auto-Detection
**Time:** 1 day
**Files Modified:** 1 (new handler only)

```javascript
// Same as Option 1, auto-detection works automatically
class PascalVOCHandler extends FormatHandler {
    // ... same as Option 1
}

// Auto-registration in AnnotationLoader
```

### Option 3: Plugin System
**Time:** 2-4 hours
**Files Modified:** 1 (new plugin only)

```javascript
// 1. Create plugin
class PascalVOCPlugin extends FormatPlugin {
    getMetadata() { /* ... */ }
    async validate(fileManager) { /* ... */ }
    async load({ fileManager, images }) { /* ... */ }
    async save({ fileManager, image, boxes, classes }) { /* ... */ }
}

// 2. Register (single line in main.js)
this.formatRegistry.register(new PascalVOCPlugin());

// UI buttons auto-generate, auto-detection works
```

---

## Conclusion

The current architecture couples format knowledge throughout the codebase, making new format support difficult. Three refactoring approaches are proposed:

1. **Option 1 (Recommended):** Minimal refactoring with unified handler interface - quick win with low risk
2. **Option 2:** Strategy pattern with auto-detection - best long-term balance
3. **Option 3:** Full plugin architecture - over-engineered for current needs

**Recommended Path:** Implement Option 1 immediately, then evolve to Option 2 as needed. Option 3 only if planning extensive format ecosystem.

All options achieve the core goals:
- ✅ Easy to add new formats
- ✅ Hide file-specific knowledge from UI
- ✅ UI knows about concepts (labels, boxes) not mechanics (files, paths)
