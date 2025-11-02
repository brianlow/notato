/**
 * YOLOHandler.js
 * Handles YOLO format parsing and writing
 * Format: <class_id> <center_x> <center_y> <width> <height>
 * All coordinates are normalized (0.0 to 1.0)
 */

class YOLOHandler {
    constructor() {
        this.classes = [];
    }

    /**
     * Parse YOLO annotation text file
     * @param {string} content - Content of .txt file
     * @param {number} imageWidth - Image width in pixels
     * @param {number} imageHeight - Image height in pixels
     * @returns {Array} Array of box objects
     */
    parse(content, imageWidth, imageHeight) {
        const boxes = [];
        const lines = content.trim().split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 5) continue;

            const classId = parseInt(parts[0]);
            const centerX = parseFloat(parts[1]);
            const centerY = parseFloat(parts[2]);
            const width = parseFloat(parts[3]);
            const height = parseFloat(parts[4]);

            // Convert normalized coordinates to pixels
            const box = this.normalizedToPixels(
                { centerX, centerY, width, height },
                imageWidth,
                imageHeight
            );

            boxes.push({
                classId,
                className: this.classes[classId] || `class_${classId}`,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height
            });
        }

        return boxes;
    }

    /**
     * Convert boxes to YOLO format string
     * @param {Array} boxes - Array of box objects
     * @param {number} imageWidth - Image width in pixels
     * @param {number} imageHeight - Image height in pixels
     * @returns {string} YOLO format string
     */
    stringify(boxes, imageWidth, imageHeight) {
        const lines = boxes.map(box => {
            const normalized = this.pixelsToNormalized(box, imageWidth, imageHeight);

            return [
                box.classId,
                normalized.centerX.toFixed(6),
                normalized.centerY.toFixed(6),
                normalized.width.toFixed(6),
                normalized.height.toFixed(6)
            ].join(' ');
        });

        return lines.join('\n') + (lines.length > 0 ? '\n' : '');
    }

    /**
     * Convert normalized YOLO coordinates to pixel coordinates
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
     * Convert pixel coordinates to normalized YOLO coordinates
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
     * Parse classes.txt file
     * @param {string} content - Content of classes.txt
     * @returns {Array} Array of class names
     */
    parseClasses(content) {
        this.classes = content
            .trim()
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        return this.classes;
    }

    /**
     * Generate classes.txt content
     * @param {Array} classes - Array of class names
     * @returns {string} classes.txt content
     */
    stringifyClasses(classes) {
        return classes.join('\n') + '\n';
    }

    /**
     * Set classes array
     * @param {Array} classes - Array of class names
     */
    setClasses(classes) {
        this.classes = classes;
    }

    /**
     * Get classes array
     * @returns {Array} Array of class names
     */
    getClasses() {
        return this.classes;
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YOLOHandler;
}
