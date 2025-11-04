/**
 * AnnotationStore.js
 * Manages in-memory data model for annotations
 * Tracks modifications and provides CRUD operations
 */

class AnnotationStore {
    constructor() {
        this.state = {
            format: 'yolo',
            folderHandle: null,
            images: new Map(),
            boxes: new Map(),
            classes: [],
            currentImageId: null,
            selectedBoxId: null,
            currentClassId: 0,
            zoom: 1.0,
            panX: 0,
            panY: 0,
            showBoxes: true,
            currentImageModified: false
        };

        this.listeners = new Map();
        this.nextBoxId = 1;
        this.nextImageId = 1;
        this.savedBoxesState = null; // Stores original boxes for current image
    }

    /**
     * Get current state
     * @returns {Object} Application state
     */
    getState() {
        return this.state;
    }

    /**
     * Set format (yolo or coco)
     * @param {string} format - Format type
     */
    setFormat(format) {
        this.state.format = format;
        this.notify('format', format);
    }

    /**
     * Set folder handle
     * @param {FileSystemDirectoryHandle} handle - Folder handle
     */
    setFolderHandle(handle) {
        this.state.folderHandle = handle;
        this.notify('folderHandle', handle);
    }

    /**
     * Add or update an image
     * @param {Object} imageData - Image data object
     * @returns {string} Image ID
     */
    addImage(imageData) {
        const id = imageData.id || `img_${this.nextImageId++}`;
        const image = {
            id,
            fileName: imageData.fileName,
            filePath: imageData.filePath,
            width: imageData.width,
            height: imageData.height,
            boxes: imageData.boxes || []
        };

        this.state.images.set(id, image);
        this.notify('images', this.state.images);
        return id;
    }

    /**
     * Get image by ID
     * @param {string} imageId - Image ID
     * @returns {Object|null} Image object
     */
    getImage(imageId) {
        return this.state.images.get(imageId) || null;
    }

    /**
     * Get all images
     * @returns {Array} Array of image objects
     */
    getAllImages() {
        return Array.from(this.state.images.values());
    }

    /**
     * Add a box
     * @param {Object} boxData - Box data
     * @returns {string} Box ID
     */
    addBox(boxData) {
        const id = boxData.id || `box_${this.nextBoxId++}`;
        const box = {
            id,
            classId: boxData.classId,
            x: boxData.x,
            y: boxData.y,
            width: boxData.width,
            height: boxData.height,
            imageId: boxData.imageId
        };

        this.state.boxes.set(id, box);

        // Add box reference to image
        const image = this.state.images.get(box.imageId);
        if (image) {
            if (!image.boxes.includes(id)) {
                image.boxes.push(id);
            }
            this.markImageModified(box.imageId);
        }

        this.notify('boxes', this.state.boxes);
        return id;
    }

    /**
     * Update a box
     * @param {string} boxId - Box ID
     * @param {Object} updates - Properties to update
     */
    updateBox(boxId, updates) {
        const box = this.state.boxes.get(boxId);
        if (!box) return;

        Object.assign(box, updates);
        this.markImageModified(box.imageId);
        this.notify('boxes', this.state.boxes);
    }

    /**
     * Delete a box
     * @param {string} boxId - Box ID
     */
    deleteBox(boxId) {
        const box = this.state.boxes.get(boxId);
        if (!box) return;

        // Remove from image
        const image = this.state.images.get(box.imageId);
        if (image) {
            image.boxes = image.boxes.filter(id => id !== boxId);
            this.markImageModified(box.imageId);
        }

        this.state.boxes.delete(boxId);

        // Deselect if this was selected
        if (this.state.selectedBoxId === boxId) {
            this.state.selectedBoxId = null;
        }

        this.notify('boxes', this.state.boxes);
    }

    /**
     * Get box by ID
     * @param {string} boxId - Box ID
     * @returns {Object|null} Box object
     */
    getBox(boxId) {
        return this.state.boxes.get(boxId) || null;
    }

    /**
     * Get boxes for an image
     * @param {string} imageId - Image ID
     * @returns {Array} Array of box objects
     */
    getBoxesForImage(imageId) {
        const image = this.state.images.get(imageId);
        if (!image) return [];

        return image.boxes
            .map(boxId => this.state.boxes.get(boxId))
            .filter(box => box);
    }

    /**
     * Set classes
     * @param {Array} classes - Array of class names
     */
    setClasses(classes) {
        this.state.classes = classes;
        this.notify('classes', classes);
    }

    /**
     * Add a class
     * @param {string} className - Class name
     * @returns {number} Class ID
     */
    addClass(className) {
        const classId = this.state.classes.length;
        this.state.classes.push(className);
        this.notify('classes', this.state.classes);
        return classId;
    }

