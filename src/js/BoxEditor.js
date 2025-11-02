/**
 * BoxEditor.js
 * Handles mouse interactions for box creation, selection, and editing
 */

class BoxEditor {
    constructor(canvas, imageCanvas, store) {
        this.canvas = canvas;
        this.imageCanvas = imageCanvas;
        this.store = store;

        this.mode = 'idle'; // idle, drawing, moving, resizing, panning
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;

        this.dragStartBox = null;
        this.resizeHandle = null;
        this.isPanning = false;
        this.spacePressed = false;

        this.setupEventListeners();
    }

    /**
     * Setup mouse and keyboard event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Pan mode with space key
        if (this.spacePressed || e.button === 1) { // Middle mouse button
            this.mode = 'panning';
            this.startX = screenX;
            this.startY = screenY;
            this.canvas.classList.add('panning');
            e.preventDefault();
            return;
        }

        const imageCoords = this.imageCanvas.screenToImage(screenX, screenY);

        // Check if clicking on a handle
        const handle = this.getHandleAt(screenX, screenY);
        if (handle) {
            this.mode = 'resizing';
            this.resizeHandle = handle;
            this.startX = imageCoords.x;
            this.startY = imageCoords.y;
            this.dragStartBox = { ...this.store.getSelectedBox() };
            return;
        }

        // Check if clicking on a box
        const clickedBox = this.getBoxAt(imageCoords.x, imageCoords.y);
        if (clickedBox) {
            this.store.setSelectedBox(clickedBox.id);
            this.mode = 'moving';
            this.startX = imageCoords.x;
            this.startY = imageCoords.y;
            this.dragStartBox = { ...clickedBox };
            this.imageCanvas.render();
            return;
        }

        // Deselect and start drawing new box
        this.store.setSelectedBox(null);
        this.mode = 'drawing';
        this.startX = imageCoords.x;
        this.startY = imageCoords.y;
        this.currentX = imageCoords.x;
        this.currentY = imageCoords.y;
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const imageCoords = this.imageCanvas.screenToImage(screenX, screenY);

        // Update cursor position (for status bar)
        this.updateCursorPosition(imageCoords.x, imageCoords.y);

        if (this.mode === 'panning') {
            const dx = screenX - this.startX;
            const dy = screenY - this.startY;
            this.imageCanvas.pan(dx, dy);
            this.startX = screenX;
            this.startY = screenY;
            return;
        }

        if (this.mode === 'drawing') {
            this.currentX = imageCoords.x;
            this.currentY = imageCoords.y;
            this.imageCanvas.drawPreviewBox(this.startX, this.startY, this.currentX, this.currentY);
            return;
        }

        if (this.mode === 'moving') {
            const dx = imageCoords.x - this.startX;
            const dy = imageCoords.y - this.startY;

            const newX = this.dragStartBox.x + dx;
            const newY = this.dragStartBox.y + dy;

            // Constrain to image bounds
            const currentImage = this.store.getCurrentImage();
            const constrainedX = Math.max(0, Math.min(newX, currentImage.width - this.dragStartBox.width));
            const constrainedY = Math.max(0, Math.min(newY, currentImage.height - this.dragStartBox.height));

            this.store.updateBox(this.store.getState().selectedBoxId, {
                x: constrainedX,
                y: constrainedY
            });

            this.imageCanvas.render();
            return;
        }

        if (this.mode === 'resizing') {
            this.handleResize(imageCoords.x, imageCoords.y);
            return;
        }

        // Update cursor based on hover
        this.updateCursor(screenX, screenY, imageCoords.x, imageCoords.y);
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const imageCoords = this.imageCanvas.screenToImage(screenX, screenY);

        if (this.mode === 'panning') {
            this.canvas.classList.remove('panning');
            this.mode = 'idle';
            return;
        }

        if (this.mode === 'drawing') {
            this.finishDrawing(imageCoords.x, imageCoords.y);
            this.mode = 'idle';
            return;
        }

        if (this.mode === 'moving' || this.mode === 'resizing') {
            this.mode = 'idle';
            this.dragStartBox = null;
            this.resizeHandle = null;
            return;
        }
    }

    /**
     * Handle mouse wheel (zoom)
     */
    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        this.imageCanvas.zoomAt(e.deltaY > 0 ? -1 : 1, screenX, screenY);
    }

    /**
     * Handle key down
     */
    handleKeyDown(e) {
        if (e.code === 'Space' && !this.spacePressed) {
            this.spacePressed = true;
            if (this.mode === 'idle') {
                this.canvas.style.cursor = 'grab';
            }
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            const selectedBoxId = this.store.getState().selectedBoxId;
            if (selectedBoxId) {
                this.store.deleteBox(selectedBoxId);
                this.imageCanvas.render();
                e.preventDefault();
            }
        }

        if (e.key === 'Escape') {
            if (this.mode === 'drawing') {
                this.mode = 'idle';
                this.imageCanvas.render();
            } else {
                this.store.setSelectedBox(null);
                this.imageCanvas.render();
            }
        }
    }

    /**
     * Handle key up
     */
    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.spacePressed = false;
            if (this.mode === 'idle') {
                this.canvas.style.cursor = 'crosshair';
            }
        }
    }

    /**
     * Finish drawing a new box
     */
    finishDrawing(endX, endY) {
        const width = Math.abs(endX - this.startX);
        const height = Math.abs(endY - this.startY);

        // Minimum size threshold
        if (width < 5 || height < 5) {
            this.imageCanvas.render();
            return;
        }

        const currentImage = this.store.getCurrentImage();
        const state = this.store.getState();
        const classes = this.store.getClasses();

        const box = {
            classId: state.currentClassId,
            className: classes[state.currentClassId] || `class_${state.currentClassId}`,
            x: Math.max(0, Math.min(this.startX, endX)),
            y: Math.max(0, Math.min(this.startY, endY)),
            width: Math.min(width, currentImage.width),
            height: Math.min(height, currentImage.height),
            imageId: currentImage.id
        };

        const boxId = this.store.addBox(box);
        this.store.setSelectedBox(boxId);
        this.imageCanvas.render();
    }

    /**
     * Handle box resizing
     */
    handleResize(currentX, currentY) {
        const box = this.dragStartBox;
        const handle = this.resizeHandle;
        const currentImage = this.store.getCurrentImage();

        let newX = box.x;
        let newY = box.y;
        let newWidth = box.width;
        let newHeight = box.height;

        const dx = currentX - this.startX;
        const dy = currentY - this.startY;

        // Calculate new dimensions based on handle
        switch (handle.type) {
            case 'nw':
                newX = box.x + dx;
                newY = box.y + dy;
                newWidth = box.width - dx;
                newHeight = box.height - dy;
                break;
            case 'n':
                newY = box.y + dy;
                newHeight = box.height - dy;
                break;
            case 'ne':
                newY = box.y + dy;
                newWidth = box.width + dx;
                newHeight = box.height - dy;
                break;
            case 'e':
                newWidth = box.width + dx;
                break;
            case 'se':
                newWidth = box.width + dx;
                newHeight = box.height + dy;
                break;
            case 's':
                newHeight = box.height + dy;
                break;
            case 'sw':
                newX = box.x + dx;
                newWidth = box.width - dx;
                newHeight = box.height + dy;
                break;
            case 'w':
                newX = box.x + dx;
                newWidth = box.width - dx;
                break;
        }

        // Ensure minimum size
        if (newWidth < 5) {
            newWidth = 5;
            newX = box.x;
        }
        if (newHeight < 5) {
            newHeight = 5;
            newY = box.y;
        }

        // Constrain to image bounds
        newX = Math.max(0, Math.min(newX, currentImage.width - newWidth));
        newY = Math.max(0, Math.min(newY, currentImage.height - newHeight));
        newWidth = Math.min(newWidth, currentImage.width - newX);
        newHeight = Math.min(newHeight, currentImage.height - newY);

        this.store.updateBox(this.store.getState().selectedBoxId, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        });

        this.imageCanvas.render();
    }

    /**
     * Get box at image coordinates
     */
    getBoxAt(imageX, imageY) {
        const currentImage = this.store.getCurrentImage();
        if (!currentImage) return null;

        const boxes = this.store.getBoxesForImage(currentImage.id);

        // Check in reverse order (top box first)
        for (let i = boxes.length - 1; i >= 0; i--) {
            const box = boxes[i];
            if (imageX >= box.x && imageX <= box.x + box.width &&
                imageY >= box.y && imageY <= box.y + box.height) {
                return box;
            }
        }

        return null;
    }

    /**
     * Get handle at screen coordinates
     */
    getHandleAt(screenX, screenY) {
        const selectedBox = this.store.getSelectedBox();
        if (!selectedBox) return null;

        const topLeft = this.imageCanvas.imageToScreen(selectedBox.x, selectedBox.y);
        const bottomRight = this.imageCanvas.imageToScreen(
            selectedBox.x + selectedBox.width,
            selectedBox.y + selectedBox.height
        );

        const screenWidth = bottomRight.x - topLeft.x;
        const screenHeight = bottomRight.y - topLeft.y;

        const handles = this.imageCanvas.getHandlePositions(topLeft.x, topLeft.y, screenWidth, screenHeight);
        const handleSize = 8;

        for (const handle of handles) {
            const dx = screenX - handle.x;
            const dy = screenY - handle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= handleSize) {
                return handle;
            }
        }

        return null;
    }

    /**
     * Update cursor based on hover
     */
    updateCursor(screenX, screenY, imageX, imageY) {
        if (this.spacePressed) {
            this.canvas.style.cursor = 'grab';
            return;
        }

        const handle = this.getHandleAt(screenX, screenY);
        if (handle) {
            const cursors = {
                'nw': 'nw-resize',
                'n': 'n-resize',
                'ne': 'ne-resize',
                'e': 'e-resize',
                'se': 'se-resize',
                's': 's-resize',
                'sw': 'sw-resize',
                'w': 'w-resize'
            };
            this.canvas.style.cursor = cursors[handle.type];
            return;
        }

        const box = this.getBoxAt(imageX, imageY);
        if (box) {
            this.canvas.style.cursor = 'move';
            return;
        }

        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * Update cursor position display
     */
    updateCursorPosition(imageX, imageY) {
        const currentImage = this.store.getCurrentImage();
        if (!currentImage) return;

        // Clamp to image bounds for display
        const x = Math.max(0, Math.min(Math.round(imageX), currentImage.width));
        const y = Math.max(0, Math.min(Math.round(imageY), currentImage.height));

        const event = new CustomEvent('cursorPosition', {
            detail: { x, y }
        });
        document.dispatchEvent(event);
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoxEditor;
}
