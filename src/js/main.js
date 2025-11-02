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

        // Format handlers registry
        this.formatHandlers = new Map([
            ['yolo', new YOLOHandler()],
            ['coco', new COCOHandler()]
        ]);
        this.currentHandler = this.formatHandlers.get('yolo'); // Default to YOLO

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
        // Load YOLO button
        document.getElementById('loadYoloBtn').addEventListener('click', () => {
            this.currentHandler = this.formatHandlers.get('yolo');
            this.store.setFormat('yolo');
            this.handleOpenFolder();
        });

        // Load COCO button
        document.getElementById('loadCocoBtn').addEventListener('click', () => {
            this.currentHandler = this.formatHandlers.get('coco');
            this.store.setFormat('coco');
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
            // Clear all prior state IMMEDIATELY when user attempts to load a folder
            // This happens regardless of whether the load succeeds or fails
            this.store.clear();
            this.currentImageCache.clear();
            this.imageCanvas.clear();
            this.cocoHandler.initEmpty();
            this.yoloHandler.setClasses([]);
            this.fileManager.clear();  // Clear file cache to prevent reading stale files

            this.uiController.setStatus('Opening folder...');

            // Check API support
            if (!this.fileManager.isFileSystemAccessSupported()) {
                this.uiController.showToast('error', 'File System Access API not supported in this browser');
                return;
            }

            // Open folder
            const files = await this.fileManager.openFolder();

            if (files.length === 0) {
                throw new Error('No images found in selected folder');
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

            // Populate store with loaded annotations
            this.store.setClasses(classes);
            for (const [imageId, imageBoxes] of boxes.entries()) {
                imageBoxes.forEach(box => {
                    this.store.addBox({
                        ...box,
                        imageId
                    });
                });
            }

            // Load first image
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

            // Don't save if there are no changes
            if (!this.store.isCurrentImageModified()) {
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
            this.uiController.setStatus('Ready');

        } catch (error) {
            console.error('Error saving:', error);
            this.uiController.showToast('error', 'Failed to save: ' + error.message);
            this.uiController.setStatus('Error');
        }
    }

}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.notatoApp = new NotatoApp();
});
