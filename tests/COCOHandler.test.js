/**
 * COCOHandler.test.js
 * Tests for COCO format parsing and handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import COCOHandler from '../src/js/COCOHandler.js';

describe('COCOHandler', () => {
    let handler;

    beforeEach(() => {
        handler = new COCOHandler();
    });

    describe('Initialization', () => {
        it('should initialize with empty data structure', () => {
            const data = handler.getData();

            expect(data.images).toEqual([]);
            expect(data.annotations).toEqual([]);
            expect(data.categories).toEqual([]);
        });

        it('should initialize IDs starting at 1', () => {
            expect(handler.nextImageId).toBe(1);
            expect(handler.nextAnnotationId).toBe(1);
        });
    });

    describe('JSON Parsing', () => {
        it('should parse valid COCO JSON', () => {
            const json = JSON.stringify({
                images: [
                    { id: 1, file_name: 'test.jpg', width: 640, height: 480 }
                ],
                annotations: [
                    { id: 1, image_id: 1, category_id: 1, bbox: [10, 20, 30, 40], area: 1200, iscrowd: 0 }
                ],
                categories: [
                    { id: 1, name: 'person', supercategory: 'none' }
                ]
            });

            const data = handler.parse(json);

            expect(data.images).toHaveLength(1);
            expect(data.annotations).toHaveLength(1);
            expect(data.categories).toHaveLength(1);
            expect(data.images[0].file_name).toBe('test.jpg');
        });

        it('should build image ID map from parsed data', () => {
            const json = JSON.stringify({
                images: [
                    { id: 5, file_name: 'image1.jpg', width: 640, height: 480 },
                    { id: 10, file_name: 'image2.jpg', width: 640, height: 480 }
                ],
                annotations: [],
                categories: []
            });

            handler.parse(json);

            expect(handler.imageIdMap.get('image1.jpg')).toBe(5);
            expect(handler.imageIdMap.get('image2.jpg')).toBe(10);
        });

        it('should calculate next IDs from existing data', () => {
            const json = JSON.stringify({
                images: [
                    { id: 5, file_name: 'test.jpg', width: 640, height: 480 }
                ],
                annotations: [
                    { id: 10, image_id: 5, category_id: 1, bbox: [0, 0, 10, 10], area: 100, iscrowd: 0 }
                ],
                categories: []
            });

            handler.parse(json);

            expect(handler.nextImageId).toBe(6);
            expect(handler.nextAnnotationId).toBe(11);
        });

        it('should handle missing fields gracefully', () => {
            const json = JSON.stringify({});

            const data = handler.parse(json);

            expect(data.images).toEqual([]);
            expect(data.annotations).toEqual([]);
            expect(data.categories).toEqual([]);
        });

        it('should throw error for invalid JSON', () => {
            expect(() => handler.parse('not valid json')).toThrow('Invalid COCO JSON format');
        });
    });

    describe('Box Retrieval', () => {
        beforeEach(() => {
            const json = JSON.stringify({
                images: [
                    { id: 1, file_name: 'image1.jpg', width: 640, height: 480 },
                    { id: 2, file_name: 'image2.jpg', width: 640, height: 480 }
                ],
                annotations: [
                    { id: 1, image_id: 1, category_id: 1, bbox: [100, 100, 200, 150], area: 30000, iscrowd: 0 },
                    { id: 2, image_id: 1, category_id: 2, bbox: [350, 200, 100, 120], area: 12000, iscrowd: 0 },
                    { id: 3, image_id: 2, category_id: 1, bbox: [50, 50, 75, 100], area: 7500, iscrowd: 0 }
                ],
                categories: [
                    { id: 1, name: 'person', supercategory: 'none' },
                    { id: 2, name: 'car', supercategory: 'none' }
                ]
            });
            handler.parse(json);
        });

        it('should get boxes for specific image', () => {
            const boxes = handler.getBoxesForImage('image1.jpg');

            expect(boxes).toHaveLength(2);
            expect(boxes[0].className).toBe('person');
            expect(boxes[0].x).toBe(100);
            expect(boxes[0].y).toBe(100);
            expect(boxes[0].width).toBe(200);
            expect(boxes[0].height).toBe(150);
            expect(boxes[1].className).toBe('car');
        });

        it('should return empty array for non-existent image', () => {
            const boxes = handler.getBoxesForImage('nonexistent.jpg');
            expect(boxes).toEqual([]);
        });

        it('should include annotation IDs in returned boxes', () => {
            const boxes = handler.getBoxesForImage('image1.jpg');

            expect(boxes[0].id).toBe(1);
            expect(boxes[1].id).toBe(2);
        });

        it('should handle missing category gracefully', () => {
            const json = JSON.stringify({
                images: [{ id: 1, file_name: 'test.jpg', width: 640, height: 480 }],
                annotations: [
                    { id: 1, image_id: 1, category_id: 99, bbox: [0, 0, 10, 10], area: 100, iscrowd: 0 }
                ],
                categories: []
            });
            handler.parse(json);

            const boxes = handler.getBoxesForImage('test.jpg');

            expect(boxes).toHaveLength(1);
            expect(boxes[0].className).toBe('category_99');
        });
    });

    describe('Box Updates', () => {
        beforeEach(() => {
            handler.initEmpty();
            handler.setCategories([
                { id: 1, name: 'person', supercategory: 'none' },
                { id: 2, name: 'car', supercategory: 'none' }
            ]);
        });

        it('should add new image when setting boxes for new file', () => {
            const boxes = [
                { classId: 1, x: 10, y: 20, width: 30, height: 40 }
            ];

            handler.setBoxesForImage('new.jpg', boxes, 640, 480);

            const data = handler.getData();
            expect(data.images).toHaveLength(1);
            expect(data.images[0].file_name).toBe('new.jpg');
            expect(data.images[0].width).toBe(640);
            expect(data.images[0].height).toBe(480);
        });

        it('should add annotations for boxes', () => {
            const boxes = [
                { classId: 1, x: 10, y: 20, width: 30, height: 40 },
                { classId: 2, x: 100, y: 150, width: 50, height: 60 }
            ];

            handler.setBoxesForImage('test.jpg', boxes, 640, 480);

            const data = handler.getData();
            expect(data.annotations).toHaveLength(2);
            expect(data.annotations[0].bbox).toEqual([10, 20, 30, 40]);
            expect(data.annotations[0].area).toBe(1200);
            expect(data.annotations[1].category_id).toBe(2);
        });

        it('should replace existing annotations when updating', () => {
            const initialBoxes = [
                { classId: 1, x: 10, y: 20, width: 30, height: 40 },
                { classId: 2, x: 100, y: 150, width: 50, height: 60 }
            ];
            handler.setBoxesForImage('test.jpg', initialBoxes, 640, 480);

            const updatedBoxes = [
                { classId: 1, x: 200, y: 300, width: 100, height: 120 }
            ];
            handler.setBoxesForImage('test.jpg', updatedBoxes, 640, 480);

            const data = handler.getData();
            expect(data.annotations).toHaveLength(1);
            expect(data.annotations[0].bbox).toEqual([200, 300, 100, 120]);
        });

        it('should preserve box IDs if provided', () => {
            const boxes = [
                { id: 42, classId: 1, x: 10, y: 20, width: 30, height: 40 }
            ];

            handler.setBoxesForImage('test.jpg', boxes, 640, 480);

            const data = handler.getData();
            expect(data.annotations[0].id).toBe(42);
        });

        it('should auto-generate IDs if not provided', () => {
            const boxes = [
                { classId: 1, x: 10, y: 20, width: 30, height: 40 }
            ];

            handler.setBoxesForImage('test.jpg', boxes, 640, 480);

            const data = handler.getData();
            expect(data.annotations[0].id).toBe(1);
        });

        it('should not add duplicate image when image ID is 0', () => {
            // Bug fix test: image_id 0 should not be treated as falsy
            const json = JSON.stringify({
                images: [
                    { id: 0, file_name: 'image_000000.jpg', width: 672, height: 672 }
                ],
                annotations: [
                    { id: 0, image_id: 0, category_id: 0, bbox: [228, 142, 54, 81], area: 4374, iscrowd: 0 }
                ],
                categories: [
                    { id: 0, name: 'lego', supercategory: 'part' }
                ]
            });

            handler.parse(json);

            // Update the box for the existing image
            const updatedBoxes = [
                { id: 0, classId: 0, x: 250, y: 150, width: 60, height: 90 }
            ];
            handler.setBoxesForImage('image_000000.jpg', updatedBoxes, 672, 672);

            const data = handler.getData();
            // Should still have only 1 image, not 2
            expect(data.images).toHaveLength(1);
            expect(data.images[0].id).toBe(0);
            expect(data.images[0].file_name).toBe('image_000000.jpg');

            // Annotation should be updated
            expect(data.annotations).toHaveLength(1);
            expect(data.annotations[0].bbox).toEqual([250, 150, 60, 90]);
            expect(data.annotations[0].image_id).toBe(0);
        });
    });

    describe('Category Management', () => {
        it('should add new category', () => {
            const id = handler.addCategory('dog', 'animal');

            const categories = handler.getCategories();
            expect(categories).toHaveLength(1);
            expect(categories[0].id).toBe(id);
            expect(categories[0].name).toBe('dog');
            expect(categories[0].supercategory).toBe('animal');
        });

        it('should increment category IDs', () => {
            const id1 = handler.addCategory('person');
            const id2 = handler.addCategory('car');

            expect(id2).toBe(id1 + 1);
        });

        it('should get category name by ID', () => {
            handler.addCategory('person');

            const name = handler.getCategoryName(1);
            expect(name).toBe('person');
        });

        it('should get category ID by name', () => {
            handler.addCategory('person');
            handler.addCategory('car');

            expect(handler.getCategoryId('car')).toBe(2);
            expect(handler.getCategoryId('person')).toBe(1);
            expect(handler.getCategoryId('nonexistent')).toBeNull();
        });

        it('should set categories from array', () => {
            const categories = [
                { id: 10, name: 'person', supercategory: 'human' },
                { id: 20, name: 'car', supercategory: 'vehicle' }
            ];

            handler.setCategories(categories);

            expect(handler.getCategories()).toEqual(categories);
        });
    });

    describe('JSON Stringification', () => {
        it('should produce valid JSON string', () => {
            handler.addImage('test.jpg', 640, 480);
            handler.addCategory('person');

            const json = handler.stringify();
            const parsed = JSON.parse(json);

            expect(parsed.images).toHaveLength(1);
            expect(parsed.categories).toHaveLength(1);
        });

        it('should format JSON with indentation', () => {
            handler.addImage('test.jpg', 640, 480);

            const json = handler.stringify();

            expect(json).toContain('  ');  // Contains indentation
            expect(json).toContain('\n');   // Contains newlines
        });
    });

    describe('Real COCO File Integration', () => {
        it('should correctly parse sample COCO file from datasets/coco-3', () => {
            const cocoPath = join(process.cwd(), 'datasets/coco-3/_annotations.coco.json');
            const content = readFileSync(cocoPath, 'utf-8');

            handler.parse(content);

            const data = handler.getData();
            expect(data.images).toHaveLength(3);
            expect(data.annotations.length).toBeGreaterThan(0);
            expect(data.categories).toHaveLength(3);

            // Verify categories
            expect(data.categories[0].name).toBe('potato');
            expect(data.categories[1].name).toBe('tatertot');
            expect(data.categories[2].name).toBe('fries');

            // Verify we can retrieve boxes for the first image
            const boxes = handler.getBoxesForImage('image_0.jpg');
            expect(boxes.length).toBeGreaterThan(0);
            boxes.forEach(box => {
                expect(['potato', 'tatertot', 'fries']).toContain(box.className);
            });
        });

        it('should correctly parse COCO files with multiple categories', () => {
            const cocoPath = join(process.cwd(), 'datasets/coco-3/_annotations.coco.json');
            const content = readFileSync(cocoPath, 'utf-8');

            handler.parse(content);

            const data = handler.getData();
            expect(data.images.length).toBeGreaterThan(0);
            expect(data.annotations.length).toBeGreaterThan(0);
            expect(data.categories).toHaveLength(3);

            // Verify category names
            const categoryNames = data.categories.map(c => c.name);
            expect(categoryNames).toContain('potato');
            expect(categoryNames).toContain('tatertot');
            expect(categoryNames).toContain('fries');

            // Verify we can retrieve boxes for the first image
            const firstImage = data.images[0];
            const boxes = handler.getBoxesForImage(firstImage.file_name);
            expect(boxes.length).toBeGreaterThan(0);

            // All boxes should have valid classes
            boxes.forEach(box => {
                expect(['potato', 'tatertot', 'fries']).toContain(box.className);
                expect(box.classId).toBeGreaterThanOrEqual(0);
                expect(box.classId).toBeLessThan(3);
            });
        });

        it('should handle COCO files with image dimensions', () => {
            const cocoPath = join(process.cwd(), 'datasets/coco-3/_annotations.coco.json');
            const content = readFileSync(cocoPath, 'utf-8');

            handler.parse(content);

            const data = handler.getData();
            data.images.forEach(img => {
                expect(img.width).toBe(640);
                expect(img.height).toBe(640);
            });
        });
    });

    describe('Round-trip Conversion', () => {
        it('should maintain data integrity through parse and stringify', () => {
            const original = {
                images: [
                    { id: 1, file_name: 'test.jpg', width: 640, height: 480 }
                ],
                annotations: [
                    { id: 1, image_id: 1, category_id: 1, bbox: [100, 200, 150, 250], area: 37500, iscrowd: 0 }
                ],
                categories: [
                    { id: 1, name: 'person', supercategory: 'none' }
                ]
            };

            handler.parse(JSON.stringify(original));
            const json = handler.stringify();
            const roundTrip = JSON.parse(json);

            expect(roundTrip.images).toEqual(original.images);
            expect(roundTrip.annotations).toEqual(original.annotations);
            expect(roundTrip.categories).toEqual(original.categories);
        });
    });
});