    /**
     * Get classes
     * @returns {Array} Array of class names
     */
    getClasses() {
        return this.state.classes;
    }

    /**
     * Set current image
     * @param {string} imageId - Image ID
     */
    setCurrentImage(imageId) {
        // Discard any unsaved changes to the previous image
        if (this.state.currentImageId && this.state.currentImageModified) {
            this.discardCurrentImageEdits();
        }

        this.state.currentImageId = imageId;
        this.state.selectedBoxId = null;
        this.state.currentImageModified = false;

        // Save the current state of boxes for this image
        this.saveCurrentImageState();

        this.notify('currentImage', imageId);
        this.notify('modified', this.state.currentImageModified);
    }

    /**
     * Get current image
     * @returns {Object|null} Current image object
     */
    getCurrentImage() {
        return this.getImage(this.state.currentImageId);
    }

    /**
     * Set selected box
     * @param {string|null} boxId - Box ID or null
     */
    setSelectedBox(boxId) {
        this.state.selectedBoxId = boxId;
        this.notify('selectedBox', boxId);
    }

    /**
     * Get selected box
     * @returns {Object|null} Selected box object
     */
    getSelectedBox() {
        return this.getBox(this.state.selectedBoxId);
    }

    /**
     * Set current class
     * @param {number} classId - Class ID
     */
    setCurrentClass(classId) {
        this.state.currentClassId = classId;
        this.notify('currentClass', classId);
    }

    /**
     * Mark image as modified (only tracks current image)
     * @param {string} imageId - Image ID
     */
    markImageModified(imageId) {
        // Only track modifications for the current image
        if (imageId === this.state.currentImageId) {
            this.state.currentImageModified = true;
            this.notify('modified', this.state.currentImageModified);
        }
    }

    /**
     * Clear modified flag for current image after save
     */
    clearImageModified() {
        this.state.currentImageModified = false;
        // Update saved state to match current state
        this.saveCurrentImageState();
        this.notify('modified', this.state.currentImageModified);
    }

    /**
     * Check if current image has unsaved changes
     * @returns {boolean} True if modified
     */
    isCurrentImageModified() {
        return this.state.currentImageModified;
    }

    /**
     * Set zoom level
     * @param {number} zoom - Zoom level
     */
    setZoom(zoom) {
        this.state.zoom = zoom;
        this.notify('zoom', zoom);
    }

    /**
     * Set pan offset
     * @param {number} x - Pan X
     * @param {number} y - Pan Y
     */
    setPan(x, y) {
        this.state.panX = x;
        this.state.panY = y;
        this.notify('pan', { x, y });
    }

    /**
     * Toggle box visibility
     */
    toggleBoxVisibility() {
        this.state.showBoxes = !this.state.showBoxes;
        this.notify('showBoxes', this.state.showBoxes);
    }

    /**
     * Clear all data
     */
    clear() {
        this.state.images.clear();
        this.state.boxes.clear();
        this.state.classes = [];
        this.state.currentImageId = null;
        this.state.selectedBoxId = null;
        this.state.currentImageModified = false;
        this.savedBoxesState = null;
        this.nextBoxId = 1;
        this.nextImageId = 1;
        this.notify('clear', null);
    }

    /**
     * Save current image state for potential rollback
     */
    saveCurrentImageState() {
        if (!this.state.currentImageId) {
            this.savedBoxesState = null;
            return;
        }

        const image = this.state.images.get(this.state.currentImageId);
        if (!image) {
            this.savedBoxesState = null;
            return;
        }

        // Deep copy of current boxes for this image
        this.savedBoxesState = image.boxes.map(boxId => {
            const box = this.state.boxes.get(boxId);
            return box ? { ...box } : null;
        }).filter(box => box !== null);
    }

    /**
     * Discard edits to current image and restore saved state
     */
    discardCurrentImageEdits() {
        if (!this.state.currentImageId || !this.savedBoxesState) {
            return;
        }

        const image = this.state.images.get(this.state.currentImageId);
        if (!image) return;

        // Remove all current boxes for this image
        const currentBoxIds = [...image.boxes];
        currentBoxIds.forEach(boxId => {
            this.state.boxes.delete(boxId);
        });

        // Restore saved boxes
        image.boxes = [];
        this.savedBoxesState.forEach(savedBox => {
            const boxId = `box_${this.nextBoxId++}`;
            const box = {
                ...savedBox,
                id: boxId
            };
            this.state.boxes.set(boxId, box);
            image.boxes.push(boxId);
        });

        // Clear modified flag
        this.state.currentImageModified = false;

        // Notify listeners
        this.notify('boxes', this.state.boxes);
        this.notify('modified', this.state.currentImageModified);
    }

    /**
     * Subscribe to state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notify listeners of state change
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notify(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

// Export for ES6 modules
export default AnnotationStore;
