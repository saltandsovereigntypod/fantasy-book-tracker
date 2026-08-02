import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric'; // For Fabric.js v6

export const CanvasEditor = () => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  useEffect(() => {
    // 1. Initialize the interactive Fabric canvas stage
    if (canvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 500,
        backgroundColor: '#ffffff',
      });
    }

    // 2. Clean up and destroy the canvas instance when component closes
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  // 3. Action function to insert a square element
  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;

    const rect = new fabric.Rect({
      top: 150,
      left: 150,
      width: 100,
      height: 100,
      fill: '#00c4cc', // Canva-inspired teal color
    });

    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect); // Focus bounding box on creation
    fabricCanvasRef.current.renderAll(); // Redraw changes
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      {/* Editing Top Toolbar */}
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={addRectangle}
          style={{ padding: '10px 15px', cursor: 'pointer', background: '#00c4cc', border: 'none', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}
        >
          ➕ Add Rectangle
        </button>
      </div>

      {/* Interactive Stage Border */}
      <div style={{ border: '1px solid #ccc', display: 'inline-block', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
