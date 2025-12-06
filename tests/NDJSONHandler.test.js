/**
 * NDJSONHandler.test.js
 * Tests for NDJSON format parsing and coordinate conversion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import NDJSONHandler from '../src/js/NDJSONHandler.js';

describe('NDJSONHandler', () => {
    let handler;

    beforeEach(() => {
        handler = new NDJSONHandler();
    });

    describe('Coordinate Conversion', () => {
        it('should convert normalized center coords to pixel top-left coords', () => {
            const normalized = {
                centerX: 0.5,
                centerY: 0.5,
                width: 0.2,
                height: 0.3
            };

            const pixels = handler.normalizedToPixels(normalized, 1000, 800);

            expect(pixels.x).toBe(400);  // 500 - 100
            expect(pixels.y).toBe(280);  // 400 - 120
            expect(pixels.width).toBe(200);
            expect(pixels.height).toBe(240);
        });

        it('should convert pixel top-left coords to normalized center coords', () => {
            const pixels = {
                x: 400,
                y: 280,
                width: 200,
                height: 240
            };

            const normalized = handler.pixelsToNormalized(pixels, 1000, 800);

            expect(normalized.centerX).toBeCloseTo(0.5, 5);
            expect(normalized.centerY).toBeCloseTo(0.5, 5);
            expect(normalized.width).toBeCloseTo(0.2, 5);
            expect(normalized.height).toBeCloseTo(0.3, 5);
        });

        it('should handle round-trip conversion without loss', () => {
            const original = {
                centerX: 0.75,
                centerY: 0.25,
                width: 0.15,
                height: 0.4
            };

            const pixels = handler.normalizedToPixels(original, 640, 480);
            const roundTrip = handler.pixelsToNormalized(pixels, 640, 480);

            expect(roundTrip.centerX).toBeCloseTo(original.centerX, 5);
            expect(roundTrip.centerY).toBeCloseTo(original.centerY, 5);
            expect(roundTrip.width).toBeCloseTo(original.width, 5);
            expect(roundTrip.height).toBeCloseTo(original.height, 5);
        });

        it('should clamp values to 0-1 range', () => {
            const pixels = {
                x: -50,  // Negative x
                y: 0,
                width: 1000,  // Extends beyond image
                height: 100
            };

            const normalized = handler.pixelsToNormalized(pixels, 640, 480);

            expect(normalized.centerX).toBeGreaterThanOrEqual(0);
            expect(normalized.centerX).toBeLessThanOrEqual(1);
            expect(normalized.centerY).toBeGreaterThanOrEqual(0);
            expect(normalized.centerY).toBeLessThanOrEqual(1);
            expect(normalized.width).toBeGreaterThanOrEqual(0);
            expect(normalized.width).toBeLessThanOrEqual(1);
            expect(normalized.height).toBeGreaterThanOrEqual(0);
            expect(normalized.height).toBeLessThanOrEqual(1);
        });
    });

    describe('Class Names Conversion', () => {
        it('should convert class_names object to array', () => {
            const classNames = {
                "0": "person",
                "1": "car",
                "2": "dog"
            };

            const classes = handler.classNamesToArray(classNames);

            expect(classes).toEqual(['person', 'car', 'dog']);
        });

        it('should handle gaps in class IDs', () => {
            const classNames = {
                "0": "person",
                "2": "dog"
            };

            const classes = handler.classNamesToArray(classNames);

            expect(classes).toEqual(['person', 'class_1', 'dog']);
        });

        it('should convert array to class_names object', () => {
            const classes = ['person', 'car', 'dog'];
            const classNames = handler.arrayToClassNames(classes);

            expect(classNames).toEqual({
                "0": "person",
                "1": "car",
                "2": "dog"
            });
        });

        it('should handle empty array', () => {
            const classes = [];
            const classNames = handler.arrayToClassNames(classes);

            expect(classNames).toEqual({});
        });

        it('should handle array input to classNamesToArray', () => {
            const classes = ['person', 'car', 'dog'];
            const result = handler.classNamesToArray(classes);

            expect(result).toEqual(['person', 'car', 'dog']);
        });
    });

    describe('Box Parsing', () => {
        it('should parse NDJSON box format correctly', () => {
            const ndjsonBoxes = [
                [0, 0.5, 0.5, 0.3, 0.4],
                [1, 0.25, 0.25, 0.15, 0.2]
            ];

            const boxes = handler.parseBoxes(ndjsonBoxes, 1000, 800);

            expect(boxes).toHaveLength(2);

            // First box
            expect(boxes[0].classId).toBe(0);
            expect(boxes[0].x).toBe(350);  // 500 - 150
            expect(boxes[0].y).toBe(240);  // 400 - 160
            expect(boxes[0].width).toBe(300);
            expect(boxes[0].height).toBe(320);

            // Second box
            expect(boxes[1].classId).toBe(1);
            expect(boxes[1].x).toBe(175);  // 250 - 75
            expect(boxes[1].y).toBe(120);  // 200 - 80
            expect(boxes[1].width).toBe(150);
            expect(boxes[1].height).toBe(160);
        });

        it('should handle empty boxes array', () => {
            const boxes = handler.parseBoxes([], 1000, 800);
            expect(boxes).toEqual([]);
        });

        it('should skip malformed box data', () => {
            const ndjsonBoxes = [
                [0, 0.5, 0.5, 0.3, 0.4],
                [1, 0.25],  // Invalid: too few elements
                "invalid",  // Invalid: not an array
                [2, 0.75, 0.75, 0.2, 0.2]
            ];

            const boxes = handler.parseBoxes(ndjsonBoxes, 1000, 800);

            expect(boxes).toHaveLength(2);
            expect(boxes[0].classId).toBe(0);
            expect(boxes[1].classId).toBe(2);
        });
    });

    describe('Box Stringification', () => {
        it('should stringify boxes to NDJSON format correctly', () => {
            const boxes = [
                { classId: 0, x: 350, y: 240, width: 300, height: 320 },
                { classId: 1, x: 175, y: 120, width: 150, height: 160 }
            ];

            const ndjsonBoxes = handler.stringifyBoxes(boxes, 1000, 800);

            expect(ndjsonBoxes).toHaveLength(2);
            expect(ndjsonBoxes[0]).toHaveLength(5);
            expect(ndjsonBoxes[1]).toHaveLength(5);

            // First box
            expect(ndjsonBoxes[0][0]).toBe(0);  // class_id
            expect(ndjsonBoxes[0][1]).toBeCloseTo(0.5, 5);  // center_x
            expect(ndjsonBoxes[0][2]).toBeCloseTo(0.5, 5);  // center_y
            expect(ndjsonBoxes[0][3]).toBeCloseTo(0.3, 5);  // width
            expect(ndjsonBoxes[0][4]).toBeCloseTo(0.4, 5);  // height

            // Second box
            expect(ndjsonBoxes[1][0]).toBe(1);
            expect(ndjsonBoxes[1][1]).toBeCloseTo(0.25, 5);
            expect(ndjsonBoxes[1][2]).toBeCloseTo(0.25, 5);
            expect(ndjsonBoxes[1][3]).toBeCloseTo(0.15, 5);
            expect(ndjsonBoxes[1][4]).toBeCloseTo(0.2, 5);
        });

        it('should handle empty boxes array', () => {
            const ndjsonBoxes = handler.stringifyBoxes([], 1000, 800);
            expect(ndjsonBoxes).toEqual([]);
        });

        it('should produce valid format that can be parsed back', () => {
            const originalBoxes = [
                { classId: 0, x: 100, y: 200, width: 150, height: 250 },
                { classId: 1, x: 400, y: 300, width: 100, height: 80 }
            ];

            const ndjsonBoxes = handler.stringifyBoxes(originalBoxes, 640, 480);
            const parsedBoxes = handler.parseBoxes(ndjsonBoxes, 640, 480);

            expect(parsedBoxes).toHaveLength(2);
            expect(parsedBoxes[0].x).toBeCloseTo(originalBoxes[0].x, 0);
            expect(parsedBoxes[0].y).toBeCloseTo(originalBoxes[0].y, 0);
            expect(parsedBoxes[0].width).toBeCloseTo(originalBoxes[0].width, 0);
            expect(parsedBoxes[0].height).toBeCloseTo(originalBoxes[0].height, 0);
        });
    });

    describe('NDJSON Parsing', () => {
        it('should parse NDJSON content correctly', () => {
            const content = `{"type":"dataset","task":"detect","class_names":{"0":"person","1":"car"}}
{"type":"image","file":"image1.jpg","width":640,"height":480,"annotations":{"boxes":[[0,0.5,0.5,0.3,0.4]]}}
{"type":"image","file":"image2.jpg","width":640,"height":480,"annotations":{"boxes":[[1,0.25,0.25,0.15,0.2]]}}`;

            handler.parse(content);

            expect(handler.dataset).toBeDefined();
            expect(handler.dataset.type).toBe('dataset');
            expect(handler.dataset.task).toBe('detect');
            expect(handler.dataset.class_names).toEqual({"0":"person","1":"car"});

            expect(handler.imageRecords.size).toBe(2);
            expect(handler.imageRecords.has('image1.jpg')).toBe(true);
            expect(handler.imageRecords.has('image2.jpg')).toBe(true);

            const img1 = handler.imageRecords.get('image1.jpg');
            expect(img1.width).toBe(640);
            expect(img1.height).toBe(480);
            expect(img1.annotations.boxes).toHaveLength(1);
        });

        it('should handle empty content', () => {
            handler.parse('');

            expect(handler.dataset).toBeDefined();
            expect(handler.dataset.type).toBe('dataset');
            expect(handler.imageRecords.size).toBe(0);
        });

        it('should skip invalid JSON lines', () => {
            const content = `{"type":"dataset","task":"detect","class_names":{"0":"person"}}
invalid json line
{"type":"image","file":"image1.jpg","width":640,"height":480,"annotations":{"boxes":[]}}`;

            handler.parse(content);

            expect(handler.dataset).toBeDefined();
            expect(handler.imageRecords.size).toBe(1);
            expect(handler.imageRecords.has('image1.jpg')).toBe(true);
        });

        it('should create default dataset if none provided', () => {
            const content = `{"type":"image","file":"image1.jpg","width":640,"height":480,"annotations":{"boxes":[]}}`;

            handler.parse(content);

            expect(handler.dataset).toBeDefined();
            expect(handler.dataset.type).toBe('dataset');
            expect(handler.dataset.task).toBe('detect');
        });
    });

    describe('NDJSON Stringification', () => {
        it('should stringify dataset and images correctly', () => {
            handler.dataset = {
                type: 'dataset',
                task: 'detect',
                class_names: {"0": "person", "1": "car"}
            };

            handler.imageRecords.set('image1.jpg', {
                type: 'image',
                file: 'image1.jpg',
                width: 640,
                height: 480,
                annotations: { boxes: [[0, 0.5, 0.5, 0.3, 0.4]] }
            });

            const content = handler.stringify();
            const lines = content.trim().split('\n');

            expect(lines).toHaveLength(2);

            const dataset = JSON.parse(lines[0]);
            expect(dataset.type).toBe('dataset');
            expect(dataset.class_names).toEqual({"0": "person", "1": "car"});

            const image = JSON.parse(lines[1]);
            expect(image.type).toBe('image');
            expect(image.file).toBe('image1.jpg');
        });

        it('should handle empty dataset', () => {
            handler.dataset = {
                type: 'dataset',
                task: 'detect',
                class_names: {}
            };

            const content = handler.stringify();
            const lines = content.trim().split('\n');

            expect(lines).toHaveLength(1);
            expect(JSON.parse(lines[0]).type).toBe('dataset');
        });

        it('should sort images by filename for consistency', () => {
            handler.dataset = { type: 'dataset', task: 'detect', class_names: {} };

            handler.imageRecords.set('zebra.jpg', { type: 'image', file: 'zebra.jpg', width: 640, height: 480, annotations: { boxes: [] } });
            handler.imageRecords.set('apple.jpg', { type: 'image', file: 'apple.jpg', width: 640, height: 480, annotations: { boxes: [] } });
            handler.imageRecords.set('banana.jpg', { type: 'image', file: 'banana.jpg', width: 640, height: 480, annotations: { boxes: [] } });

            const content = handler.stringify();
            const lines = content.trim().split('\n');

            expect(lines).toHaveLength(4);  // 1 dataset + 3 images
            expect(JSON.parse(lines[1]).file).toBe('apple.jpg');
            expect(JSON.parse(lines[2]).file).toBe('banana.jpg');
            expect(JSON.parse(lines[3]).file).toBe('zebra.jpg');
        });

        it('should produce valid NDJSON that can be parsed back', () => {
            handler.dataset = {
                type: 'dataset',
                task: 'detect',
                name: 'Test Dataset',
                class_names: {"0": "person", "1": "car"}
            };

            handler.imageRecords.set('image1.jpg', {
                type: 'image',
                file: 'image1.jpg',
                width: 640,
                height: 480,
                annotations: { boxes: [[0, 0.5, 0.5, 0.3, 0.4]] }
            });

            const content = handler.stringify();

            const handler2 = new NDJSONHandler();
            handler2.parse(content);

            expect(handler2.dataset.name).toBe('Test Dataset');
            expect(handler2.dataset.class_names).toEqual({"0": "person", "1": "car"});
            expect(handler2.imageRecords.size).toBe(1);
            expect(handler2.imageRecords.get('image1.jpg').width).toBe(640);
        });
    });

    describe('Real NDJSON File Integration', () => {
        it('should parse sample dataset with exact labels and counts', () => {
            const ndjsonPath = join(process.cwd(), 'datasets/ndjson/dataset.ndjson');
            const content = readFileSync(ndjsonPath, 'utf-8');

            handler.parse(content);

            // Verify dataset metadata
            expect(handler.dataset).toBeDefined();
            expect(handler.dataset.type).toBe('dataset');
            expect(handler.dataset.task).toBe('detect');
            expect(handler.dataset.class_names).toEqual({
                "0": "potato",
                "1": "tatertot",
                "2": "fries"
            });

            // Verify image records
            expect(handler.imageRecords.size).toBe(3);
            expect(handler.imageRecords.has('image_0.jpg')).toBe(true);
            expect(handler.imageRecords.has('image_1.jpg')).toBe(true);
            expect(handler.imageRecords.has('image_2.jpg')).toBe(true);

            // Test image_0.jpg: should have 4 boxes
            const img0 = handler.imageRecords.get('image_0.jpg');
            expect(img0.width).toBe(640);
            expect(img0.height).toBe(640);
            expect(img0.annotations.boxes).toHaveLength(4);

            const boxes0 = handler.parseBoxes(img0.annotations.boxes, 640, 640);
            expect(boxes0).toHaveLength(4);

            // Verify all coordinates are valid
            boxes0.forEach(box => {
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(640);
                expect(box.y + box.height).toBeLessThanOrEqual(640);
            });
        });

        it('should correctly parse image with multiple annotations', () => {
            const ndjsonPath = join(process.cwd(), 'datasets/ndjson/dataset.ndjson');
            const content = readFileSync(ndjsonPath, 'utf-8');

            handler.parse(content);

            const img1 = handler.imageRecords.get('image_1.jpg');
            expect(img1.annotations.boxes.length).toBeGreaterThan(0);

            const boxes = handler.parseBoxes(img1.annotations.boxes, 640, 640);

            // Verify all boxes have valid class IDs
            boxes.forEach(box => {
                expect(box.classId).toBeGreaterThanOrEqual(0);
                expect(box.classId).toBeLessThan(3); // 3 classes: potato, tatertot, fries
            });

            // Verify coordinates are in valid pixel ranges
            boxes.forEach(box => {
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(640);
                expect(box.y + box.height).toBeLessThanOrEqual(640);
            });
        });
    });

    describe('getName', () => {
        it('should return correct format name', () => {
            expect(handler.getName()).toBe('ndjson');
        });
    });

    describe('Dataset Management', () => {
        it('should initialize empty dataset', () => {
            handler.initEmpty();

            expect(handler.dataset).toBeDefined();
            expect(handler.dataset.type).toBe('dataset');
            expect(handler.dataset.task).toBe('detect');
            expect(handler.dataset.class_names).toEqual({});
            expect(handler.imageRecords.size).toBe(0);
        });

        it('should preserve metadata when setting dataset', () => {
            handler.dataset = {
                type: 'dataset',
                task: 'detect',
                name: 'Original',
                class_names: {"0": "person"}
            };

            handler.setDataset({
                name: 'Updated',
                description: 'New description'
            });

            expect(handler.dataset.type).toBe('dataset');
            expect(handler.dataset.task).toBe('detect');
            expect(handler.dataset.name).toBe('Updated');
            expect(handler.dataset.description).toBe('New description');
            expect(handler.dataset.class_names).toEqual({"0": "person"});
        });
    });
});
