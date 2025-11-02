/**
 * COCOHandler.js
 * Handles COCO format parsing and writing
 * Format: Single JSON file with images, annotations, and categories
 * bbox format: [top_left_x, top_left_y, width, height] in pixels
 */

class COCOHandler {
    constructor() {
        this.data = {
            images: [],
            annotations: [],
            categories: []
        };
        this.nextImageId = 1;
        this.nextAnnotationId = 1;
        this.imageIdMap = new Map(); // fileName -> imageId
    }

    /**
     * Parse COCO JSON file
     * @param {string} content - JSON content
     * @returns {Object} Parsed data structure
     */
    parse(content) {
        try {
            this.data = JSON.parse(content);

            // Ensure required fields exist
            if (!this.data.images) this.data.images = [];
            if (!this.data.annotations) this.data.annotations = [];
            if (!this.data.categories) this.data.categories = [];

            // Build image ID map
            this.imageIdMap.clear();
            this.data.images.forEach(img => {
                this.imageIdMap.set(img.file_name, img.id);
            });

            // Find next available IDs
            const maxImageId = Math.max(0, ...this.data.images.map(img => img.id));
            const maxAnnotationId = Math.max(0, ...this.data.annotations.map(ann => ann.id));
            this.nextImageId = maxImageId + 1;
            this.nextAnnotationId = maxAnnotationId + 1;

            return this.data;
        } catch (error) {
            console.error('Error parsing COCO JSON:', error);
            throw new Error('Invalid COCO JSON format');
        }
    }

    /**
     * Convert COCO data to JSON string
     * @returns {string} Formatted JSON string
     */
    stringify() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Get boxes for a specific image
     * @param {string} fileName - Image file name
     * @returns {Array} Array of box objects
     */
    getBoxesForImage(fileName) {
        const imageId = this.imageIdMap.get(fileName);
        if (imageId === undefined || imageId === null) return [];

        const boxes = this.data.annotations
            .filter(ann => ann.image_id === imageId)
            .map(ann => {
                const category = this.data.categories.find(cat => cat.id === ann.category_id);
                return {
                    id: ann.id,
                    classId: ann.category_id,
                    className: category ? category.name : `category_${ann.category_id}`,
                    x: ann.bbox[0],
                    y: ann.bbox[1],
                    width: ann.bbox[2],
                    height: ann.bbox[3]
                };
            });

        return boxes;
    }

    /**
     * Update boxes for an image
     * @param {string} fileName - Image file name
     * @param {Array} boxes - Array of box objects
     * @param {number} imageWidth - Image width
     * @param {number} imageHeight - Image height
     */
    setBoxesForImage(fileName, boxes, imageWidth, imageHeight) {
        // Ensure image exists in dataset
        let imageId = this.imageIdMap.get(fileName);
        if (!imageId) {
            imageId = this.addImage(fileName, imageWidth, imageHeight);
        }

        // Remove existing annotations for this image
        this.data.annotations = this.data.annotations.filter(ann => ann.image_id !== imageId);

        // Add new annotations
        boxes.forEach(box => {
            const annotation = {
                id: box.id || this.nextAnnotationId++,
                image_id: imageId,
                category_id: box.classId,
                bbox: [box.x, box.y, box.width, box.height],
                area: box.width * box.height,
                iscrowd: 0
            };
            this.data.annotations.push(annotation);
        });
    }

    /**
     * Add an image to the dataset
     * @param {string} fileName - Image file name
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Image ID
     */
    addImage(fileName, width, height) {
        const imageId = this.nextImageId++;
        this.data.images.push({
            id: imageId,
            file_name: fileName,
            width,
            height
        });
        this.imageIdMap.set(fileName, imageId);
        return imageId;
    }

    /**
     * Get categories (classes)
     * @returns {Array} Array of category objects
     */
    getCategories() {
        return this.data.categories;
    }

    /**
     * Add a category
     * @param {string} name - Category name
     * @param {string} supercategory - Super category (default: "none")
     * @returns {number} Category ID
     */
    addCategory(name, supercategory = "none") {
        const maxId = Math.max(0, ...this.data.categories.map(cat => cat.id));
        const newId = maxId + 1;

        this.data.categories.push({
            id: newId,
            name,
            supercategory
        });

        return newId;
    }

    /**
     * Set categories
     * @param {Array} categories - Array of category objects {id, name, supercategory}
     */
    setCategories(categories) {
        this.data.categories = categories;
    }

    /**
     * Get category name by ID
     * @param {number} categoryId - Category ID
     * @returns {string} Category name
     */
    getCategoryName(categoryId) {
        const category = this.data.categories.find(cat => cat.id === categoryId);
        return category ? category.name : `category_${categoryId}`;
    }

    /**
     * Get category ID by name
     * @param {string} name - Category name
     * @returns {number|null} Category ID or null if not found
     */
    getCategoryId(name) {
        const category = this.data.categories.find(cat => cat.name === name);
        return category ? category.id : null;
    }

    /**
     * Initialize empty COCO dataset
     */
    initEmpty() {
        this.data = {
            images: [],
            annotations: [],
            categories: []
        };
        this.nextImageId = 1;
        this.nextAnnotationId = 1;
        this.imageIdMap.clear();
    }

    /**
     * Get full COCO data structure
     * @returns {Object} COCO data
     */
    getData() {
        return this.data;
    }
}

// Export for ES6 modules
export default COCOHandler;
