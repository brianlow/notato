/**
 * FormatHandler.js
 * Base class for annotation format handlers
 * Defines the interface that all format handlers must implement
 */

class FormatHandler {
    /**
     * Get format name
     * @returns {string} Format identifier (e.g., 'yolo', 'coco')
     */
    getName() {
        throw new Error('Must implement getName()');
    }

    /**
     * Load annotations from folder
     * Each handler internally decides how to discover and read annotation files
     *
     * @param {FileManager} fileManager - File system manager
     * @param {Array} images - Array of image objects with {id, fileName, filePath, width, height}
     * @returns {Promise<Object>} - {boxes: Map<imageId, boxes[]>, classes: string[]}
     */
    async load(fileManager, images) {
        throw new Error('Must implement load()');
    }

    /**
     * Save annotations for current image
     * Each handler decides what files to write and how
     *
     * @param {FileManager} fileManager - File system manager
     * @param {Object} image - Image object {id, fileName, filePath, width, height}
     * @param {Array} boxes - Box objects with {classId, className, x, y, width, height}
     * @param {Array} classes - Class names array
     * @returns {Promise<void>}
     */
    async save(fileManager, image, boxes, classes) {
        throw new Error('Must implement save()');
    }

    /**
     * Get label file path for an image (optional, for per-image formats)
     * @param {string} imagePath - Image file path
     * @returns {string|null} - Label file path or null if format doesn't use per-image files
     */
    getLabelPath(imagePath) {
        return null;
    }
}

export default FormatHandler;
