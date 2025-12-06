/**
 * NDJSONHandler.js
 * Handles Ultralytics NDJSON format parsing and writing
 * Format: Newline-delimited JSON with dataset metadata and image annotations
 * First line: dataset record with class_names
 * Subsequent lines: image records with normalized center-based bounding boxes
 * bbox format: [class_id, center_x, center_y, width, height] normalized 0-1
 */

import FormatHandler from './FormatHandler.js';

class NDJSONHandler extends FormatHandler {
    constructor() {
        super();
        this.dataset = null; // Dataset metadata record
        this.imageRecords = new Map(); // fileName -> image record
        this.annotationFile = 'dataset.ndjson'; // Default filename
    }

    /**
     * Get format name
     * @returns {string}
     */
    getName() {
        return 'ndjson';
    }

    /**
     * Load all NDJSON annotations from folder
     * @param {FileManager} fileManager
     * @param {Array} images - Array of image objects
     * @returns {Promise<Object>} - {boxes: Map<imageId, boxes[]>, classes: string[]}
     */
    async load(fileManager, images) {
        const boxes = new Map();

        // Try to find NDJSON file with various common names
        const possibleNames = [
            'dataset.ndjson',
            'annotations.ndjson',
            'data.ndjson'
        ];

        // Also try .json extension
        const jsonNames = possibleNames.map(name => name.replace('.ndjson', '.json'));
        const allPossibleNames = [...possibleNames, ...jsonNames];

        let content = null;
        for (const name of allPossibleNames) {
            content = await fileManager.readTextFile(name);
            if (content) {
                console.log(`Found NDJSON annotations: ${name}`);
                this.annotationFile = name;
                break;
            }
        }

        let classes = ['object'];

        if (content) {
            this.parse(content);

            // Extract classes from dataset record
            if (this.dataset && this.dataset.class_names) {
                classes = this.classNamesToArray(this.dataset.class_names);
            }

            // Load annotations for each image
            for (const image of images) {
                const imageRecord = this.imageRecords.get(image.fileName);
                if (imageRecord && imageRecord.annotations && imageRecord.annotations.boxes) {
                    const imageBoxes = this.parseBoxes(
                        imageRecord.annotations.boxes,
                        image.width,
                        image.height
                    );
                    boxes.set(image.id, imageBoxes);
                }
            }
        } else {
            // No annotation file found - initialize empty dataset
            console.log('No NDJSON annotations found. Starting with empty dataset.');
            this.annotationFile = 'dataset.ndjson';
            this.initEmpty();
        }

        return { boxes, classes };
    }

    /**
     * Save NDJSON annotations for current image
     * @param {FileManager} fileManager
     * @param {Object} image - Image object
     * @param {Array} boxes - Box objects
     * @param {Array} classes - Class names
     * @returns {Promise<void>}
     */
    async save(fileManager, image, boxes, classes) {
        // Update or create dataset record
        if (!this.dataset) {
            this.dataset = {
                type: 'dataset',
                task: 'detect',
                class_names: this.arrayToClassNames(classes)
            };
        } else {
            // Update class_names in existing dataset
            this.dataset.class_names = this.arrayToClassNames(classes);
        }

        // Update or create image record
        const imageRecord = {
            type: 'image',
            file: image.fileName,
            width: image.width,
            height: image.height,
            annotations: {
                boxes: this.stringifyBoxes(boxes, image.width, image.height)
            }
        };

        // Preserve existing fields if they exist
        const existingRecord = this.imageRecords.get(image.fileName);
        if (existingRecord) {
            // Preserve optional fields like url, split, etc.
            if (existingRecord.url) imageRecord.url = existingRecord.url;
            if (existingRecord.split) imageRecord.split = existingRecord.split;
        }

        this.imageRecords.set(image.fileName, imageRecord);

        // Write entire NDJSON file
        const content = this.stringify();
        await fileManager.writeTextFile(this.annotationFile, content);
    }

    /**
     * Parse NDJSON content
     * @param {string} content - NDJSON content
     */
    parse(content) {
        const lines = content.trim().split('\n').filter(line => line.trim());

        this.dataset = null;
        this.imageRecords.clear();

        for (const line of lines) {
            try {
                const record = JSON.parse(line);

                if (record.type === 'dataset') {
                    this.dataset = record;
                } else if (record.type === 'image') {
                    this.imageRecords.set(record.file, record);
                }
            } catch (error) {
                console.error('Error parsing NDJSON line:', error);
            }
        }

        // If no dataset record found, create default
        if (!this.dataset) {
            this.dataset = {
                type: 'dataset',
                task: 'detect',
                class_names: {}
            };
        }
    }

    /**
     * Convert dataset and image records to NDJSON string
     * @returns {string} NDJSON formatted string
     */
    stringify() {
        const lines = [];

        // First line: dataset record
        if (this.dataset) {
            lines.push(JSON.stringify(this.dataset));
        }

        // Subsequent lines: image records (sorted by filename for consistency)
        const sortedFiles = Array.from(this.imageRecords.keys()).sort();
        for (const fileName of sortedFiles) {
            const record = this.imageRecords.get(fileName);
            lines.push(JSON.stringify(record));
        }

        return lines.join('\n') + (lines.length > 0 ? '\n' : '');
    }

