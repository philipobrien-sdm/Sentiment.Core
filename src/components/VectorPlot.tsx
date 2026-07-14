import React, { useRef, useEffect, useState, useMemo } from "react";
import { CommentItem } from "../types";
import { Maximize2, RotateCcw, Paintbrush, HelpCircle } from "lucide-react";
import { getCommentEmbedding } from "../utils/embeddingsCache";
import { calculateCosineSimilarity } from "./DuplicateReview";

interface VectorPlotProps {
  comments: CommentItem[];
  selectedCommentId: string | null;
  onSelectComment: (id: string) => void;
  colorMode: "sentiment" | "topic";
  setColorMode: (mode: "sentiment" | "topic") => void;
}

export const VectorPlot: React.FC<VectorPlotProps> = ({
  comments,
  selectedCommentId,
  onSelectComment,
  colorMode,
  setColorMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas transform state
  const [zoom, setZoom] = useState<number>(200); // pixels per unit
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [hoveredItem, setHoveredItem] = useState<CommentItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mouse interaction state (refs to prevent re-renders on dragging)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const originalPan = useRef({ x: 0, y: 0 });

  // Memoize topic colors to remain stable
  const topicColorMap = useMemo(() => {
    const topics: string[] = Array.from(new Set<string>(comments.map((c) => c.topic))).sort();
    const colors = [
      "#1A1A1A", // deep charcoal
      "#4A6741", // olive green
      "#A13D2D", // dark red
      "#4F6D7A", // slate blue
      "#D0A352", // muted gold
      "#5E4B56", // eggplant
      "#855E42", // teak brown
      "#7C9082", // sage green
    ];
    const map: Record<string, string> = {};
    topics.forEach((topic, idx) => {
      map[topic] = colors[idx % colors.length];
    });
    return map;
  }, [comments]);

  // Handle Resize using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 300),
        height: Math.max(height, 350),
      });
    });

    observer.observe(container);
    return () => {
      observer.unobserve(container);
    };
  }, []);

  // Helper to map 2D coordinates (x, y) from [-1.2, 1.2] space to canvas pixel space
  const toPixelCoords = (x: number, y: number) => {
    const cx = dimensions.width / 2 + panX + x * zoom;
    const cy = dimensions.height / 2 + panY - y * zoom; // Invert Y for standard math axis
    return { x: cx, y: cy };
  };

  // Helper to map canvas pixel space to 2D math coordinates
  const toMathCoords = (px: number, py: number) => {
    const mx = (px - dimensions.width / 2 - panX) / zoom;
    const my = -(py - dimensions.height / 2 - panY) / zoom;
    return { x: mx, y: my };
  };

  // Calculate the bounds of all active nodes on the map
  const getNodesBounds = () => {
    if (comments.length === 0) {
      return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    comments.forEach((c) => {
      if (c.isArchived) return;
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    });
    
    if (minX === Infinity || maxX === -Infinity) {
      return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    }
    
    // Add small padding to the node limits
    const padding = 0.25;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
  };

  // Keep the viewport center constrained inside the active node boundaries
  const getConstrainedPan = (z: number, px: number, py: number) => {
    const { minX, maxX, minY, maxY } = getNodesBounds();
    
    // centerX = -panX / zoom => -panX = centerX * zoom
    // We want centerX between minX and maxX => -panX between minX * zoom and maxX * zoom
    // => panX between -maxX * zoom and -minX * zoom
    const minPanX = -maxX * z;
    const maxPanX = -minX * z;
    
    // centerY = panY / zoom => panY = centerY * zoom
    // We want centerY between minY and maxY => panY between minY * z and maxY * z
    const minPanY = minY * z;
    const maxPanY = maxY * z;
    
    const constrainedX = Math.max(minPanX, Math.min(maxPanX, px));
    const constrainedY = Math.max(minPanY, Math.min(maxPanY, py));
    
    return { panX: constrainedX, panY: constrainedY };
  };

  // Reset viewport zoom & pan to perfectly center all comments
  const handleResetView = () => {
    if (comments.length === 0) {
      setZoom(200);
      setPanX(0);
      setPanY(0);
      return;
    }

    const { minX, maxX, minY, maxY } = getNodesBounds();

    const viewWidth = maxX - minX;
    const viewHeight = maxY - minY;

    // Calculate ideal zoom
    const zoomX = (dimensions.width * 0.8) / viewWidth;
    const zoomY = (dimensions.height * 0.8) / viewHeight;
    const idealZoom = Math.max(Math.min(zoomX, zoomY, 350), 60);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(idealZoom);
    setPanX(-centerX * idealZoom);
    setPanY(centerY * idealZoom);
  };

  // Trigger auto-fit once when comments are first loaded
  useEffect(() => {
    if (comments.length > 0) {
      handleResetView();
    }
  }, [comments.length]);

  // Color selection helper
  const getColorForItem = (item: CommentItem) => {
    if (item.id === "user_query_node") {
      return "#ec4899"; // Vibrant electric pink for the search query node
    }
    if (colorMode === "sentiment") {
      switch (item.sentiment) {
        case "positive":
          return "#4A6741"; // olive green
        case "negative":
          return "#A13D2D"; // dark terracotta red
        case "neutral":
        default:
          return "#8C867E"; // warm gray
      }
    } else {
      return topicColorMap[item.topic] || "#8C867E";
    }
  };

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and set sizing
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Render background grid lines for professional reference
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;

    // Grid spacing matches zoom levels
    const gridSpacing = zoom > 150 ? 0.25 : zoom > 75 ? 0.5 : 1.0;
    const startX = Math.floor(toMathCoords(0, 0).x / gridSpacing) * gridSpacing;
    const endX = Math.ceil(toMathCoords(dimensions.width, 0).x / gridSpacing) * gridSpacing;
    const startY = Math.floor(toMathCoords(0, dimensions.height).y / gridSpacing) * gridSpacing;
    const endY = Math.ceil(toMathCoords(0, 0).y / gridSpacing) * gridSpacing;

    // Draw grid columns
    for (let x = startX; x <= endX; x += gridSpacing) {
      const p = toPixelCoords(x, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, dimensions.height);
      ctx.stroke();

      // Add small grid axis values for visual style
      if (Math.abs(x) < 0.01) {
        ctx.strokeStyle = "#cbd5e1"; // Darken origin axes
        ctx.stroke();
      }
    }

    // Draw grid rows
    for (let y = startY; y <= endY; y += gridSpacing) {
      const p = toPixelCoords(0, y);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(dimensions.width, p.y);
      ctx.stroke();

      if (Math.abs(y) < 0.01) {
        ctx.strokeStyle = "#cbd5e1"; // Darken origin axes
        ctx.stroke();
      }
    }

    // Restoring border lines
    ctx.strokeStyle = "#e2e8f0";

    // Draw similarity link lines between duplicates and their parent originals
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    
    comments.forEach((item) => {
      if (item.isArchived || !item.isDuplicate || !item.duplicateOfId) return;
      const original = comments.find((c) => c.id === item.duplicateOfId);
      if (original && !original.isArchived) {
        const pA = toPixelCoords(item.x, item.y);
        const pB = toPixelCoords(original.x, original.y);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]); // Reset line style

    // Draw active connections/highlight for selected item
    if (selectedCommentId) {
      const selected = comments.find((c) => c.id === selectedCommentId);
      if (selected && !selected.isArchived) {
        const pSel = toPixelCoords(selected.x, selected.y);
        
        // Pulse ring around selection
        const time = Date.now() / 250;
        const ringRadius = 14 + Math.sin(time) * 3;
        ctx.strokeStyle = "rgba(79, 70, 229, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pSel.x, pSel.y, ringRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Connect lines from selection to its duplicates
        ctx.strokeStyle = "rgba(79, 70, 229, 0.15)";
        ctx.lineWidth = 1;
        comments.forEach((item) => {
          if (item.isArchived) return;
          if (item.duplicateOfId === selected.id || selected.duplicateOfId === item.id) {
            const pOther = toPixelCoords(item.x, item.y);
            ctx.beginPath();
            ctx.moveTo(pSel.x, pSel.y);
            ctx.lineTo(pOther.x, pOther.y);
            ctx.stroke();
          }
        });

        // Special case: If user_query_node is selected, draw lines to its top 5 nearest neighbors
        if (selected.id === "user_query_node") {
          const queryEmbedding = getCommentEmbedding(selected, true) || getCommentEmbedding(selected, false);
          if (queryEmbedding && queryEmbedding.length > 0) {
            // Find top 5 most similar comments
            const neighbors = comments
              .filter((c) => !c.isArchived && c.id !== "user_query_node")
              .map((c) => {
                const emb = getCommentEmbedding(c, true) || getCommentEmbedding(c, false);
                const similarity = emb ? calculateCosineSimilarity(queryEmbedding, emb) : 0;
                return { item: c, similarity };
              })
              .filter((res) => res.similarity >= 0.3)
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 5);

            // Draw beautiful dotted fuchsia connection lines to the neighbors
            ctx.strokeStyle = "rgba(236, 72, 153, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            neighbors.forEach(({ item: neighborItem, similarity }) => {
              const pNeighbor = toPixelCoords(neighborItem.x, neighborItem.y);
              ctx.beginPath();
              ctx.moveTo(pSel.x, pSel.y);
              ctx.lineTo(pNeighbor.x, pNeighbor.y);
              ctx.stroke();

              // Draw similarity percentage labels
              ctx.fillStyle = "#ec4899";
              ctx.font = "bold 9px monospace";
              ctx.fillText(`${Math.round(similarity * 100)}%`, pNeighbor.x + 8, pNeighbor.y - 4);
            });
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Draw all points
    comments.forEach((item) => {
      if (item.isArchived) return;
      const { x: px, y: py } = toPixelCoords(item.x, item.y);

      // Check if item is selected or hovered
      const isSelected = item.id === selectedCommentId;
      const isHovered = hoveredItem && item.id === hoveredItem.id;
      const isDup = item.isDuplicate;

      // Base circle radius
      let radius = isDup ? 5 : 7;
      const isQueryNode = item.id === "user_query_node";
      if (isQueryNode) radius = 9;
      if (isSelected) radius += 2;
      if (isHovered) radius += 2;

      // Draw point fill
      ctx.fillStyle = getColorForItem(item);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Border style based on item qualities
      if (isQueryNode) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw an outer pulsing concentric ring
        const time = Date.now() / 250;
        const pulseRadius = radius + 4 + Math.sin(time) * 2;
        ctx.strokeStyle = "rgba(236, 72, 153, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, pulseRadius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (isSelected) {
        ctx.strokeStyle = "#4f46e5"; // Indigo-600
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = "#1e293b"; // Slate-800
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isDup) {
        // Red border for unreviewed duplicates
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

  }, [comments, dimensions, zoom, panX, panY, selectedCommentId, hoveredItem, colorMode, topicColorMap]);

  // Mouse move handler for hover checks and panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setMousePos({ x: mx, y: my });

    if (isDragging.current) {
      // Execute panning calculation
      const dx = mx - dragStart.current.x;
      const dy = my - dragStart.current.y;
      
      const targetPanX = originalPan.current.x + dx;
      const targetPanY = originalPan.current.y + dy;
      
      const constrained = getConstrainedPan(zoom, targetPanX, targetPanY);
      setPanX(constrained.panX);
      setPanY(constrained.panY);
    } else {
      // Execute hit testing for hover
      let found: CommentItem | null = null;
      // Loop backwards to favor rendering order (top layer first)
      for (let i = comments.length - 1; i >= 0; i--) {
        const item = comments[i];
        if (item.isArchived) continue;
        const p = toPixelCoords(item.x, item.y);
        const dist = Math.hypot(mx - p.x, my - p.y);

        const isSelected = item.id === selectedCommentId;
        const threshold = isSelected ? 12 : 9;

        if (dist < threshold) {
          found = item;
          break;
        }
      }
      setHoveredItem(found);
    }
  };

  // Mouse down - start pan drag or select point
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left-click
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (hoveredItem) {
      // Clicked on an item! Select it.
      onSelectComment(hoveredItem.id);
    } else {
      // Clicked on background, start panning
      isDragging.current = true;
      dragStart.current = { x: mx, y: my };
      originalPan.current = { x: panX, y: panY };
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setHoveredItem(null);
  };

  // Zoom on wheel scroll
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Get current math coords under cursor
    const mathUnderMouse = toMathCoords(mx, my);

    // Calculate new zoom level
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(Math.min(zoom * zoomFactor, 1200), 40);

    // Adjust pan to keep same math point under cursor
    const newPanX = mx - dimensions.width / 2 - mathUnderMouse.x * newZoom;
    const newPanY = dimensions.height / 2 - my + mathUnderMouse.y * newZoom;

    const constrained = getConstrainedPan(newZoom, newPanX, newPanY);
    setZoom(newZoom);
    setPanX(constrained.panX);
    setPanY(constrained.panY);
  };

  return (
    <div id="vector_plot_card" className="flex flex-col bg-white border border-[#E5E3DF] rounded-none overflow-hidden h-full animate-in fade-in duration-300">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-[#E5E3DF] gap-4">
        <div className="flex items-center gap-3">
          <Paintbrush className="w-4 h-4 text-[#1A1A1A]" />
          <h2 className="font-serif italic text-base text-[#1A1A1A]">
            Similarity Mapping Space
          </h2>
          <span className="text-[9px] font-mono border border-[#E5E3DF] text-gray-500 bg-[#F9F8F6] px-2 py-0.5 rounded-none uppercase tracking-wider">
            t-SNE Embedding Projections
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Color Mode */}
          <div className="flex bg-[#F9F8F6] p-1 border border-[#E5E3DF] text-xs rounded-none">
            <button
              onClick={() => setColorMode("sentiment")}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold transition-all rounded-none cursor-pointer ${
                colorMode === "sentiment"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              Sentiment
            </button>
            <button
              onClick={() => setColorMode("topic")}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold transition-all rounded-none cursor-pointer ${
                colorMode === "topic"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              Topic
            </button>
          </div>

          {/* Reset View */}
          <button
            onClick={handleResetView}
            title="Recenter Map Viewport"
            className="p-2 text-[#1A1A1A] hover:bg-[#F9F8F6] border border-[#E5E3DF] rounded-none transition-colors bg-white flex items-center justify-center cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-[#F9F8F6] cursor-grab active:cursor-grabbing overflow-hidden select-none min-h-[380px]"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="block"
        />

        {/* Dynamic Hover Tooltip inside canvas container */}
        {hoveredItem && (
          <div
            className="absolute z-20 pointer-events-none bg-white text-[#1A1A1A] p-4 rounded-none shadow-md border border-[#1A1A1A] transition-all duration-75 max-w-xs"
            style={{
              left: `${mousePos.x + 15}px`,
              top: `${mousePos.y + 15}px`,
            }}
          >
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="font-semibold text-gray-500 uppercase tracking-widest text-[9px]">
                {hoveredItem.topic}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-none text-[9px] font-mono border uppercase tracking-wider ${
                  hoveredItem.sentiment === "positive"
                    ? "bg-[#4A6741]/10 text-[#4A6741] border-[#4A6741]/20"
                    : hoveredItem.sentiment === "negative"
                    ? "bg-[#A13D2D]/10 text-[#A13D2D] border-[#A13D2D]/20"
                    : "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                {hoveredItem.sentiment}
              </span>
            </div>
            <p className="text-[#1A1A1A] leading-relaxed mb-2 font-serif italic text-xs">
              "{hoveredItem.text.length > 120 ? hoveredItem.text.substring(0, 117) + "..." : hoveredItem.text}"
            </p>
            {hoveredItem.isDuplicate && (
              <div className="pt-2 border-t border-[#E5E3DF] text-[9px] text-[#A13D2D] uppercase tracking-wider font-semibold">
                ⚠️ Duplicate Flag ({((hoveredItem.similarityScore || 0) * 100).toFixed(0)}%)
              </div>
            )}
            <div className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">
              Click to inspect details
            </div>
          </div>
        )}

        {/* Visual Help overlay */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-4 text-[9px] uppercase tracking-wider text-gray-500 bg-white/95 px-3 py-2 border border-[#E5E3DF] rounded-none pointer-events-none shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4A6741]" /> Positive
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#8C867E]" /> Neutral
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#A13D2D]" /> Negative
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 border border-[#A13D2D] bg-[#F9F8F6]" /> Duplicate Flag
          </div>
          {comments.some(c => c.id === "user_query_node") && (
            <div className="flex items-center gap-1.5 font-bold text-[#ec4899]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ec4899] shadow-[0_0_4px_#ec4899]" /> 🔍 Search Query Node
            </div>
          )}
          <span className="text-gray-300">|</span>
          <span>🖱️ Drag to Pan</span>
          <span>⚙️ Scroll to Zoom</span>
        </div>
      </div>
    </div>
  );
};
