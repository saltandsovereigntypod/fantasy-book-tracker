import * as fabric from 'fabric';

export function initCanvasEditor(canvasElementId) {
  // Initialize canvas board
  const canvas = new fabric.Canvas(canvasElementId, {
    width: 800,
    height: 500,
    backgroundColor: '#ffffff',
  });

  // Action function to add a standard canvas shape
  function addRectangle() {
    const rect = new fabric.Rect({
      top: 150,
      left: 150,
      width: 120,
      height: 120,
      fill: '#00c4cc', // Teal layout color
      cornerColor: '#007074',
      cornerSize: 10,
      transparentCorners: false
    });

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  }

  return {
    addRectangle,
    canvasInstance: canvas
  };
}