    /**
     * Parse boxes from NDJSON format to internal format
     * @param {Array} ndjsonBoxes - Array of [class_id, center_x, center_y, width, height]
     * @param {number} imageWidth - Image width in pixels
     * @param {number} imageHeight - Image height in pixels
     * @returns {Array} Array of box objects
     */
    parseBoxes(ndjsonBoxes, imageWidth, imageHeight) {
        const boxes = [];

        for (const boxData of ndjsonBoxes) {
            if (!Array.isArray(boxData) || boxData.length < 5) continue;

            const classId = parseInt(boxData[0]);
            const centerX = parseFloat(boxData[1]);
            const centerY = parseFloat(boxData[2]);
            const width = parseFloat(boxData[3]);
            const height = parseFloat(boxData[4]);

            // Convert normalized coordinates to pixels
            const box = this.normalizedToPixels(
                { centerX, centerY, width, height },
                imageWidth,
                imageHeight
            );

            boxes.push({
                classId,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height
            });
        }

        return boxes;
    }

    /**
     * Convert boxes to NDJSON format
     * @param {Array} boxes - Array of box objects
     * @param {number} imageWidth - Image width in pixels
     * @param {number} imageHeight - Image height in pixels
     * @returns {Array} Array of [class_id, center_x, center_y, width, height]
     */
    stringifyBoxes(boxes, imageWidth, imageHeight) {
        return boxes.map(box => {
            const normalized = this.pixelsToNormalized(box, imageWidth, imageHeight);

            return [
                box.classId,
                parseFloat(normalized.centerX.toFixed(5)),
                parseFloat(normalized.centerY.toFixed(5)),
                parseFloat(normalized.width.toFixed(5)),
                parseFloat(normalized.height.toFixed(5))
            ];
        });
    }

    /**
     * Convert normalized NDJSON coordinates to pixel coordinates
     * @param {Object} normalized - {centerX, centerY, width, height} all 0-1
     * @param {number} imageWidth - Image width
     * @param {number} imageHeight - Image height
     * @returns {Object} {x, y, width, height} in pixels (top-left origin)
     */
    normalizedToPixels(normalized, imageWidth, imageHeight) {
        const width = normalized.width * imageWidth;
        const height = normalized.height * imageHeight;
        const centerX = normalized.centerX * imageWidth;
        const centerY = normalized.centerY * imageHeight;

        return {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height
        };
    }

    /**
     * Convert pixel coordinates to normalized NDJSON coordinates
     * @param {Object} box - {x, y, width, height} in pixels (top-left origin)
     * @param {number} imageWidth - Image width
     * @param {number} imageHeight - Image height
     * @returns {Object} {centerX, centerY, width, height} all 0-1
     */
    pixelsToNormalized(box, imageWidth, imageHeight) {
        const centerX = (box.x + box.width / 2) / imageWidth;
        const centerY = (box.y + box.height / 2) / imageHeight;
        const width = box.width / imageWidth;
        const height = box.height / imageHeight;

        return {
            centerX: Math.max(0, Math.min(1, centerX)),
            centerY: Math.max(0, Math.min(1, centerY)),
            width: Math.max(0, Math.min(1, width)),
            height: Math.max(0, Math.min(1, height))
        };
    }

    /**
     * Convert class_names object to array
     * @param {Object} classNames - Object with numeric keys {"0": "person", "1": "car"}
     * @returns {Array} Array of class names
     */
    classNamesToArray(classNames) {
        if (Array.isArray(classNames)) {
            return classNames;
        }

        // Convert object to array, handling gaps in indices
        const maxIndex = Math.max(...Object.keys(classNames).map(k => parseInt(k)));
        const classes = [];

        for (let i = 0; i <= maxIndex; i++) {
            classes.push(classNames[i.toString()] || `class_${i}`);
        }

        return classes;
    }

    /**
     * Convert class names array to object
     * @param {Array} classes - Array of class names
     * @returns {Object} Object with numeric keys {"0": "person", "1": "car"}
     */
    arrayToClassNames(classes) {
        const classNames = {};
        classes.forEach((name, index) => {
            classNames[index.toString()] = name;
        });
        return classNames;
    }

    /**
     * Initialize empty NDJSON dataset
     */
    initEmpty() {
        this.dataset = {
            type: 'dataset',
            task: 'detect',
            class_names: {}
        };
        this.imageRecords.clear();
    }

    /**
     * Get dataset metadata
     * @returns {Object} Dataset record
     */
    getDataset() {
        return this.dataset;
    }

    /**
     * Set dataset metadata (preserving fields)
     * @param {Object} dataset - Dataset record
     */
    setDataset(dataset) {
        this.dataset = { ...this.dataset, ...dataset };
    }
}

// Export for ES6 modules
export default NDJSONHandler;
