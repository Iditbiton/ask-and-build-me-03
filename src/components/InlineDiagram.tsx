import { useEffect, useRef, useCallback, useState } from "react";
import rough from "roughjs";
import { motion } from "framer-motion";
import { X, RotateCcw, Download, Copy, Quote, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DiagramData, DiagramNode } from "@/types/diagram";
import type { DiagramTemplateId } from "@/data/diagramTemplates";

interface InlineDiagramProps {
  data: DiagramData;
  colorPalette: string[];
  sourceText: string;
  templateId?: DiagramTemplateId;
  isRegenerating: boolean;
  onRemove: () => void;
  onRegenerate: () => void;
}

type TemplateShape = {
  path: string;
  options?: {
    fill?: string;
    stroke?: string;
  };
};

type TemplateShapeMap = Partial<Record<DiagramTemplateId, TemplateShape[]>>;

let templateShapeCache: TemplateShapeMap | null = null;
let templateShapePromise: Promise<TemplateShapeMap> | null = null;

const loadTemplateShapes = async (): Promise<TemplateShapeMap> => {
  if (templateShapeCache) return templateShapeCache;
  if (!templateShapePromise) {
    templateShapePromise = fetch("/opennapkin-template-shapes.json")
      .then((res) => (res.ok ? res.json() : {}))
      .then((json) => {
        templateShapeCache = json as TemplateShapeMap;
        return templateShapeCache;
      })
      .catch(() => {
        templateShapeCache = {};
        return templateShapeCache;
      });
  }
  return templateShapePromise;
};

