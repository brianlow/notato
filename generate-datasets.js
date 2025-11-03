#!/usr/bin/env node

/**
 * generate-datasets.js
 * Generates sample datasets for testing
 *
 * Requires: sharp (npm install sharp)
 * Usage: node generate-datasets.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMAGE_SIZE = 640;
const BACKGROUND_COLOR = { r: 245, g: 245, b: 245, alpha: 1 }; // whitesmoke

// Classes in order
const CLASSES = ['potato', 'tatertot', 'fries'];

// Get all available images for each class
function getClassImages() {
  const imagesDir = path.join(__dirname, 'images');
  const allFiles = fs.readdirSync(imagesDir);

  return {
    potato: allFiles.filter(f => f.startsWith('potato') && f.endsWith('.png') && f !== 'potato.png'),
    tatertot: allFiles.filter(f => f.startsWith('tater-tot') && f.endsWith('.png') && f !== 'tater-tot.png'),
    fries: allFiles.filter(f => f.startsWith('fries') && f.endsWith('.png') && f !== 'fries-3.png')
  };
}

// Check if two boxes overlap
function boxesOverlap(box1, box2) {
  return !(box1.x + box1.width < box2.x ||
           box2.x + box2.width < box1.x ||
           box1.y + box1.height < box2.y ||
           box2.y + box2.height < box1.y);
}

// Generate random position that doesn't overlap with existing boxes
function findNonOverlappingPosition(width, height, existingBoxes, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(Math.random() * (IMAGE_SIZE - width));
    const y = Math.floor(Math.random() * (IMAGE_SIZE - height));
    const newBox = { x, y, width, height };

    const overlaps = existingBoxes.some(box => boxesOverlap(newBox, box));
    if (!overlaps) {
      return newBox;
    }
  }
  return null;
}

// Create composite image with annotations
async function createAnnotatedImage(imageObjects) {
  // Create base image with whitesmoke background
  let canvas = sharp({
    create: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      channels: 4,
      background: BACKGROUND_COLOR
    }
  });

  const composites = [];
  const boxes = [];

  for (const obj of imageObjects) {
    const imagePath = path.join(__dirname, 'images', obj.filename);
    const imageBuffer = await sharp(imagePath)
      .resize(obj.width, obj.height, { fit: 'inside' })
      .toBuffer();

    const metadata = await sharp(imageBuffer).metadata();
    const actualWidth = metadata.width;
    const actualHeight = metadata.height;

    composites.push({
      input: imageBuffer,
      top: obj.y,
      left: obj.x
    });

    boxes.push({
      classId: CLASSES.indexOf(obj.className),
      className: obj.className,
      x: obj.x,
      y: obj.y,
      width: actualWidth,
      height: actualHeight
    });
  }

  if (composites.length > 0) {
    canvas = canvas.composite(composites);
  }

  return { imageBuffer: await canvas.jpeg().toBuffer(), boxes };
}

// Generate YOLO format annotation
function generateYOLO(boxes) {
  return boxes.map(box => {
    const centerX = (box.x + box.width / 2) / IMAGE_SIZE;
    const centerY = (box.y + box.height / 2) / IMAGE_SIZE;
    const width = box.width / IMAGE_SIZE;
    const height = box.height / IMAGE_SIZE;
    return `${box.classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
  }).join('\n') + '\n';
}

// Generate COCO format annotation
function generateCOCO(imageFiles, allBoxes, includeClasses = true) {
  const images = imageFiles.map((filename, idx) => ({
    id: idx,
    file_name: filename,
    width: IMAGE_SIZE,
    height: IMAGE_SIZE
  }));

  const annotations = [];
  let annotationId = 0;

  imageFiles.forEach((filename, imageIdx) => {
    const boxes = allBoxes[imageIdx];
    boxes.forEach(box => {
      annotations.push({
        id: annotationId++,
        image_id: imageIdx,
        category_id: box.classId,
        bbox: [box.x, box.y, box.width, box.height],
        area: box.width * box.height,
        iscrowd: 0
      });
    });
  });

  const categories = CLASSES.map((name, idx) => ({
    id: idx,
    name: name,
    supercategory: 'food'
  }));

  return {
    info: {
      description: "Sample dataset",
      version: "1.0",
      year: 2025
    },
    licenses: [],
    images,
    annotations,
    categories
  };
}

// Select random images from available options
function selectRandomImages(classImages, count) {
  const selected = [];
  const existingBoxes = [];

  for (let i = 0; i < count; i++) {
    const className = CLASSES[Math.floor(Math.random() * CLASSES.length)];
    const availableImages = classImages[className];
    const filename = availableImages[Math.floor(Math.random() * availableImages.length)];

    // Load image to get dimensions
    const imagePath = path.join(__dirname, 'images', filename);
    const metadata = sharp(imagePath).metadata();

    // Random size between 80-200px
    const targetSize = Math.floor(Math.random() * 120) + 80;

    // Try to find non-overlapping position
    const position = findNonOverlappingPosition(targetSize, targetSize, existingBoxes);

    if (position) {
      selected.push({
        filename,
        className,
        ...position
      });
      existingBoxes.push(position);
    }
  }

  return selected;
}

// Create fixed composition for testing
function createFixedComposition(classImages) {
  const selected = [];
  const existingBoxes = [];

  // Fixed composition: 1 potato, 2 tatertots, 1 fries
  const composition = [
    { className: 'potato', size: 120 },
    { className: 'tatertot', size: 100 },
    { className: 'tatertot', size: 90 },
    { className: 'fries', size: 110 }
  ];

  for (const spec of composition) {
    const availableImages = classImages[spec.className];
    const filename = availableImages[0]; // Use first image for consistency

    const position = findNonOverlappingPosition(spec.size, spec.size, existingBoxes);

    if (position) {
      selected.push({
        filename,
        className: spec.className,
        ...position
      });
      existingBoxes.push(position);
    }
  }

  return selected;
}

// Main dataset generation
async function generateDatasets() {
  console.log('Generating sample datasets...\n');

  const classImages = getClassImages();
  console.log('Available images:');
  console.log(`  potato: ${classImages.potato.length}`);
  console.log(`  tatertot: ${classImages.tatertot.length}`);
  console.log(`  fries: ${classImages.fries.length}\n`);

  // Dataset 1: YOLO with classes.txt, 3 images (first one fixed composition)
  console.log('Creating Dataset 1: YOLO format with classes.txt, 3 images...');
  const yoloDir = path.join(__dirname, 'datasets', 'yolo');
  fs.mkdirSync(yoloDir, { recursive: true });

  // First image: fixed composition (1 potato, 2 tatertots, 1 fries)
  const fixedObjects1 = createFixedComposition(classImages);
  const { imageBuffer: fixedBuffer1, boxes: fixedBoxes1 } = await createAnnotatedImage(fixedObjects1);
  fs.writeFileSync(path.join(yoloDir, 'image_0.jpg'), fixedBuffer1);
  fs.writeFileSync(path.join(yoloDir, 'image_0.txt'), generateYOLO(fixedBoxes1));
  console.log(`  Generated image_0.jpg with ${fixedBoxes1.length} annotations (fixed: 1 potato, 2 tatertots, 1 fries)`);

  // Remaining images: random
  for (let i = 1; i < 3; i++) {
    const imageCount = Math.floor(Math.random() * 8) + 3;
    const objects = selectRandomImages(classImages, imageCount);
    const { imageBuffer, boxes } = await createAnnotatedImage(objects);

    const imageName = `image_${i}.jpg`;
    const labelName = `image_${i}.txt`;

    fs.writeFileSync(path.join(yoloDir, imageName), imageBuffer);
    fs.writeFileSync(path.join(yoloDir, labelName), generateYOLO(boxes));
    console.log(`  Generated ${imageName} with ${boxes.length} annotations`);
  }

  fs.writeFileSync(path.join(yoloDir, 'classes.txt'), CLASSES.join('\n') + '\n');
  console.log('  Generated classes.txt\n');

  // Dataset 2: YOLO without classes.txt, 1 image
  console.log('Creating Dataset 2: YOLO format without classes.txt, 1 image...');
  const yoloNoClassesDir = path.join(__dirname, 'datasets', 'yolo-no-classes');
  fs.mkdirSync(yoloNoClassesDir, { recursive: true });

  const imageCount2 = Math.floor(Math.random() * 8) + 3;
  const objects2 = selectRandomImages(classImages, imageCount2);
  const { imageBuffer: imageBuffer2, boxes: boxes2 } = await createAnnotatedImage(objects2);

  fs.writeFileSync(path.join(yoloNoClassesDir, 'image_0.jpg'), imageBuffer2);
  fs.writeFileSync(path.join(yoloNoClassesDir, 'image_0.txt'), generateYOLO(boxes2));
  console.log(`  Generated image_0.jpg with ${boxes2.length} annotations (no classes.txt)\n`);

  // Dataset 3: COCO format, 3 images (first one fixed composition)
  console.log('Creating Dataset 3: COCO format, 3 images...');
  const cocoDir = path.join(__dirname, 'datasets', 'coco');
  fs.mkdirSync(cocoDir, { recursive: true });

  const allBoxes3 = [];
  const imageFiles3 = [];

  // First image: fixed composition
  const fixedObjects3 = createFixedComposition(classImages);
  const { imageBuffer: fixedBuffer3, boxes: fixedBoxes3 } = await createAnnotatedImage(fixedObjects3);
  fs.writeFileSync(path.join(cocoDir, 'image_0.jpg'), fixedBuffer3);
  imageFiles3.push('image_0.jpg');
  allBoxes3.push(fixedBoxes3);
  console.log(`  Generated image_0.jpg with ${fixedBoxes3.length} annotations (fixed: 1 potato, 2 tatertots, 1 fries)`);

  // Remaining images: random
  for (let i = 1; i < 3; i++) {
    const imageCount = Math.floor(Math.random() * 8) + 3;
    const objects = selectRandomImages(classImages, imageCount);
    const { imageBuffer, boxes } = await createAnnotatedImage(objects);

    const imageName = `image_${i}.jpg`;
    fs.writeFileSync(path.join(cocoDir, imageName), imageBuffer);
    imageFiles3.push(imageName);
    allBoxes3.push(boxes);
    console.log(`  Generated ${imageName} with ${boxes.length} annotations`);
  }

  const coco3 = generateCOCO(imageFiles3, allBoxes3);
  fs.writeFileSync(path.join(cocoDir, '_annotations.coco.json'), JSON.stringify(coco3, null, 2));
  console.log('  Generated _annotations.coco.json\n');

  console.log('✓ All datasets generated successfully!');
}

// Run
generateDatasets().catch(console.error);
