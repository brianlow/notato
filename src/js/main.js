/**
 * main.js
 * Application initialization and orchestration
 */

import AnnotationStore from './AnnotationStore.js';
import FileManager from './FileManager.js';
import YOLOHandler from './YOLOHandler.js';
import COCOHandler from './COCOHandler.js';
import ImageCanvas from './ImageCanvas.js';
import BoxEditor from './BoxEditor.js';
import UIController from './UIController.js';

class NotatoApp {
    constructor() {
        // Initialize modules
        this.store = new AnnotationStore();
        this.fileManager = new FileManager();
        this.yoloHandler = new YOLOHandler();
        this.cocoHandler = new COCOHandler();

        // Get canvas
        const canvas = document.getElementById('mainCanvas');
        this.imageCanvas = new ImageCanvas(canvas, this.store);
        this.boxEditor = new BoxEditor(canvas, this.imageCanvas, this.store);
        this.uiController = new UIController(this.store, this.imageCanvas);

        this.currentImageCache = new Map(); // imageId -> image data URL

        this.setupEventListeners();
        this.initialize();
    }

    /**
     * Initialize application
     */
    initialize() {
        // Set default class
        this.store.setClasses(['object']);
        this.uiController.setStatus('Ready');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Open folder button
        document.getElementById('openFolderBtn').addEventListener('click', () => {
            this.handleOpenFolder();
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.handleSave();
        });

        // Image selection
        document.addEventListener('imageSelected', (e) => {
            this.loadImage(e.detail.imageId);
        });

        // Save request
        document.addEventListener('saveRequested', () => {
            this.handleSave();
        });
    }

    /**
     * Handle opening a folder
     */
    async handleOpenFolder() {
        try {
            this.uiController.setStatus('Opening folder...');

            // Check API support
            if (!this.fileManager.isFileSystemAccessSupported()) {
                this.uiController.showToast('error', 'File System Access API not supported in this browser');
                return;
            }

            // Open folder
            const files = await this.fileManager.openFolder();

            if (files.length === 0) {
                this.uiController.showToast('warning', 'No images found in folder');
                return;
            }

            this.uiController.setStatus(`Loading ${files.length} images...`);
            this.uiController.setFolderPath(this.fileManager.getDirectoryName());

            // Load images into store
            for (const file of files) {
                const imageData = await this.fileManager.loadImage(file.file);

                const imageId = this.store.addImage({
                    fileName: file.name,
                    filePath: file.path,
                    width: imageData.width,
                    height: imageData.height,
                    subfolder: file.subfolder
                });

                this.currentImageCache.set(imageId, imageData.url);
            }

            // Load annotations based on format
            const format = this.store.getState().format;
            if (format === 'yolo') {
                await this.loadYOLOAnnotations();
            } else {
                await this.loadCOCOAnnotations();
            }

            // Load first image
            const images = this.store.getAllImages();
            if (images.length > 0) {
                this.loadImage(images[0].id);
            }

            this.uiController.showToast('success', `Loaded ${files.length} images`);
            this.uiController.setStatus('Ready');

        } catch (error) {
            console.error('Error opening folder:', error);
            this.uiController.showToast('error', error.message);
            this.uiController.setStatus('Error');
        }
    }

    /**
     * Load YOLO annotations
     */
    async loadYOLOAnnotations() {
        const images = this.store.getAllImages();

        // Try to load classes.txt
        let classesContent = await this.fileManager.readTextFile('classes.txt');
        if (!classesContent) {
            // Try in labels folder
            classesContent = await this.fileManager.readTextFile('labels/classes.txt');
        }

        if (classesContent) {
            const classes = this.yoloHandler.parseClasses(classesContent);
            this.store.setClasses(classes);
        } else {
            // Will infer classes from annotations
            this.store.setClasses(['object']);
        }

        // Load annotations for each image
        for (const image of images) {
            const labelPath = this.fileManager.getYOLOLabelPath(image.filePath);
            const content = await this.fileManager.readTextFile(labelPath);

            if (content) {
                const boxes = this.yoloHandler.parse(content, image.width, image.height);

                boxes.forEach(box => {
                    this.store.addBox({
                        ...box,
                        imageId: image.id
                    });
                });
            }
        }

        // Infer classes from loaded boxes if needed
        if (this.store.getClasses().length === 1) {
            const boxes = Array.from(this.store.getState().boxes.values());
            const maxClassId = Math.max(0, ...boxes.map(b => b.classId));

            if (maxClassId > 0) {
                const classes = [];
                for (let i = 0; i <= maxClassId; i++) {
                    classes.push(`class_${i}`);
                }
                this.store.setClasses(classes);
            }
        }
    }