function getNodeCenter(node: DiagramNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

const InlineDiagram = ({
  data,
  colorPalette,
  sourceText,
  templateId,
  isRegenerating,
  onRemove,
  onRegenerate,
}: InlineDiagramProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [templateShapes, setTemplateShapes] = useState<TemplateShape[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!templateId) {
      setTemplateShapes([]);
      return;
    }
    loadTemplateShapes().then((allShapes) => {
      if (!cancelled) {
        setTemplateShapes(allShapes[templateId] ?? []);
      }
    });
    return () => { cancelled = true; };
  }, [templateId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = data.width * dpr;
    canvas.height = data.height * dpr;
    canvas.style.width = `${data.width}px`;
    canvas.style.height = `${data.height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, data.width, data.height);

    const rc = rough.canvas(canvas);
    const useTemplateNodeStyle = Boolean(templateId) && templateShapes.length > 0;

    // Draw template background shapes
    if (useTemplateNodeStyle) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.translate(0, 70);
      ctx.scale(data.width / 960, (data.height - 120) / 540);

      templateShapes.forEach((shape, i) => {
        const paletteColor = colorPalette[i % colorPalette.length];
        const fill = paletteColor || shape.options?.fill || "hsl(0 0% 78%)";
        const stroke = paletteColor || shape.options?.stroke || fill;
        rc.path(shape.path, {
          fill,
          stroke,
          strokeWidth: 1,
          roughness: 1.1,
          fillStyle: "solid",
        });
      });
      ctx.restore();
    }

    // Connections — only draw when NOT using template style
    if (!useTemplateNodeStyle) {
      data.connections.forEach((conn) => {
        const fromNode = data.nodes.find((n) => n.id === conn.from);
        const toNode = data.nodes.find((n) => n.id === conn.to);
        if (!fromNode || !toNode) return;

        const from = getNodeCenter(fromNode);
        const to = getNodeCenter(toNode);

        // Draw connection line
        rc.line(from.x, from.y, to.x, to.y, {
          stroke: "#555",
          strokeWidth: 2,
          roughness: 1.0,
        });

        // Arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = 14;
        const edgeX = to.x - Math.cos(angle) * (toNode.width / 2 + 6);
        const edgeY = to.y - Math.sin(angle) * (toNode.height / 2 + 6);

        rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle - Math.PI / 6), edgeY - headLen * Math.sin(angle - Math.PI / 6), { stroke: "#555", strokeWidth: 2, roughness: 0.5 });
        rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle + Math.PI / 6), edgeY - headLen * Math.sin(angle + Math.PI / 6), { stroke: "#555", strokeWidth: 2, roughness: 0.5 });

        // Connection label - draw with background pill for readability
        if (conn.label) {
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          ctx.font = "bold 13px 'Caveat', cursive";
          const labelWidth = ctx.measureText(conn.label).width;
          
          // Background pill
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          const pillPad = 6;
          ctx.roundRect(midX - labelWidth / 2 - pillPad, midY - 12, labelWidth + pillPad * 2, 20, 8);
          ctx.fill();
          ctx.strokeStyle = "#999";
          ctx.lineWidth = 0.5;
          ctx.stroke();
          
          ctx.fillStyle = "#444";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(conn.label, midX, midY);
        }
      });
    }

    // Nodes
    data.nodes.forEach((node, i) => {
      const color = node.color || colorPalette[i % colorPalette.length];
      const isFirst = i === 0;

      // Only draw node shapes when NOT using a template
      if (!useTemplateNodeStyle) {
        const opts = {
          fill: color,
          fillStyle: "solid" as const,
          fillWeight: 1,
          roughness: 1.5,
          stroke: "#333",
          strokeWidth: 1.5,
        };

        switch (node.type) {
          case "ellipse":
          case "circle":
            rc.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width, node.height, opts);
            break;
          case "diamond":
            rc.polygon([
              [node.x + node.width / 2, node.y],
              [node.x + node.width, node.y + node.height / 2],
              [node.x + node.width / 2, node.y + node.height],
              [node.x, node.y + node.height / 2],
            ], opts);
            break;
          case "hexagon": {
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            const rx = node.width / 2;
            const ry = node.height / 2;
            rc.polygon([
              [cx - rx, cy],
              [cx - rx * 0.5, cy - ry],
              [cx + rx * 0.5, cy - ry],
              [cx + rx, cy],
              [cx + rx * 0.5, cy + ry],
              [cx - rx * 0.5, cy + ry],
            ], opts);
            break;
          }
          default:
            rc.rectangle(node.x, node.y, node.width, node.height, opts);
        }
      }

      // Label with visual hierarchy
      const fontSize = useTemplateNodeStyle 
        ? (isFirst ? 22 : 17)
        : (isFirst ? 18 : 15);
      const fontWeight = isFirst ? "bold" : "600";
      
      ctx.font = `${fontWeight} ${fontSize}px 'Caveat', cursive`;
      ctx.fillStyle = useTemplateNodeStyle ? "hsl(220, 20%, 15%)" : "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const centerX = node.x + node.width / 2;
      const labelY = node.y + node.height / 2;
      const words = node.label.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      const maxWidth = node.width - 16;

      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize + 2;
      const totalHeight = lines.length * lineHeight;
      const startY = labelY - totalHeight / 2 + lineHeight / 2;
      
      // Add text shadow for better readability on colored backgrounds
      if (!useTemplateNodeStyle) {
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      }
      
      lines.forEach((line, idx) =>
        ctx.fillText(line, centerX, startY + idx * lineHeight)
      );
      
      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    // Title
    if (data.title) {
      ctx.font = "bold 28px 'Caveat', cursive";
      ctx.fillStyle = "hsl(220, 20%, 25%)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(data.title, data.width / 2, 16);
    }
  }, [data, colorPalette, templateId, templateShapes]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleDownload = useCallback((format: "png" | "svg" = "png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === "svg") {
      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgEl.setAttribute("width", String(data.width));
      svgEl.setAttribute("height", String(data.height));
      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const rc = rough.svg(svgEl);
      const useTemplateNodeStyle = Boolean(templateId);

      data.connections.forEach((conn) => {
        const fromNode = data.nodes.find((n) => n.id === conn.from);
        const toNode = data.nodes.find((n) => n.id === conn.to);
        if (!fromNode || !toNode) return;
        const from = getNodeCenter(fromNode);
        const to = getNodeCenter(toNode);
        svgEl.appendChild(rc.line(from.x, from.y, to.x, to.y, { stroke: "#666", strokeWidth: 1.5, roughness: 1.2 }));
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = 12;
        const edgeX = to.x - Math.cos(angle) * (toNode.width / 2 + 4);
        const edgeY = to.y - Math.sin(angle) * (toNode.height / 2 + 4);
        svgEl.appendChild(rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle - Math.PI / 6), edgeY - headLen * Math.sin(angle - Math.PI / 6), { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 }));
        svgEl.appendChild(rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle + Math.PI / 6), edgeY - headLen * Math.sin(angle + Math.PI / 6), { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 }));
      });

      data.nodes.forEach((node, i) => {
        const color = node.color || colorPalette[i % colorPalette.length];
        const opts = { fill: color, fillStyle: "solid" as const, roughness: 1.5, stroke: "#333", strokeWidth: 1.5 };

        if (!useTemplateNodeStyle) {
          switch (node.type) {
            case "ellipse":
            case "circle":
              svgEl.appendChild(rc.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width, node.height, opts));
              break;
            case "diamond":
              svgEl.appendChild(rc.polygon([[node.x + node.width / 2, node.y], [node.x + node.width, node.y + node.height / 2], [node.x + node.width / 2, node.y + node.height], [node.x, node.y + node.height / 2]], opts));
              break;
            case "hexagon": {
              const cx = node.x + node.width / 2;
              const cy = node.y + node.height / 2;
              const rx = node.width / 2;
              const ry = node.height / 2;
              svgEl.appendChild(rc.polygon([
                [cx - rx, cy],
                [cx - rx * 0.5, cy - ry],
                [cx + rx * 0.5, cy - ry],
                [cx + rx, cy],
                [cx + rx * 0.5, cy + ry],
                [cx - rx * 0.5, cy + ry],
              ], opts));
              break;
            }
            default:
              svgEl.appendChild(rc.rectangle(node.x, node.y, node.width, node.height, opts));
          }
        }

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(node.x + node.width / 2));
        text.setAttribute("y", String(node.y + node.height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-family", "'Caveat', cursive");
        text.setAttribute("font-size", "16");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", useTemplateNodeStyle ? "hsl(220, 20%, 15%)" : "#fff");
        text.textContent = node.label;
        svgEl.appendChild(text);
      });

      if (data.title) {
        const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        titleEl.setAttribute("x", String(data.width / 2));
        titleEl.setAttribute("y", "30");
        titleEl.setAttribute("text-anchor", "middle");
        titleEl.setAttribute("font-family", "'Caveat', cursive");
        titleEl.setAttribute("font-size", "28");
        titleEl.setAttribute("font-weight", "bold");
        titleEl.setAttribute("fill", "hsl(220, 20%, 25%)");
        titleEl.textContent = data.title;
        svgEl.appendChild(titleEl);
      }

      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.download = `diagram-${Date.now()}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("SVG הורד!");
      return;
    }

    const link = document.createElement("a");
    link.download = `diagram-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("התמונה הורדה!");
  }, [data, colorPalette, templateId]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("הועתק ללוח!");
    } catch {
      toast.error("ההעתקה נכשלה.");
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative my-4 mx-2 rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden group"
    >
      {sourceText && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30 text-xs text-muted-foreground" style={{ direction: "rtl" }}>
          <Quote className="w-3 h-3 shrink-0" />
          <span className="truncate">{sourceText}</span>
        </div>
      )}

      <div className="absolute top-2 left-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={onRegenerate} disabled={isRegenerating} title="ייצור מחדש">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => handleDownload("png")} title="הורד PNG">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => handleDownload("svg")} title="הורד SVG">
          <FileDown className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={handleCopy} title="העתק">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={onRemove} title="הסר">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center justify-center overflow-auto p-4 canvas-grid paper-texture">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>
    </motion.div>
  );
};

export default InlineDiagram;
