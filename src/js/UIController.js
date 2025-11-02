/**
 * UIController.js
 * Manages UI updates and user interactions
 */

class UIController {
    constructor(store, imageCanvas) {
        this.store = store;
        this.imageCanvas = imageCanvas;

        this.elements = {
            // Format
            formatRadios: document.querySelectorAll('input[name="format"]'),
            openFolderBtn: document.getElementById('openFolderBtn'),
            folderPath: document.getElementById('folderPath'),

            // Class management
            classSelector: document.getElementById('classSelector'),
            addClassBtn: document.getElementById('addClassBtn'),
            classList: document.getElementById('classList'),
            addClassModal: document.getElementById('addClassModal'),
            newClassName: document.getElementById('newClassName'),
            addClassConfirm: document.getElementById('addClassConfirm'),
            addClassCancel: document.getElementById('addClassCancel'),

            // File list
            fileSearch: document.getElementById('fileSearch'),
            fileList: document.getElementById('fileList'),

            // Toolbar
            fileInfo: document.getElementById('fileInfo'),
            annotationCount: document.getElementById('annotationCount'),
            zoomOutBtn: document.getElementById('zoomOutBtn'),
            zoomInBtn: document.getElementById('zoomInBtn'),
            zoomLevel: document.getElementById('zoomLevel'),
            fitToScreenBtn: document.getElementById('fitToScreenBtn'),
            toggleBoxesBtn: document.getElementById('toggleBoxesBtn'),
            saveBtn: document.getElementById('saveBtn'),

            // Status bar
            cursorPos: document.getElementById('cursorPos'),
            statusMessage: document.getElementById('statusMessage'),
            shortcutHint: document.getElementById('shortcutHint'),

            // Modals
            shortcutsModal: document.getElementById('shortcutsModal'),
            shortcutsClose: document.getElementById('shortcutsClose'),

            // Toast
            toastContainer: document.getElementById('toastContainer'),

            // Canvas container
            canvasContainer: document.getElementById('canvasContainer')
        };

        this.setupEventListeners();
        this.setupStoreListeners();
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Format selection
        this.elements.formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.store.setFormat(e.target.value);
            });
        });

        // Class selector
        this.elements.classSelector.addEventListener('change', (e) => {
            this.store.setCurrentClass(parseInt(e.target.value));
        });

        // Add class button
        this.elements.addClassBtn.addEventListener('click', () => {
            this.showAddClassModal();
        });

        this.elements.addClassConfirm.addEventListener('click', () => {
            this.handleAddClass();
        });

        this.elements.addClassCancel.addEventListener('click', () => {
            this.hideAddClassModal();
        });

        this.elements.newClassName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddClass();
            }
        });

        // File search
        this.elements.fileSearch.addEventListener('input', (e) => {
            this.filterFileList(e.target.value);
        });

        // Zoom controls
        this.elements.zoomInBtn.addEventListener('click', () => {
            const currentZoom = this.store.getState().zoom;
            this.imageCanvas.setZoom(currentZoom * 1.2);
        });

        this.elements.zoomOutBtn.addEventListener('click', () => {
            const currentZoom = this.store.getState().zoom;
            this.imageCanvas.setZoom(currentZoom / 1.2);
        });

        this.elements.fitToScreenBtn.addEventListener('click', () => {
            this.imageCanvas.fitToScreen();
        });

        // Toggle boxes
        this.elements.toggleBoxesBtn.addEventListener('click', () => {
            this.store.toggleBoxVisibility();
            this.imageCanvas.render();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
        });

        // Shortcuts modal
        this.elements.shortcutsClose.addEventListener('click', () => {
            this.hideShortcutsModal();
        });

        // Cursor position
        document.addEventListener('cursorPosition', (e) => {
            this.updateCursorPosition(e.detail.x, e.detail.y);
        });

        // Close modals on background click
        this.elements.addClassModal.addEventListener('click', (e) => {
            if (e.target === this.elements.addClassModal) {
                this.hideAddClassModal();
            }
        });

        this.elements.shortcutsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.shortcutsModal) {
                this.hideShortcutsModal();
            }
        });
    }

    /**
     * Setup store event listeners
     */
    setupStoreListeners() {
        this.store.on('classes', () => this.updateClassUI());
        this.store.on('images', () => this.updateFileList());
        this.store.on('currentImage', () => this.updateCurrentImageUI());
        this.store.on('boxes', () => this.updateAnnotationCount());
        this.store.on('modified', () => this.updateSaveButton());
        this.store.on('zoom', (zoom) => this.updateZoomDisplay(zoom));
    }

    /**
     * Update class selector and list
     */
    updateClassUI() {
        const classes = this.store.getClasses();
        const currentClassId = this.store.getState().currentClassId;

        // Update selector dropdown
        this.elements.classSelector.innerHTML = '';
        classes.forEach((className, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = className;
            if (index === currentClassId) {
                option.selected = true;
            }
            this.elements.classSelector.appendChild(option);
        });

        // Update class list
        this.elements.classList.innerHTML = '';
        classes.forEach((className, index) => {
            const item = document.createElement('div');
            item.className = 'class-item';
            if (index === currentClassId) {
                item.classList.add('active');
            }

            const color = document.createElement('div');
            color.className = 'class-color';
            color.style.backgroundColor = this.imageCanvas.getClassColor(index);

            const name = document.createElement('div');
            name.className = 'class-name';
            name.textContent = className;

            item.appendChild(color);
            item.appendChild(name);

            item.addEventListener('click', () => {
                this.store.setCurrentClass(index);
                this.elements.classSelector.value = index;
                this.updateClassUI();
            });

            this.elements.classList.appendChild(item);
        });
    }

    /**
     * Update file list
     */
    updateFileList() {
        const images = this.store.getAllImages();
        const currentImageId = this.store.getState().currentImageId;

        if (images.length === 0) {
            this.elements.fileList.innerHTML = `
                <div class="empty-state">
                    <p>No images found</p>
                    <p class="hint">Check folder structure</p>
                </div>
            `;
            return;
        }

        // Group by subfolder
        const groups = {};
        images.forEach(img => {
            const folder = img.subfolder || 'root';
            if (!groups[folder]) {
                groups[folder] = [];
            }
            groups[folder].push(img);
        });

        this.elements.fileList.innerHTML = '';

        Object.entries(groups).forEach(([folder, imgs]) => {
            const group = document.createElement('div');
            group.className = 'file-group';

            if (Object.keys(groups).length > 1) {
                const header = document.createElement('div');
                header.className = 'file-group-header';
                header.innerHTML = `<span class="file-group-toggle">▼</span> ${folder}`;
                group.appendChild(header);
            }

            imgs.forEach(img => {
                const item = this.createFileItem(img, currentImageId);
                group.appendChild(item);
            });

            this.elements.fileList.appendChild(group);
        });
    }

    /**
     * Create file list item
     */
    createFileItem(image, currentImageId) {
        const item = document.createElement('div');
        item.className = 'file-item';
        if (image.id === currentImageId) {
            item.classList.add('active');
        }

        // Thumbnail (placeholder - will be replaced with actual thumbnail)
        const thumbnail = document.createElement('div');
        thumbnail.className = 'file-thumbnail';
        thumbnail.style.background = '#ddd';
        item.appendChild(thumbnail);

        // File info
        const info = document.createElement('div');
        info.className = 'file-info';

        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = image.fileName;
        name.title = image.fileName;

        const meta = document.createElement('div');
        meta.className = 'file-meta';

        const status = document.createElement('div');
        status.className = 'file-status';
        if (image.modified) {
            status.classList.add('modified');
        } else if (image.boxes.length > 0) {
            status.classList.add('annotated');
        } else {
            status.classList.add('unannotated');
        }

        const count = document.createElement('span');
        count.textContent = `${image.boxes.length} boxes`;

        meta.appendChild(status);
        meta.appendChild(count);

        info.appendChild(name);
        info.appendChild(meta);

        item.appendChild(info);

        item.addEventListener('click', () => {
            const event = new CustomEvent('imageSelected', { detail: { imageId: image.id } });
            document.dispatchEvent(event);
        });

        return item;
    }

    /**
     * Filter file list by search term
     */
    filterFileList(searchTerm) {
        const items = this.elements.fileList.querySelectorAll('.file-item');
        const term = searchTerm.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('.file-name').textContent.toLowerCase();
            if (name.includes(term)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Update current image UI
     */
    updateCurrentImageUI() {
        const image = this.store.getCurrentImage();

        if (image) {
            this.elements.fileInfo.textContent = `${image.fileName} (${image.width} × ${image.height})`;
            this.elements.canvasContainer.querySelector('.empty-canvas-state').style.display = 'none';
            this.updateFileList();
        } else {
            this.elements.fileInfo.textContent = 'No image loaded';
        }

        this.updateAnnotationCount();
    }

    /**
     * Update annotation count
     */
    updateAnnotationCount() {
        const image = this.store.getCurrentImage();
        if (image) {
            const count = image.boxes.length;
            this.elements.annotationCount.textContent = `${count} box${count !== 1 ? 'es' : ''}`;
        } else {
            this.elements.annotationCount.textContent = '';
        }
    }

    /**
     * Update save button state
     */
    updateSaveButton() {
        const isModified = this.store.isCurrentImageModified();
        if (isModified) {
            this.elements.saveBtn.classList.add('unsaved');
        } else {
            this.elements.saveBtn.classList.remove('unsaved');
        }
    }

    /**
     * Update zoom display
     */
    updateZoomDisplay(zoom) {
        this.elements.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    }

    /**
     * Update cursor position display
     */
    updateCursorPosition(x, y) {
        this.elements.cursorPos.textContent = `${x}, ${y}`;
    }

    /**
     * Show add class modal
     */
    showAddClassModal() {
        this.elements.addClassModal.classList.add('active');
        this.elements.newClassName.value = '';
        this.elements.newClassName.focus();
    }

    /**
     * Hide add class modal
     */
    hideAddClassModal() {
        this.elements.addClassModal.classList.remove('active');
    }

    /**
     * Handle adding a new class
     */
    handleAddClass() {
        const className = this.elements.newClassName.value.trim();
        if (className) {
            this.store.addClass(className);
            this.hideAddClassModal();
            this.showToast('success', `Class "${className}" added`);
        }
    }

    /**
     * Show shortcuts modal
     */
    showShortcutsModal() {
        this.elements.shortcutsModal.classList.add('active');
    }

    /**
     * Hide shortcuts modal
     */
    hideShortcutsModal() {
        this.elements.shortcutsModal.classList.remove('active');
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeyboard(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === '?') {
            this.showShortcutsModal();
            e.preventDefault();
        }

        if (e.key === 'h' || e.key === 'H') {
            this.store.toggleBoxVisibility();
            this.imageCanvas.render();
            e.preventDefault();
        }

        if (e.key === '0') {
            this.imageCanvas.fitToScreen();
            e.preventDefault();
        }

        if (e.key === '+' || e.key === '=') {
            const currentZoom = this.store.getState().zoom;
            this.imageCanvas.setZoom(currentZoom * 1.2);
            e.preventDefault();
        }

        if (e.key === '-' || e.key === '_') {
            const currentZoom = this.store.getState().zoom;
            this.imageCanvas.setZoom(currentZoom / 1.2);
            e.preventDefault();
        }

        if (e.key === 'ArrowLeft') {
            this.navigateImage(-1);
            e.preventDefault();
        }

        if (e.key === 'ArrowRight') {
            this.navigateImage(1);
            e.preventDefault();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            const event = new CustomEvent('saveRequested');
            document.dispatchEvent(event);
            e.preventDefault();
        }
    }

    /**
     * Navigate between images
     */
    navigateImage(direction) {
        const images = this.store.getAllImages();
        const currentImageId = this.store.getState().currentImageId;
        const currentIndex = images.findIndex(img => img.id === currentImageId);

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < images.length) {
            const event = new CustomEvent('imageSelected', {
                detail: { imageId: images[newIndex].id }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Show toast notification
     */
    showToast(type, message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                this.elements.toastContainer.removeChild(toast);
            }, 300);
        }, duration);
    }

    /**
     * Update status message
     */
    setStatus(message) {
        this.elements.statusMessage.textContent = message;
    }

    /**
     * Set folder path display
     */
    setFolderPath(path) {
        this.elements.folderPath.textContent = path;
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
