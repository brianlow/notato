/**
 * AnnotationStore.test.js
 * Tests for in-memory annotation data management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnnotationStore from '../src/js/AnnotationStore.js';

describe('AnnotationStore', () => {
    let store;

    beforeEach(() => {
        store = new AnnotationStore();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const state = store.getState();

            expect(state.format).toBe('yolo');
            expect(state.images.size).toBe(0);
            expect(state.boxes.size).toBe(0);
            expect(state.classes).toEqual([]);
            expect(state.currentImageId).toBeNull();
            expect(state.selectedBoxId).toBeNull();
            expect(state.currentClassId).toBe(0);
            expect(state.zoom).toBe(1.0);
            expect(state.showBoxes).toBe(true);
        });

        it('should start with ID counters at 1', () => {
            expect(store.nextBoxId).toBe(1);
            expect(store.nextImageId).toBe(1);
        });
    });

    describe('Image Management', () => {
        it('should add new image and return ID', () => {
            const imageData = {
                fileName: 'test.jpg',
                filePath: '/path/to/test.jpg',
                width: 640,
                height: 480
            };

            const id = store.addImage(imageData);

            expect(id).toBe('img_1');
            expect(store.getState().images.size).toBe(1);

            const image = store.getImage(id);
            expect(image.fileName).toBe('test.jpg');
            expect(image.width).toBe(640);
            expect(image.height).toBe(480);
            expect(image.boxes).toEqual([]);
        });

        it('should use provided ID if given', () => {
            const imageData = {
                id: 'custom_id',
                fileName: 'test.jpg',
                width: 640,
                height: 480
            };

            const id = store.addImage(imageData);

            expect(id).toBe('custom_id');
            expect(store.getImage('custom_id')).toBeTruthy();
        });

        it('should auto-increment image IDs', () => {
            const id1 = store.addImage({ fileName: 'test1.jpg', width: 640, height: 480 });
            const id2 = store.addImage({ fileName: 'test2.jpg', width: 640, height: 480 });

            expect(id1).toBe('img_1');
            expect(id2).toBe('img_2');
        });

        it('should get image by ID', () => {
            const id = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            const image = store.getImage(id);

            expect(image).toBeTruthy();
            expect(image.fileName).toBe('test.jpg');
        });

        it('should return null for non-existent image', () => {
            const image = store.getImage('nonexistent');
            expect(image).toBeNull();
        });

        it('should get all images', () => {
            store.addImage({ fileName: 'test1.jpg', width: 640, height: 480 });
            store.addImage({ fileName: 'test2.jpg', width: 640, height: 480 });

            const images = store.getAllImages();

            expect(images).toHaveLength(2);
            expect(images[0].fileName).toBe('test1.jpg');
            expect(images[1].fileName).toBe('test2.jpg');
        });
    });

    describe('Box Management', () => {
        let imageId;

        beforeEach(() => {
            imageId = store.addImage({
                fileName: 'test.jpg',
                width: 640,
                height: 480
            });
            store.setClasses(['person', 'car', 'dog']);
        });

        it('should add box to image', () => {
            const boxData = {
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            };

            const boxId = store.addBox(boxData);

            expect(boxId).toBe('box_1');
            const box = store.getBox(boxId);
            expect(box.classId).toBe(0);
            expect(box.x).toBe(100);
            expect(box.width).toBe(200);
        });

        it('should add box reference to image', () => {
            const boxData = {
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            };

            const boxId = store.addBox(boxData);
            const image = store.getImage(imageId);

            expect(image.boxes).toContain(boxId);
        });

        it('should mark image as modified when adding box', () => {
            // Set as current image first (required for modification tracking)
            store.setCurrentImage(imageId);

            const boxData = {
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            };

            store.addBox(boxData);

            expect(store.isCurrentImageModified()).toBe(true);
            expect(store.getState().currentImageModified).toBe(true);
        });

        it('should update box properties', () => {
            const boxId = store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.updateBox(boxId, { x: 200, width: 300 });

            const box = store.getBox(boxId);
            expect(box.x).toBe(200);
            expect(box.width).toBe(300);
            expect(box.y).toBe(150);  // Unchanged
        });

        it('should delete box and remove from image', () => {
            const boxId = store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.deleteBox(boxId);

            expect(store.getBox(boxId)).toBeNull();
            const image = store.getImage(imageId);
            expect(image.boxes).not.toContain(boxId);
        });

        it('should deselect box when deleting selected box', () => {
            const boxId = store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.setSelectedBox(boxId);
            expect(store.getState().selectedBoxId).toBe(boxId);

            store.deleteBox(boxId);
            expect(store.getState().selectedBoxId).toBeNull();
        });

        it('should get all boxes for an image', () => {
            store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.addBox({
                classId: 1,
                x: 300,
                y: 200,
                width: 150,
                height: 100,
                imageId
            });

            const boxes = store.getBoxesForImage(imageId);

            expect(boxes).toHaveLength(2);
            expect(boxes[0].classId).toBe(0);
            expect(boxes[1].classId).toBe(1);
        });

        it('should return empty array for image with no boxes', () => {
            const boxes = store.getBoxesForImage(imageId);
            expect(boxes).toEqual([]);
        });
    });

    describe('Class Management', () => {
        it('should set classes', () => {
            const classes = ['person', 'car', 'dog'];
            store.setClasses(classes);

            expect(store.getClasses()).toEqual(classes);
            expect(store.getState().classes).toEqual(classes);
        });

        it('should add new class', () => {
            store.setClasses(['person', 'car']);
            const classId = store.addClass('dog');

            expect(classId).toBe(2);
            expect(store.getClasses()).toEqual(['person', 'car', 'dog']);
        });

        it('should assign incremental IDs to new classes', () => {
            const id1 = store.addClass('person');
            const id2 = store.addClass('car');
            const id3 = store.addClass('dog');

            expect(id1).toBe(0);
            expect(id2).toBe(1);
            expect(id3).toBe(2);
        });
    });

    describe('Current State Management', () => {
        it('should set and get current image', () => {
            const id = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });

            store.setCurrentImage(id);

            expect(store.getState().currentImageId).toBe(id);
            expect(store.getCurrentImage().fileName).toBe('test.jpg');
        });

        it('should clear selected box when changing image', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            const boxId = store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.setSelectedBox(boxId);
            expect(store.getState().selectedBoxId).toBe(boxId);

            const newImageId = store.addImage({ fileName: 'test2.jpg', width: 640, height: 480 });
            store.setCurrentImage(newImageId);

            expect(store.getState().selectedBoxId).toBeNull();
        });

        it('should set and get selected box', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            const boxId = store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });

            store.setSelectedBox(boxId);

            expect(store.getState().selectedBoxId).toBe(boxId);
            expect(store.getSelectedBox().id).toBe(boxId);
        });

        it('should set current class', () => {
            store.setCurrentClass(2);
            expect(store.getState().currentClassId).toBe(2);
        });

        it('should set format', () => {
            store.setFormat('coco');
            expect(store.getState().format).toBe('coco');
        });
    });

    describe('Modification Tracking', () => {
        it('should track modified images', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.setCurrentImage(imageId);

            store.markImageModified(imageId);

            expect(store.isCurrentImageModified()).toBe(true);
            expect(store.getState().currentImageModified).toBe(true);
        });

        it('should clear modified flag', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.setCurrentImage(imageId);
            store.markImageModified(imageId);

            store.clearImageModified();

            expect(store.isCurrentImageModified()).toBe(false);
            expect(store.getState().currentImageModified).toBe(false);
        });

        it('should check if current image is modified', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.setCurrentImage(imageId);

            expect(store.isCurrentImageModified()).toBe(false);

            store.markImageModified(imageId);

            expect(store.isCurrentImageModified()).toBe(true);
        });
    });

    describe('View State', () => {
        it('should set zoom level', () => {
            store.setZoom(2.5);
            expect(store.getState().zoom).toBe(2.5);
        });

        it('should set pan offset', () => {
            store.setPan(100, 200);
            expect(store.getState().panX).toBe(100);
            expect(store.getState().panY).toBe(200);
        });

        it('should toggle box visibility', () => {
            expect(store.getState().showBoxes).toBe(true);

            store.toggleBoxVisibility();
            expect(store.getState().showBoxes).toBe(false);

            store.toggleBoxVisibility();
            expect(store.getState().showBoxes).toBe(true);
        });
    });

    describe('Clear Operations', () => {
        it('should clear all data', () => {
            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });
            store.setClasses(['person', 'car']);

            store.clear();

            const state = store.getState();
            expect(state.images.size).toBe(0);
            expect(state.boxes.size).toBe(0);
            expect(state.classes).toEqual([]);
            expect(state.currentImageId).toBeNull();
            expect(state.selectedBoxId).toBeNull();
            expect(state.currentImageModified).toBe(false);
        });

        it('should reset ID counters when clearing', () => {
            store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.addImage({ fileName: 'test2.jpg', width: 640, height: 480 });

            store.clear();

            const id = store.addImage({ fileName: 'new.jpg', width: 640, height: 480 });
            expect(id).toBe('img_1');
        });
    });

    describe('Event Listeners', () => {
        it('should register and notify listeners', () => {
            const callback = vi.fn();
            store.on('format', callback);

            store.setFormat('coco');

            expect(callback).toHaveBeenCalledWith('coco');
        });

        it('should support multiple listeners for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            store.on('zoom', callback1);
            store.on('zoom', callback2);

            store.setZoom(2.0);

            expect(callback1).toHaveBeenCalledWith(2.0);
            expect(callback2).toHaveBeenCalledWith(2.0);
        });

        it('should unsubscribe listener', () => {
            const callback = vi.fn();
            store.on('zoom', callback);

            store.setZoom(1.5);
            expect(callback).toHaveBeenCalledTimes(1);

            store.off('zoom', callback);
            store.setZoom(2.0);

            expect(callback).toHaveBeenCalledTimes(1);  // Not called again
        });

        it('should notify on various state changes', () => {
            const imageCallback = vi.fn();
            const boxCallback = vi.fn();
            const classCallback = vi.fn();

            store.on('images', imageCallback);
            store.on('boxes', boxCallback);
            store.on('classes', classCallback);

            const imageId = store.addImage({ fileName: 'test.jpg', width: 640, height: 480 });
            store.addBox({
                classId: 0,
                x: 100,
                y: 150,
                width: 200,
                height: 250,
                imageId
            });
            store.setClasses(['person']);

            expect(imageCallback).toHaveBeenCalled();
            expect(boxCallback).toHaveBeenCalled();
            expect(classCallback).toHaveBeenCalled();
        });
    });
});