    /**
     * Load COCO annotations
     */
    async loadCOCOAnnotations() {
        // Try to find annotations.json or instances_default.json
        let content = await this.fileManager.readTextFile('annotations.json');
        if (!content) {
            content = await this.fileManager.readTextFile('instances_default.json');
        }

        if (content) {
            this.cocoHandler.parse(content);

            // Load categories
            const categories = this.cocoHandler.getCategories();
            if (categories.length > 0) {
                const classNames = categories.map(cat => cat.name);
                this.store.setClasses(classNames);
            }

            // Load annotations for each image
            const images = this.store.getAllImages();
            for (const image of images) {
                const boxes = this.cocoHandler.getBoxesForImage(image.fileName);

                boxes.forEach(box => {
                    this.store.addBox({
                        ...box,
                        imageId: image.id
                    });
                });
            }
        } else {
            // Initialize empty COCO dataset
            this.cocoHandler.initEmpty();
            this.store.setClasses(['object']);
        }
    }

    /**
     * Load and display an image
     */
    async loadImage(imageId) {
        try {
            const image = this.store.getImage(imageId);
            if (!image) return;

            this.uiController.setStatus('Loading image...');

            // Set current image BEFORE loading so render() uses correct boxes
            this.store.setCurrentImage(imageId);

            const imageUrl = this.currentImageCache.get(imageId);
            await this.imageCanvas.loadImage(imageUrl, image.width, image.height);

            this.uiController.setStatus('Ready');

        } catch (error) {
            console.error('Error loading image:', error);
            this.uiController.showToast('error', 'Failed to load image');
        }
    }

    /**
     * Save current image annotations
     */
    async handleSave() {
        try {
            const currentImage = this.store.getCurrentImage();
            if (!currentImage) {
                this.uiController.showToast('warning', 'No image loaded');
                return;
            }

            this.uiController.setStatus('Saving...');

            const format = this.store.getState().format;

            if (format === 'yolo') {
                await this.saveYOLO(currentImage);
            } else {
                await this.saveCOCO();
            }

            this.store.clearImageModified(currentImage.id);
            this.uiController.showToast('success', 'Saved successfully');
            this.uiController.setStatus('Ready');

        } catch (error) {
            console.error('Error saving:', error);
            this.uiController.showToast('error', 'Failed to save: ' + error.message);
            this.uiController.setStatus('Error');
        }
    }

    /**
     * Save YOLO format
     */
    async saveYOLO(image) {
        const boxes = this.store.getBoxesForImage(image.id);
        const content = this.yoloHandler.stringify(boxes, image.width, image.height);

        const labelPath = this.fileManager.getYOLOLabelPath(image.filePath);
        await this.fileManager.writeTextFile(labelPath, content);

        // Save classes.txt if it doesn't exist
        const classesExist = await this.fileManager.fileExists('classes.txt');
        if (!classesExist) {
            const classes = this.store.getClasses();
            this.yoloHandler.setClasses(classes);
            const classesContent = this.yoloHandler.stringifyClasses(classes);
            await this.fileManager.writeTextFile('classes.txt', classesContent);
        }
    }

    /**
     * Save COCO format
     */
    async saveCOCO() {
        // Update COCO data with all images and annotations
        const images = this.store.getAllImages();
        const categories = this.store.getClasses();

        // Set categories
        const cocoCategories = categories.map((name, index) => ({
            id: index + 1,
            name: name,
            supercategory: 'none'
        }));
        this.cocoHandler.setCategories(cocoCategories);

        // Update all images and their annotations
        for (const image of images) {
            const boxes = this.store.getBoxesForImage(image.id);

            // Adjust class IDs for COCO (1-indexed)
            const cocoBoxes = boxes.map(box => ({
                ...box,
                classId: box.classId + 1
            }));

            this.cocoHandler.setBoxesForImage(
                image.fileName,
                cocoBoxes,
                image.width,
                image.height
            );
        }

        // Write annotations.json
        const content = this.cocoHandler.stringify();
        await this.fileManager.writeTextFile('annotations.json', content);

        // Clear modified flag for all images
        images.forEach(img => {
            this.store.clearImageModified(img.id);
        });
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.notatoApp = new NotatoApp();
});
