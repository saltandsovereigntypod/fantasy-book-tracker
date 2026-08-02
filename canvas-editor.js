import * as fabric from 'fabric';

export function initCanvasEditor(canvasElementId) {
  // 1. Initialize the interactive Fabric canvas stage
  const canvas = new fabric.Canvas(canvasElementId, {
    width: 800,
    height: 550,
    backgroundColor: '#ffffff',
  });

  // 2. Action: Insert a customizable rectangle
  function addRectangle() {
    const rect = new fabric.Rect({
      top: 100,
      left: 100,
      width: 150,
      height: 150,
      fill: '#00c4cc', // Teal canvas fill
      cornerColor: '#007074',
      cornerSize: 8,
      transparentCorners: false
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  }

  // 3. Action: Insert an editable text box
  function addTextBox(textValue = 'Type your theory...') {
    const textBox = new fabric.Textbox(textValue, {
      top: 150,
      left: 150,
      width: 250,
      fontSize: 24,
      fill: '#333333',
      fontFamily: 'sans-serif',
      splitByGrapheme: true // Prevents broken words on wrapping
    });
    canvas.add(textBox);
    canvas.setActiveObject(textBox);
    canvas.renderAll();
  }

  // 4. Action: Import a user-uploaded image file
  function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const imgObj = new Image();
      imgObj.src = event.target.result;
      imgObj.onload = function () {
        const fabricImg = new fabric.Image(imgObj, {
          left: 50,
          top: 50,
          angle: 0,
          opacity: 1
        });
        // Scale down image if it exceeds canvas bounds
        if (fabricImg.width > 400) {
          fabricImg.scaleToWidth(400);
        }
        canvas.add(fabricImg);
        canvas.setActiveObject(fabricImg);
        canvas.renderAll();
      };
    };
    reader.readAsDataURL(file);
  }

  // 5. Action: Delete the currently selected object
  function deleteSelected() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }

  // 6. Action: Set canvas background color
  function setCanvasBackground(colorHex) {
    canvas.set({ backgroundColor: colorHex });
    canvas.renderAll();
  }

  // Export functions for UI hooks
  return {
    addRectangle,
    addTextBox,
    handleImageUpload,
    deleteSelected,
    setCanvasBackground,
    canvasInstance: canvas
  };
}
