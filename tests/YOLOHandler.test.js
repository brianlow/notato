/**
 * YOLOHandler.test.js
 * Tests for YOLO format parsing and coordinate conversion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import YOLOHandler from '../src/js/YOLOHandler.js';

describe('YOLOHandler', () => {
    let handler;

    beforeEach(() => {
        handler = new YOLOHandler();
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

        it('should handle edge case at origin', () => {
            const normalized = {
                centerX: 0.1,
                centerY: 0.1,
                width: 0.2,
                height: 0.2
            };

            const pixels = handler.normalizedToPixels(normalized, 100, 100);

            expect(pixels.x).toBe(0);
            expect(pixels.y).toBe(0);
            expect(pixels.width).toBe(20);
            expect(pixels.height).toBe(20);
        });
    });

    describe('Classes Parsing', () => {
        it('should parse classes.txt file correctly', () => {
            const content = 'person\ncar\ndog\n';
            const classes = handler.parseClasses(content);

            expect(classes).toEqual(['person', 'car', 'dog']);
            expect(handler.getClasses()).toEqual(['person', 'car', 'dog']);
        });

        it('should handle empty lines and whitespace', () => {
            const content = '  person  \n\ncar\n  \ndog\n\n';
            const classes = handler.parseClasses(content);

            expect(classes).toEqual(['person', 'car', 'dog']);
        });

        it('should stringify classes correctly', () => {
            const classes = ['person', 'car', 'dog'];
            const content = handler.stringifyClasses(classes);

            expect(content).toBe('person\ncar\ndog\n');
        });
    });

    describe('YOLO Text Parsing', () => {
        it('should parse YOLO annotation text correctly', () => {
            handler.setClasses(['person', 'car', 'dog']);
            const content = '0 0.5 0.5 0.3 0.4\n1 0.25 0.25 0.15 0.2\n';

            const boxes = handler.parse(content, 1000, 800);

            expect(boxes).toHaveLength(2);

            // First box: person
            expect(boxes[0].classId).toBe(0);
            expect(boxes[0].className).toBe('person');
            expect(boxes[0].x).toBe(350);  // 500 - 150
            expect(boxes[0].y).toBe(240);  // 400 - 160
            expect(boxes[0].width).toBe(300);
            expect(boxes[0].height).toBe(320);

            // Second box: car
            expect(boxes[1].classId).toBe(1);
            expect(boxes[1].className).toBe('car');
            expect(boxes[1].x).toBe(175);  // 250 - 75
            expect(boxes[1].y).toBe(120);  // 200 - 80
            expect(boxes[1].width).toBe(150);
            expect(boxes[1].height).toBe(160);
        });

        it('should handle empty content', () => {
            const boxes = handler.parse('', 1000, 800);
            expect(boxes).toEqual([]);
        });

        it('should skip malformed lines', () => {
            handler.setClasses(['person']);
            const content = '0 0.5 0.5 0.3 0.4\ninvalid line\n0 0.2 0.2 0.1\n';

            const boxes = handler.parse(content, 1000, 800);

            expect(boxes).toHaveLength(1);  // Only the valid first line
            expect(boxes[0].classId).toBe(0);
        });

        it('should use fallback class name for unknown classes', () => {
            const content = '5 0.5 0.5 0.3 0.4\n';

            const boxes = handler.parse(content, 1000, 800);

            expect(boxes).toHaveLength(1);
            expect(boxes[0].classId).toBe(5);
            expect(boxes[0].className).toBe('class_5');
        });
    });

    describe('YOLO Text Stringification', () => {
        it('should stringify boxes to YOLO format correctly', () => {
            const boxes = [
                { classId: 0, x: 350, y: 240, width: 300, height: 320 },
                { classId: 1, x: 175, y: 120, width: 150, height: 160 }
            ];

            const content = handler.stringify(boxes, 1000, 800);
            const lines = content.trim().split('\n');

            expect(lines).toHaveLength(2);
            expect(lines[0]).toMatch(/^0 0\.500000 0\.500000 0\.300000 0\.400000$/);
            expect(lines[1]).toMatch(/^1 0\.250000 0\.250000 0\.150000 0\.200000$/);
        });

        it('should handle empty boxes array', () => {
            const content = handler.stringify([], 1000, 800);
            expect(content).toBe('');
        });

        it('should produce valid YOLO format that can be parsed back', () => {
            handler.setClasses(['person', 'car']);
            const originalBoxes = [
                { classId: 0, x: 100, y: 200, width: 150, height: 250 },
                { classId: 1, x: 400, y: 300, width: 100, height: 80 }
            ];

            const content = handler.stringify(originalBoxes, 640, 480);
            const parsedBoxes = handler.parse(content, 640, 480);

            expect(parsedBoxes).toHaveLength(2);
            expect(parsedBoxes[0].x).toBeCloseTo(originalBoxes[0].x, 0);
            expect(parsedBoxes[0].y).toBeCloseTo(originalBoxes[0].y, 0);
            expect(parsedBoxes[0].width).toBeCloseTo(originalBoxes[0].width, 0);
            expect(parsedBoxes[0].height).toBeCloseTo(originalBoxes[0].height, 0);
        });
    });

    describe('Real YOLO File Integration', () => {
        it('should parse fixed composition with exact labels and counts', () => {
            const classesPath = join(process.cwd(), 'datasets/yolo/classes.txt');
            const imagePath = join(process.cwd(), 'datasets/yolo/image_0.txt');

            const classesContent = readFileSync(classesPath, 'utf-8');
            const imageContent = readFileSync(imagePath, 'utf-8');

            handler.parseClasses(classesContent);
            const boxes = handler.parse(imageContent, 640, 640);

            // Fixed composition: 1 potato, 2 tatertots, 1 fries
            expect(boxes).toHaveLength(4);

            const potatoBoxes = boxes.filter(b => b.className === 'potato');
            const tatertotBoxes = boxes.filter(b => b.className === 'tatertot');
            const friesBoxes = boxes.filter(b => b.className === 'fries');

            expect(potatoBoxes).toHaveLength(1);
            expect(tatertotBoxes).toHaveLength(2);
            expect(friesBoxes).toHaveLength(1);

            // Verify class IDs match
            expect(potatoBoxes[0].classId).toBe(0);
            expect(tatertotBoxes[0].classId).toBe(1);
            expect(tatertotBoxes[1].classId).toBe(1);
            expect(friesBoxes[0].classId).toBe(2);

            // Verify all coordinates are valid
            boxes.forEach(box => {
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(640);
                expect(box.y + box.height).toBeLessThanOrEqual(640);
            });
        });

        it('should correctly parse YOLO files with multiple annotations', () => {
            const classesPath = join(process.cwd(), 'datasets/yolo/classes.txt');
            const yoloPath = join(process.cwd(), 'datasets/yolo/image_1.txt');

            const classesContent = readFileSync(classesPath, 'utf-8');
            const content = readFileSync(yoloPath, 'utf-8');

            handler.parseClasses(classesContent);
            const boxes = handler.parse(content, 640, 640);

            expect(boxes.length).toBeGreaterThan(0);

            // Verify all boxes have valid class IDs from our classes
            boxes.forEach(box => {
                expect(box.classId).toBeGreaterThanOrEqual(0);
                expect(box.classId).toBeLessThan(3); // 3 classes: potato, tatertot, fries
                expect(['potato', 'tatertot', 'fries']).toContain(box.className);
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
});
