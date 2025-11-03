/**
 * ImageCanvas.js
 * Handles canvas rendering, zoom/pan, and coordinate transformations
 */

class ImageCanvas {
    constructor(canvasElement, store) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.store = store;

        this.image = null;
        this.imageWidth = 0;
        this.imageHeight = 0;

        // Zoom and pan state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.offsetX = 0; // Offset to center image
        this.offsetY = 0;

        // Color palette for classes (HSL with consistent saturation/lightness)
        this.colorPalette = this.generateColorPalette(20);

        this.setupCanvas();
    }

    /**
     * Generate color palette using HSL
     * @param {number} count - Number of colors
     * @returns {Array} Array of color strings
     */
    generateColorPalette(count) {
        const colors = [];
        const saturation = 70;
        const lightness = 50;

        for (let i = 0; i < count; i++) {
            // Start with purple (270°) instead of red (0°)
            const hue = (270 + i * 360 / count) % 360;
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }

        return colors;
    }

    /**
     * Setup canvas size
     */
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Resize canvas to container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    /**
     * Load and display an image
     * @param {string} imageUrl - Image URL or data URL
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    async loadImage(imageUrl, width, height) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.imageWidth = width;
                this.imageHeight = height;
                this.fitToScreen();
                this.render();
                resolve();
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    /**
     * Fit image to screen
     */
    fitToScreen() {
        if (!this.image) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        const scaleX = (canvasWidth - 40) / this.imageWidth;
        const scaleY = (canvasHeight - 40) / this.imageHeight;

        this.zoom = Math.min(scaleX, scaleY, 1.0);
        this.panX = 0;
        this.panY = 0;

        // Center image
        this.offsetX = (canvasWidth - this.imageWidth * this.zoom) / 2;
        this.offsetY = (canvasHeight - this.imageHeight * this.zoom) / 2;

        this.store.setZoom(this.zoom);
        this.store.setPan(this.panX, this.panY);
    }

    /**
     * Zoom in/out
     * @param {number} delta - Zoom delta
     * @param {number} centerX - Center X in screen coordinates
     * @param {number} centerY - Center Y in screen coordinates
     */
    zoomAt(delta, centerX, centerY) {
        const oldZoom = this.zoom;

        // Apply zoom
        if (delta > 0) {
            this.zoom *= 1.2;
        } else {
            this.zoom /= 1.2;
        }

        // Clamp zoom
        this.zoom = Math.max(0.1, Math.min(5.0, this.zoom));

        // Adjust pan to zoom towards center point
        const zoomRatio = this.zoom / oldZoom;
        this.panX = centerX - (centerX - this.panX) * zoomRatio;
        this.panY = centerY - (centerY - this.panY) * zoomRatio;

        this.store.setZoom(this.zoom);
        this.store.setPan(this.panX, this.panY);
        this.render();
    }

    /**
     * Set zoom to specific level
     * @param {number} level - Zoom level (0.25, 0.5, 1.0, etc.)
     */
    setZoom(level) {
        this.zoom = level;
        this.store.setZoom(this.zoom);
        this.render();
    }

    /**
     * Pan the view
     * @param {number} dx - Delta X
     * @param {number} dy - Delta Y
     */
    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.store.setPan(this.panX, this.panY);
        this.render();
    }

    /**
     * Convert screen coordinates to image coordinates
     * @param {number} screenX - Screen X
     * @param {number} screenY - Screen Y
     * @returns {Object} {x, y} in image coordinates
     */
    screenToImage(screenX, screenY) {
        const x = (screenX - this.offsetX - this.panX) / this.zoom;
        const y = (screenY - this.offsetY - this.panY) / this.zoom;
        return { x, y };
    }

    /**
     * Convert image coordinates to screen coordinates
     * @param {number} imageX - Image X
     * @param {number} imageY - Image Y
     * @returns {Object} {x, y} in screen coordinates
     */
    imageToScreen(imageX, imageY) {
        const x = imageX * this.zoom + this.offsetX + this.panX;
        const y = imageY * this.zoom + this.offsetY + this.panY;
        return { x, y };
    }

    /**
     * Get color for a class
     * @param {number} classId - Class ID
     * @returns {string} Color string
     */
    getClassColor(classId) {
        return this.colorPalette[classId % this.colorPalette.length];
    }

    /**
     * Convert HSL color to HSLA with alpha
     * @param {string} hslColor - HSL color string (e.g., "hsl(180, 70%, 50%)")
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} HSLA color string
     */
    hslToHsla(hslColor, alpha) {
        // Convert hsl(h, s%, l%) to hsla(h, s%, l%, alpha)
        return hslColor.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
    }

    /**
     * Main render function
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.image) return;

        // Draw image
        this.ctx.save();
        this.ctx.translate(this.offsetX + this.panX, this.offsetY + this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.drawImage(this.image, 0, 0, this.imageWidth, this.imageHeight);
        this.ctx.restore();

        // Draw boxes
        if (this.store.getState().showBoxes) {
            this.renderBoxes();
        }
    }

    /**
     * Render all bounding boxes
     */
    renderBoxes() {
        const currentImage = this.store.getCurrentImage();
        if (!currentImage) return;

        const boxes = this.store.getBoxesForImage(currentImage.id);
        const selectedBoxId = this.store.getState().selectedBoxId;

        // Draw unselected boxes first
        boxes.forEach(box => {
            if (box.id !== selectedBoxId) {
                this.renderBox(box, false);
            }
        });

        // Draw selected box last (on top)
        if (selectedBoxId) {
            const selectedBox = this.store.getBox(selectedBoxId);
            if (selectedBox) {
                this.renderBox(selectedBox, true);
            }
        }
    }

    /**
     * Render a single box
     * @param {Object} box - Box object
     * @param {boolean} selected - Is selected
     */
    renderBox(box, selected) {
        const color = this.getClassColor(box.classId);
        const topLeft = this.imageToScreen(box.x, box.y);
        const bottomRight = this.imageToScreen(box.x + box.width, box.y + box.height);

        const screenWidth = bottomRight.x - topLeft.x;
        const screenHeight = bottomRight.y - topLeft.y;

        this.ctx.save();

        // Draw box
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = selected ? 3 : 2;
        this.ctx.setLineDash(selected ? [] : []);
        this.ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);

        // Draw semi-transparent fill if selected
        if (selected) {
            this.ctx.fillStyle = this.hslToHsla(color, 0.12);
            this.ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
        }

        // Draw label
        const label = box.className || `Class ${box.classId}`;
        this.ctx.font = '12px sans-serif';
        const textMetrics = this.ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 16;

        // Background for text
        this.ctx.fillStyle = color;
        this.ctx.fillRect(topLeft.x, topLeft.y - textHeight - 2, textWidth + 8, textHeight + 2);

        // Text
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(label, topLeft.x + 4, topLeft.y - 4);

        // Draw handles if selected
        if (selected) {
            this.renderHandles(topLeft.x, topLeft.y, screenWidth, screenHeight, color);
        }

        this.ctx.restore();
    }

    /**
     * Render resize handles
     * @param {number} x - Top-left X
     * @param {number} y - Top-left Y
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {string} color - Handle color
     */
    renderHandles(x, y, width, height, color) {
        const handleSize = 8;
        const handles = this.getHandlePositions(x, y, width, height);

        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        handles.forEach(handle => {
            this.ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
            this.ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });
    }

    /**
     * Get handle positions for a box
     * @param {number} x - Top-left X
     * @param {number} y - Top-left Y
     * @param {number} width - Width
     * @param {number} height - Height
     * @returns {Array} Array of handle objects
     */
    getHandlePositions(x, y, width, height) {
        return [
            { type: 'nw', x: x, y: y },
            { type: 'n', x: x + width / 2, y: y },
            { type: 'ne', x: x + width, y: y },
            { type: 'e', x: x + width, y: y + height / 2 },
            { type: 'se', x: x + width, y: y + height },
            { type: 's', x: x + width / 2, y: y + height },
            { type: 'sw', x: x, y: y + height },
            { type: 'w', x: x, y: y + height / 2 }
        ];
    }

    /**
     * Draw crosshair cursor
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    drawCrosshair(x, y) {
        this.render();

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);

        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();

        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();

        // Center dot
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Draw preview box while creating
     * @param {number} x1 - Start X in image coords
     * @param {number} y1 - Start Y in image coords
     * @param {number} x2 - End X in image coords
     * @param {number} y2 - End Y in image coords
     */
    drawPreviewBox(x1, y1, x2, y2) {
        this.render();

        const currentClassId = this.store.getState().currentClassId;
        const color = this.getClassColor(currentClassId);

        const topLeft = this.imageToScreen(Math.min(x1, x2), Math.min(y1, y2));
        const bottomRight = this.imageToScreen(Math.max(x1, x2), Math.max(y1, y2));

        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(topLeft.x, topLeft.y, width, height);

        this.ctx.fillStyle = this.hslToHsla(color, 0.12);
        this.ctx.fillRect(topLeft.x, topLeft.y, width, height);
        this.ctx.restore();
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.image = null;
        this.imageWidth = 0;
        this.imageHeight = 0;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Export for ES6 modules
export default ImageCanvas;
