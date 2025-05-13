import React, { useState } from "react";

interface StackVisualizerProps {
  images: string[];
}

const StackVisualizer: React.FC<StackVisualizerProps> = ({ images }) => {
  const [highlighted, setHighlighted] = useState<number | null>(null);

  return (
    <div>
      <h2>Visual Stack</h2>
      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={`Card ${idx + 1}`}
            onClick={() => setHighlighted(idx)}
            style={{
              border:
                highlighted === idx ? "4px solid #007bff" : "2px solid #333",
              borderRadius: 8,
              marginBottom: -95,
              boxShadow:
                highlighted === idx ? "0 0 10px #007bff" : "0 2px 6px #aaa",
              cursor: "pointer",
              width: 80,
              height: 120,
              background: "#fff",
              zIndex: highlighted === idx ? 1 : 0,
              transition: "border 0.2s, box-shadow 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default StackVisualizer;
