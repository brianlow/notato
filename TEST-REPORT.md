# notato Test Report

**Date:** 2025-11-02
**Version:** 1.0.0
**Build:** dist/notato.html (102 KB)

## Automated Tests

### ✓ Build Process
- [x] All source files compiled successfully
- [x] CSS embedded correctly
- [x] JavaScript modules bundled in correct order
- [x] Single HTML file generated (103,746 bytes)
- [x] No build errors or warnings

### ✓ Syntax Validation
- [x] YOLOHandler.js - Valid JavaScript syntax
- [x] COCOHandler.js - Valid JavaScript syntax
- [x] AnnotationStore.js - Valid JavaScript syntax
- [x] FileManager.js - Valid JavaScript syntax
- [x] ImageCanvas.js - Valid JavaScript syntax
- [x] BoxEditor.js - Valid JavaScript syntax
- [x] UIController.js - Valid JavaScript syntax
- [x] main.js - Valid JavaScript syntax

### ✓ HTTP Server
- [x] Application serves correctly on HTTP
- [x] Returns 200 OK status
- [x] Correct Content-Type (text/html)
- [x] File size matches expected

### ✓ File Structure
- [x] Valid HTML5 structure
- [x] All CSS embedded in <style> tag
- [x] All JavaScript embedded in <script> tag
- [x] No external dependencies
- [x] Proper DOCTYPE and meta tags
- [x] Complete closing tags

## Manual Testing Checklist

To fully test the application, perform these steps in a browser:

### Initial Load
- [ ] Open http://localhost:8080/dist/notato.html
- [ ] Verify page loads without console errors
- [ ] Verify UI renders correctly (sidebar + canvas area)
- [ ] Verify "notato" branding appears
- [ ] Verify default YOLO format is selected

### Format Selection
- [ ] Click COCO radio button
- [ ] Verify format changes to COCO
- [ ] Click YOLO radio button
- [ ] Verify format changes back to YOLO

### Folder Loading (requires test dataset)
- [ ] Click "Open Folder" button
- [ ] Select a folder with images
- [ ] Verify images appear in file list
- [ ] Verify thumbnails display
- [ ] Verify file count is correct
- [ ] Verify folder path displays

### Image Display
- [ ] Click on an image in the file list
- [ ] Verify image loads in canvas
- [ ] Verify image dimensions shown in toolbar
- [ ] Verify image fits to screen by default
- [ ] Verify no distortion

### Zoom Controls
- [ ] Click zoom in (+) button - verify zoom increases
- [ ] Click zoom out (-) button - verify zoom decreases
- [ ] Verify zoom level updates (e.g., "150%")
- [ ] Click fit to screen button - verify image fits
- [ ] Use mouse wheel - verify zoom at cursor position
- [ ] Press + key - verify zoom in
- [ ] Press - key - verify zoom out
- [ ] Press 0 key - verify fit to screen

### Pan Controls
- [ ] Zoom in past 100%
- [ ] Click and drag on image - verify panning
- [ ] Hold Space + drag - verify panning
- [ ] Verify pan works smoothly

### Box Creation
- [ ] Click and drag on image
- [ ] Verify preview box appears during drag
- [ ] Release mouse - verify box is created
- [ ] Verify box has correct color
- [ ] Verify box has label
- [ ] Verify annotation count increments
- [ ] Verify save button highlights (unsaved changes)

### Box Selection
- [ ] Click on a box
- [ ] Verify box becomes selected (different styling)
- [ ] Verify 8 resize handles appear
- [ ] Click elsewhere - verify deselection
- [ ] Press Escape - verify deselection

### Box Resizing
- [ ] Select a box
- [ ] Drag corner handle - verify resize from corner
- [ ] Drag edge handle - verify resize from edge
- [ ] Verify opposite side stays anchored
- [ ] Verify box constrained to image bounds
- [ ] Verify minimum size enforced

### Box Moving
- [ ] Select a box
- [ ] Drag box interior (not handles)
- [ ] Verify box moves
- [ ] Verify box maintains size
- [ ] Verify constrained to image bounds

### Box Deletion
- [ ] Select a box
- [ ] Press Delete key - verify box deleted
- [ ] Verify annotation count decrements
- [ ] Undo unavailable (v1.0 limitation)

### Class Management
- [ ] Click "Add Class" button
- [ ] Enter class name in modal
- [ ] Click "Add" - verify class appears
- [ ] Verify class appears in dropdown
- [ ] Verify class appears in class list
- [ ] Verify class has unique color
- [ ] Select different class from dropdown
- [ ] Create new box - verify uses selected class
- [ ] Select existing box - verify can change class

