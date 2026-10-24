/**
 * remove.test.js
 * Tests for moving images and their annotations to the deleted folder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import YOLOHandler from '../src/js/YOLOHandler.js';
import COCOHandler from '../src/js/COCOHandler.js';
import NDJSONHandler from '../src/js/NDJSONHandler.js';
import AnnotationStore from '../src/js/AnnotationStore.js';

// In-memory stand-in for FileManager's text file API
class MemoryFileManager {
    constructor(files = {}) {
        this.files = new Map(Object.entries(files));
        this.deletedFolder = '_deleted';
    }

    async readTextFile(path) {
        return this.files.has(path) ? this.files.get(path) : null;
    }

    async writeTextFile(path, content) {
        this.files.set(path, content);
    }

    async moveToDeleted(path) {
        if (!this.files.has(path)) return false;
        this.files.set(`${this.deletedFolder}/${path}`, this.files.get(path));
        this.files.delete(path);
        return true;
    }
}

const image = { id: 'img_1', fileName: 'a.jpg', filePath: 'a.jpg', width: 100, height: 100 };

describe('YOLOHandler.remove', () => {
    it('moves the label file to the deleted folder', async () => {
        const fm = new MemoryFileManager({ 'a.txt': '0 0.5 0.5 0.1 0.1\n' });
        await new YOLOHandler().remove(fm, image);

        expect(fm.files.has('a.txt')).toBe(false);
        expect(fm.files.get('_deleted/a.txt')).toBe('0 0.5 0.5 0.1 0.1\n');
    });

    it('does nothing when there is no label file', async () => {
        const fm = new MemoryFileManager();
        await new YOLOHandler().remove(fm, image);
        expect(fm.files.size).toBe(0);
    });
});

describe('COCOHandler.remove', () => {
    const coco = {
        images: [
            { id: 1, file_name: 'a.jpg', width: 100, height: 100 },
            { id: 2, file_name: 'b.jpg', width: 100, height: 100 }
        ],
        annotations: [
            { id: 1, image_id: 1, category_id: 1, bbox: [0, 0, 10, 10] },
            { id: 2, image_id: 2, category_id: 1, bbox: [0, 0, 10, 10] }
        ],
        categories: [{ id: 1, name: 'potato', supercategory: 'none' }]
    };

    let handler;
    let fm;

    beforeEach(async () => {
        handler = new COCOHandler();
        fm = new MemoryFileManager({ '_annotations.coco.json': JSON.stringify(coco) });
        await handler.load(fm, []);
    });

    it('removes the image and its annotations from the dataset', async () => {
        await handler.remove(fm, image);

        const remaining = JSON.parse(fm.files.get('_annotations.coco.json'));
        expect(remaining.images.map(img => img.file_name)).toEqual(['b.jpg']);
        expect(remaining.annotations.map(ann => ann.id)).toEqual([2]);
    });

    it('keeps the removed entries in the deleted folder', async () => {
        await handler.remove(fm, image);
        await handler.remove(fm, { ...image, id: 'img_2', fileName: 'b.jpg', filePath: 'b.jpg' });

        const deleted = JSON.parse(fm.files.get('_deleted/_annotations.coco.json'));
        expect(deleted.images.map(img => img.file_name)).toEqual(['a.jpg', 'b.jpg']);
        expect(deleted.annotations.map(ann => ann.id)).toEqual([1, 2]);
        expect(deleted.categories).toEqual(coco.categories);
    });
});

describe('NDJSONHandler.remove', () => {
    const lines = [
        { type: 'dataset', task: 'detect', class_names: { 0: 'potato' } },
        { type: 'image', file: 'a.jpg', width: 100, height: 100, annotations: { boxes: [[0, 0.5, 0.5, 0.1, 0.1]] } },
        { type: 'image', file: 'b.jpg', width: 100, height: 100, annotations: { boxes: [] } }
    ];

    let handler;
    let fm;

    beforeEach(async () => {
        handler = new NDJSONHandler();
        fm = new MemoryFileManager({ 'dataset.ndjson': lines.map(l => JSON.stringify(l)).join('\n') + '\n' });
        await handler.load(fm, []);
    });

    it('removes the image record and keeps it in the deleted folder', async () => {
        await handler.remove(fm, image);

        const remaining = fm.files.get('dataset.ndjson').trim().split('\n').map(l => JSON.parse(l));
        expect(remaining.map(r => r.file || r.type)).toEqual(['dataset', 'b.jpg']);

        const deleted = fm.files.get('_deleted/dataset.ndjson').trim().split('\n').map(l => JSON.parse(l));
        expect(deleted.map(r => r.file || r.type)).toEqual(['dataset', 'a.jpg']);
    });

    it('appends to an existing deleted file', async () => {
        await handler.remove(fm, image);
        await handler.remove(fm, { ...image, id: 'img_2', fileName: 'b.jpg', filePath: 'b.jpg' });

        const deleted = fm.files.get('_deleted/dataset.ndjson').trim().split('\n').map(l => JSON.parse(l));
        expect(deleted.map(r => r.file || r.type)).toEqual(['dataset', 'a.jpg', 'b.jpg']);
    });
});

describe('AnnotationStore.removeImage', () => {
    it('removes the image and its boxes, clearing current image', () => {
        const store = new AnnotationStore();
        const imageId = store.addImage({ fileName: 'a.jpg', filePath: 'a.jpg', width: 100, height: 100 });
        const boxId = store.addBox({ imageId, classId: 0, x: 0, y: 0, width: 10, height: 10 });
        store.setCurrentImage(imageId);

        store.removeImage(imageId);

        expect(store.getImage(imageId)).toBeNull();
        expect(store.getBox(boxId)).toBeNull();
        expect(store.getState().currentImageId).toBeNull();
    });
});
