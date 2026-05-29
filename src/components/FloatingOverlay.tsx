import React, { useState, useRef, useEffect } from "react";
import { Circle, Square, Maximize2 } from "lucide-react";
import { Participant } from "../store/useRoomStore";

const pastelColors = [
  "bg-block-lime",
  "bg-block-lilac",
  "bg-block-cream",
  "bg-block-pink",
  "bg-block-mint",
  "bg-block-coral"
];

const getColorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % pastelColors.length;
  return pastelColors[index];
};

interface FloatingOverlayProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  stageBounds: DOMRect | null;
}

export const FloatingOverlay: React.FC<FloatingOverlayProps> = ({
  participant,
  stream,
  isLocal,
  stageBounds
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Custom drag and resize local state (coordinates in pixels)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 220, height: 165 }); // default landscape 4:3
  const [shape, setShape] = useState<"square" | "circle">("square");
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  
  const resizeStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  // Stream render - always keep video srcObject in sync
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    
    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    } else {
      videoEl.srcObject = null;
    }
    
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream]);

  // Adjust aspect-ratio and size parameters based on shape
  const prevShapeRef = useRef(shape);
  useEffect(() => {
    if (prevShapeRef.current === shape) return;
    prevShapeRef.current = shape;
    
    if (shape === "circle") {
      // Force perfect 1:1 circle sizing
      const squareSize = Math.max(size.width, size.height);
      setSize({ width: squareSize, height: squareSize });
    } else {
      // Restore standard landscape 4:3 size
      setSize({ width: size.width, height: Math.round(size.width * 0.75) });
    }
  }, [shape]);

  // Initialize position once when stageBounds become available
  useEffect(() => {
    if (position !== null) return; // Already initialized
    if (!stageBounds) return;
    
    // Spread participants across the stage with some randomness
    const hash = participant.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const maxX = Math.max(10, stageBounds.width - size.width - 20);
    const maxY = Math.max(10, stageBounds.height - size.height - 20);
    const initialX = 20 + (hash % Math.max(1, maxX - 20));
    const initialY = 20 + ((hash * 7) % Math.max(1, maxY - 20));
    
    setPosition({ x: initialX, y: initialY });
  }, [stageBounds, position, participant.id, size.width, size.height]);

  // Global Drag listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      
      let nextX = positionStart.current.x + deltaX;
      let nextY = positionStart.current.y + deltaY;

      // Clamp coordinates within the stage container
      if (stageBounds) {
        nextX = Math.max(10, Math.min(nextX, stageBounds.width - size.width - 10));
        nextY = Math.max(10, Math.min(nextY, stageBounds.height - size.height - 10));
      } else {
        nextX = Math.max(10, nextX);
        nextY = Math.max(10, nextY);
      }

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, size, stageBounds]);

  // Global Resize listeners
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;

      let nextWidth = sizeStart.current.width + deltaX;
      let nextHeight = sizeStart.current.height + deltaY;

      // Clamp size (100px min, 400px max)
      nextWidth = Math.max(100, Math.min(nextWidth, 400));
      nextHeight = Math.max(100, Math.min(nextHeight, 400));

      if (shape === "circle") {
        // Enforce circle 1:1 ratio
        const uniform = Math.max(nextWidth, nextHeight);
        setSize({ width: uniform, height: uniform });
      } else {
        // Maintain 4:3 landscape ratio
        setSize({ width: nextWidth, height: Math.round(nextWidth * 0.75) });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, shape]);

  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag with left clicks and prevent dragging on controls
    if (e.button !== 0 || (e.target as HTMLElement).closest(".control-btn")) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { x: pos.x, y: pos.y };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { width: size.width, height: size.height };
  };

  const initials = participant.nickname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isVideoOn = participant.camera_on;
  const bgClass = getColorForName(participant.nickname);

  // Default position if not yet initialized
  const pos = position || { x: 40, y: 40 };

  return (
    <div
      onMouseDown={handleDragStart}
      style={{
        position: "absolute",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: isDragging || isResizing ? 90 : 70,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className={`group select-none flex flex-col items-center justify-center transition-shadow duration-200 overflow-hidden ${
        shape === "circle" 
          ? "rounded-full aspect-square border-2 border-ink bg-canvas shadow-soft" 
          : "rounded-md aspect-video border-2 border-ink bg-canvas shadow-soft hover:bg-zinc-50"
      }`}
    >
      
      {/* A. Hover overlay utility controls (Sleek glassmorphic overlay tool bar) */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 ${
          shape === "circle" ? "rounded-full" : "rounded-md"
        } bg-black/40 backdrop-blur-[1px]`}
      >
        {/* Top bar: Shapes togglers & nickname info */}
        <div className="flex items-center justify-between w-full">
          <span className="text-[9px] font-bold text-ink bg-canvas border border-ink px-2 py-0.5 rounded-sm truncate max-w-[55%] font-mono uppercase tracking-wider">
            {participant.nickname} {isLocal && "(You)"}
          </span>
          
          <div className="flex items-center space-x-1 bg-canvas border border-ink p-0.5 rounded-md control-btn">
            <button
              onClick={(e) => { e.stopPropagation(); setShape("circle"); }}
              className={`p-1 rounded cursor-pointer text-zinc-550 hover:text-ink transition-colors ${
                shape === "circle" ? "bg-block-lime text-ink" : ""
              }`}
              title="Circle Badge"
            >
              <Circle className="w-2.5 h-2.5 fill-current" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShape("square"); }}
              className={`p-1 rounded cursor-pointer text-zinc-550 hover:text-ink transition-colors ${
                shape === "square" ? "bg-block-lime text-ink" : ""
              }`}
              title="Landscape Card"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Bottom bar: Nickname fallback overlay for circles */}
        <div className="flex justify-end w-full">
          {/* Resize dragging handle corner anchor */}
          <div
            onMouseDown={handleResizeStart}
            className="w-4 h-4 flex items-center justify-center bg-canvas border border-ink hover:bg-surface-soft text-ink rounded cursor-se-resize control-btn transition-colors"
            title="Drag to resize viewport"
          >
            <Maximize2 className="w-2.5 h-2.5 rotate-90" />
          </div>
        </div>
      </div>

      {/* B. Stream/Video Display - Always rendered, hidden via CSS */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover pointer-events-none transform scale-x-[-1] ${
          shape === "circle" ? "rounded-full" : "rounded-md"
        } ${
          isVideoOn && stream ? "opacity-100 visible" : "opacity-0 invisible absolute inset-0"
        }`}
      />
      {(!isVideoOn || !stream) && (
        /* Geometric initials avatar fallback: Flat Figma-style pastel block colors */
        <div className="w-full h-full flex items-center justify-center p-2 bg-white">
          <div className={`flex items-center justify-center ${bgClass} text-ink font-bold border border-ink ${
            shape === "circle" 
              ? "w-full h-full rounded-full" 
              : "w-14 h-14 rounded-full"
          } transition-transform duration-300`}>
            <span className={`${shape === "circle" ? "text-lg md:text-xl" : "text-xs md:text-sm"} font-extrabold tracking-wider`}>
              {initials || "CP"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
