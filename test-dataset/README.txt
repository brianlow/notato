Sample Test Dataset for notato

This folder contains sample annotation files to test notato.

Note: Image files are not included (would need actual .jpg files).
To test properly, add your own images to the /images folder:
  - sample1.jpg
  - sample2.jpg
  - sample3.jpg

YOLO Format Testing:
  - Use classes.txt and labels/*.txt files
  - Format: <class_id> <center_x> <center_y> <width> <height>
  - Coordinates are normalized (0.0 to 1.0)

COCO Format Testing:
  - Use annotations.json file
  - Format: Standard COCO JSON with images, annotations, categories
  - Coordinates are in pixels

How to Test:
1. Add sample images to /images folder
2. Start HTTP server: python3 -m http.server 8080
3. Open http://localhost:8080/dist/notato.html
4. Click "Open Folder" and select this test-dataset folder
5. Verify annotations load correctly
