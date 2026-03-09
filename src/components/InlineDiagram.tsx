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

    return () => {
      cancelled = true;
    };
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

    if (templateId && templateShapes.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, 70);
      ctx.scale(data.width / 960, (data.height - 120) / 540);

      templateShapes.forEach((shape) => {
        const fill = shape.options?.fill || "hsl(0 0% 78%)";
        const stroke = shape.options?.stroke || fill;

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

    const useTemplateNodeStyle = Boolean(templateId) && templateShapes.length > 0;

    // Connections — only draw when NOT using template style
    if (!useTemplateNodeStyle) {
      data.connections.forEach((conn) => {
        const fromNode = data.nodes.find((n) => n.id === conn.from);
        const toNode = data.nodes.find((n) => n.id === conn.to);
        if (!fromNode || !toNode) return;

        const from = getNodeCenter(fromNode);
        const to = getNodeCenter(toNode);

        rc.line(from.x, from.y, to.x, to.y, {
          stroke: "#666",
          strokeWidth: 1.5,
          roughness: 1.2,
        });

        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = 12;
        const edgeX = to.x - Math.cos(angle) * (toNode.width / 2 + 4);
        const edgeY = to.y - Math.sin(angle) * (toNode.height / 2 + 4);

        rc.line(
          edgeX,
          edgeY,
          edgeX - headLen * Math.cos(angle - Math.PI / 6),
          edgeY - headLen * Math.sin(angle - Math.PI / 6),
          { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 }
        );
        rc.line(
          edgeX,
          edgeY,
          edgeX - headLen * Math.cos(angle + Math.PI / 6),
          edgeY - headLen * Math.sin(angle + Math.PI / 6),
          { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 }
        );

        if (conn.label) {
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          ctx.font = "14px 'Caveat', cursive";
          ctx.fillStyle = "#666";
          ctx.textAlign = "center";
          ctx.fillText(conn.label, midX, midY - 8);
        }
      });
    }

    // Nodes
    data.nodes.forEach((node, i) => {
      const color = node.color || colorPalette[i % colorPalette.length];

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
            rc.ellipse(
              node.x + node.width / 2,
              node.y + node.height / 2,
              node.width,
              node.height,
              opts
            );
            break;
          case "diamond":
            rc.polygon(
              [
                [node.x + node.width / 2, node.y],
                [node.x + node.width, node.y + node.height / 2],
                [node.x + node.width / 2, node.y + node.height],
                [node.x, node.y + node.height / 2],
              ],
              opts
            );
            break;
          default:
            rc.rectangle(node.x, node.y, node.width, node.height, opts);
        }
      }

      // Label
      ctx.font = useTemplateNodeStyle ? "bold 18px 'Caveat', cursive" : "bold 16px 'Caveat', cursive";
      ctx.fillStyle = useTemplateNodeStyle ? "hsl(220, 20%, 20%)" : "#fff";
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

      const lineHeight = 18;
      const totalHeight = lines.length * lineHeight;
      const startY = labelY - totalHeight / 2 + lineHeight / 2;
      lines.forEach((line, idx) =>
        ctx.fillText(line, centerX, startY + idx * lineHeight)
      );
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

      // Draw connections
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

      // Draw nodes
      const useTemplateNodeStyle = Boolean(templateId);

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
            default:
              svgEl.appendChild(rc.rectangle(node.x, node.y, node.width, node.height, opts));
          }
        }

        // Label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(node.x + node.width / 2));
        text.setAttribute("y", String(node.y + node.height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-family", "'Caveat', cursive");
        text.setAttribute("font-size", "16");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", useTemplateNodeStyle ? "hsl(220, 20%, 20%)" : "#fff");
        text.textContent = node.label;
        svgEl.appendChild(text);
      });

      // Title
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
      {/* Source text indicator */}
      {sourceText && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30 text-xs text-muted-foreground" style={{ direction: "rtl" }}>
          <Quote className="w-3 h-3 shrink-0" />
          <span className="truncate">{sourceText}</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 left-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onRegenerate}
          disabled={isRegenerating}
          title="ייצור מחדש"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleDownload("png")}
          title="הורד PNG"
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleDownload("svg")}
          title="הורד SVG"
        >
          <FileDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
          title="העתק"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          title="הסר"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex items-center justify-center overflow-auto p-4 canvas-grid paper-texture">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>
    </motion.div>
  );
};

export default InlineDiagram;