### Saving (YOLO)
- [ ] Select YOLO format
- [ ] Load folder with images
- [ ] Create some boxes
- [ ] Click Save button
- [ ] Verify .txt file created/updated
- [ ] Verify save button no longer highlighted
- [ ] Open .txt file - verify YOLO format correct
- [ ] Verify normalized coordinates (0.0-1.0)
- [ ] Verify classes.txt created if needed

### Saving (COCO)
- [ ] Select COCO format
- [ ] Load folder with images
- [ ] Create some boxes
- [ ] Click Save button
- [ ] Verify annotations.json created/updated
- [ ] Open JSON - verify COCO format correct
- [ ] Verify images array populated
- [ ] Verify annotations array populated
- [ ] Verify categories array populated

### Loading Existing Annotations (YOLO)
- [ ] Open folder with existing .txt files
- [ ] Verify boxes load correctly
- [ ] Verify box positions match annotations
- [ ] Verify classes load from classes.txt
- [ ] Verify classes inferred if classes.txt missing

### Loading Existing Annotations (COCO)
- [ ] Open folder with annotations.json
- [ ] Verify boxes load correctly
- [ ] Verify categories load correctly
- [ ] Verify all images have correct annotations

### Navigation
- [ ] Load multiple images
- [ ] Press Right Arrow - verify next image loads
- [ ] Press Left Arrow - verify previous image loads
- [ ] Click different thumbnail - verify image loads
- [ ] Verify unsaved changes warning (future feature)

### Keyboard Shortcuts
- [ ] Press ? - verify shortcuts modal appears
- [ ] Press H - verify boxes toggle hide/show
- [ ] Press Ctrl+S - verify save triggered
- [ ] Press Escape - verify modal closes / deselect
- [ ] Press Delete - verify selected box deleted
- [ ] Verify all shortcuts listed work

### UI Elements
- [ ] Verify cursor position updates in status bar
- [ ] Verify crosshair cursor on canvas
- [ ] Verify cursor changes on hover (handles, boxes)
- [ ] Verify status messages update
- [ ] Verify toast notifications appear
- [ ] Verify modal dialogs work
- [ ] Verify file search/filter works

### Edge Cases
- [ ] Load empty folder - verify appropriate message
- [ ] Load folder with no images - verify message
- [ ] Create very small box - verify minimum size
- [ ] Create box at image edge - verify constraining
- [ ] Zoom to extreme levels - verify still works
- [ ] Load very large image - verify performance
- [ ] Load image with special characters in name
- [ ] Save with 0 boxes - verify allowed
- [ ] Switch images with unsaved changes

### Browser Compatibility
- [ ] Test in Chrome (latest)
- [ ] Test in Edge (latest)
- [ ] Test in Firefox (latest) - note: drag-drop fallback
- [ ] Test in Safari (latest) - note: drag-drop fallback
- [ ] Verify File System Access API message in unsupported browsers

## Known Limitations (v1.0)

As per specification:
- No undo/redo functionality
- No polygon/segmentation annotation
- No multi-user collaboration
- No cloud storage
- No image processing features
- Firefox/Safari: Requires drag-drop (File System Access API not available)

## Test Results Summary

### Automated Tests: ✓ PASS
All automated tests passed successfully:
- Build process: OK
- Syntax validation: OK
- HTTP serving: OK
- File structure: OK

### Manual Tests: ⏳ PENDING
Manual testing requires:
1. Running in a browser with File System Access API support (Chrome/Edge)
2. Test dataset with sample images
3. Interactive user testing

## Recommendations for Testing

1. **Create Test Dataset:**
   ```
   /test-dataset
     /images
       image1.jpg
       image2.jpg
       image3.jpg
     /labels  (for YOLO)
       image1.txt
     annotations.json  (for COCO)
     classes.txt
   ```

2. **Use Chrome or Edge** (latest version) for full functionality

3. **Test Both Formats:**
   - YOLO: Test with existing .txt files and classes.txt
   - COCO: Test with existing annotations.json

4. **Test Workflows:**
   - New annotation from scratch
   - Editing existing annotations
   - Mixed: some images annotated, some not

## Test Environment

- **Node.js:** Available for build
- **HTTP Server:** Python http.server on port 8080
- **Browser:** Not available in current environment (CLI only)

## Conclusion

✓ **Build and syntax validation:** PASSED
⏳ **Browser testing:** Requires manual testing in browser environment
📋 **Ready for:** User acceptance testing in Chrome/Edge browser

The application successfully builds and passes all automated checks. Full functionality testing requires opening in a browser with File System Access API support.
