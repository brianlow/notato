/**
 * FileManager.js
 * Handles file system operations using File System Access API
 * with drag-drop fallback for unsupported browsers
 */

class FileManager {
    constructor() {
        this.hasFileSystemAccess = 'showDirectoryPicker' in window;
        this.imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        this.directoryHandle = null;
        this.fileCache = new Map(); // fileName -> FileHandle
    }

    /**
     * Check if File System Access API is supported
     * @returns {boolean} True if supported
     */
    isFileSystemAccessSupported() {
        return this.hasFileSystemAccess;
    }

    /**
     * Open a folder dialog and load images
     * @returns {Promise<Array>} Array of image file data
     */
    async openFolder() {
        if (this.hasFileSystemAccess) {
            return await this.openFolderWithAPI();
        } else {
            throw new Error('File System Access API not supported. Use drag-and-drop fallback.');
        }
    }

    /**
     * Open folder using File System Access API
     * @returns {Promise<Array>} Array of image file data
     */
    async openFolderWithAPI() {
        try {
            this.directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            const files = await this.scanDirectory(this.directoryHandle);
            return files;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Folder selection cancelled');
            }
            throw error;
        }
    }

    /**
     * Recursively scan directory for image files
     * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
     * @param {string} relativePath - Relative path from root
     * @returns {Promise<Array>} Array of file data
     */
    async scanDirectory(dirHandle, relativePath = '') {
        const files = [];

        try {
            for await (const entry of dirHandle.values()) {
                const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    const ext = this.getFileExtension(entry.name);
                    if (this.imageExtensions.includes(ext)) {
                        const fileHandle = await dirHandle.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();

                        files.push({
                            name: entry.name,
                            path: path,
                            file: file,
                            handle: fileHandle
                        });

                        this.fileCache.set(path, fileHandle);
                    }
                }
                // Skip subdirectories - only scan root folder
            }
        } catch (error) {
            console.error('Error scanning directory:', error);
        }

        return files;
    }

    /**
     * Read a text file (annotations, classes)
     * @param {string} fileName - File name relative to root
     * @returns {Promise<string>} File content
     */
    async readTextFile(fileName) {
        try {
            const fileHandle = await this.getFileHandle(fileName);
            if (!fileHandle) return null;

            const file = await fileHandle.getFile();
            return await file.text();
        } catch (error) {
            console.error(`Error reading file ${fileName}:`, error);
            return null;
        }
    }

    /**
     * Write a text file
     * @param {string} fileName - File name relative to root
     * @param {string} content - File content
     */
    async writeTextFile(fileName, content) {
        try {
            const fileHandle = await this.getOrCreateFileHandle(fileName);
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (error) {
            console.error(`Error writing file ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * Get file handle for a path
     * @param {string} filePath - File path relative to root
     * @returns {Promise<FileSystemFileHandle|null>} File handle
     */
    async getFileHandle(filePath) {
        if (this.fileCache.has(filePath)) {
            return this.fileCache.get(filePath);
        }

        if (!this.directoryHandle) return null;

        try {
            const parts = filePath.split('/');
            let currentHandle = this.directoryHandle;

            // Navigate through directories
            for (let i = 0; i < parts.length - 1; i++) {
                currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
            }

            // Get file handle
            const fileName = parts[parts.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName);
            this.fileCache.set(filePath, fileHandle);
            return fileHandle;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get or create file handle
     * @param {string} filePath - File path relative to root
     * @returns {Promise<FileSystemFileHandle>} File handle
     */
    async getOrCreateFileHandle(filePath) {
        let fileHandle = await this.getFileHandle(filePath);
        if (fileHandle) return fileHandle;

        if (!this.directoryHandle) {
            throw new Error('No directory handle available');
        }

        try {
            const parts = filePath.split('/');
            let currentHandle = this.directoryHandle;

            // Navigate/create directories
            for (let i = 0; i < parts.length - 1; i++) {
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
                } catch {
                    currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
                }
            }

            // Create file
            const fileName = parts[parts.length - 1];
            fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
            this.fileCache.set(filePath, fileHandle);
            return fileHandle;
        } catch (error) {
            console.error(`Error creating file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Get YOLO label file path for an image
     * @param {string} imagePath - Image file path
     * @returns {string} Label file path
     */
    getYOLOLabelPath(imagePath) {
        const fileName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

        // Label file in same directory as image
        return `${baseName}.txt`;
    }

    /**
     * Load image as data URL
     * @param {File} file - Image file
     * @returns {Promise<Object>} Image data with URL and dimensions
     */
    async loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        url: e.target.result,
                        width: img.width,
                        height: img.height
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Get file extension from filename
     * @param {string} fileName - File name
     * @returns {string} Extension (lowercase, without dot)
     */
    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }

    /**
     * Check if file exists
     * @param {string} filePath - File path relative to root
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(filePath) {
        const handle = await this.getFileHandle(filePath);
        return handle !== null;
    }

    /**
     * Get directory name from directory handle
     * @returns {string} Directory name
     */
    getDirectoryName() {
        return this.directoryHandle ? this.directoryHandle.name : '';
    }

    /**
     * Clear all cached file handles
     * Call this when loading a new folder to prevent reading stale files
     */
    clear() {
        this.fileCache.clear();
        this.directoryHandle = null;
    }

    /**
     * Handle drag and drop events (fallback for unsupported browsers)
     * @param {DataTransfer} dataTransfer - Drag data transfer object
     * @returns {Promise<Array>} Array of image files
     */
    async handleDragDrop(dataTransfer) {
        const files = [];
        const items = dataTransfer.items;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    await this.traverseEntry(entry, files, '');
                }
            }
        }

        return files;
    }

    /**
     * Recursively traverse file system entry
     * @param {FileSystemEntry} entry - File system entry
     * @param {Array} files - Accumulator for files
     * @param {string} path - Current path
     */
    async traverseEntry(entry, files, path) {
        if (entry.isFile) {
            const ext = this.getFileExtension(entry.name);
            if (this.imageExtensions.includes(ext)) {
                const file = await new Promise((resolve, reject) => {
                    entry.file(resolve, reject);
                });

                files.push({
                    name: entry.name,
                    path: path ? `${path}/${entry.name}` : entry.name,
                    file: file,
                    subfolder: path
                });
            }
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const entries = await new Promise((resolve, reject) => {
                reader.readEntries(resolve, reject);
            });

            for (const subEntry of entries) {
                const subPath = path ? `${path}/${entry.name}` : entry.name;
                await this.traverseEntry(subEntry, files, subPath);
            }
        }
    }
}

// Export for ES6 modules
export default FileManager;
