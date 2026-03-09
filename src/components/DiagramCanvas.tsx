import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import rough from "roughjs";
import type { DiagramData, DiagramNode } from "@/types/diagram";

interface DiagramCanvasProps {
  data: DiagramData | null;
  isLoading: boolean;
  colorPalette: string[];
}

export interface DiagramCanvasHandle {
  exportSvg: () => string | null;
}

function getNodeCenter(node: DiagramNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

const DiagramCanvas = forwardRef<DiagramCanvasHandle, DiagramCanvasProps>(
  ({ data, isLoading, colorPalette }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const svgContainerRef = useRef<HTMLDivElement>(null);

    const drawNode = useCallback(
      (rc: ReturnType<typeof rough.canvas>, ctx: CanvasRenderingContext2D, node: DiagramNode, i: number) => {
        const color = node.color || colorPalette[i % colorPalette.length];
        const opts = { fill: color, fillStyle: "solid" as const, fillWeight: 1, roughness: 1.5, stroke: "#333", strokeWidth: 1.5 };

        switch (node.type) {
          case "ellipse":
          case "circle":
            rc.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width, node.height, opts);
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

        // Label with word wrap
        ctx.font = "bold 16px 'Caveat', cursive";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const centerX = node.x + node.width / 2;
        const centerY = node.y + node.height / 2;
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

        const lineHeight = 20;
        const totalHeight = lines.length * lineHeight;
        const startY = centerY - totalHeight / 2 + lineHeight / 2;
        lines.forEach((line, idx) => ctx.fillText(line, centerX, startY + idx * lineHeight));
      },
      [colorPalette]
    );

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

      // Connections
      data.connections.forEach((conn) => {
        const fromNode = data.nodes.find((n) => n.id === conn.from);
        const toNode = data.nodes.find((n) => n.id === conn.to);
        if (!fromNode || !toNode) return;

        const from = getNodeCenter(fromNode);
        const to = getNodeCenter(toNode);

        rc.line(from.x, from.y, to.x, to.y, { stroke: "#666", strokeWidth: 1.5, roughness: 1.2 });

        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = 12;
        const edgeX = to.x - Math.cos(angle) * (toNode.width / 2 + 4);
        const edgeY = to.y - Math.sin(angle) * (toNode.height / 2 + 4);

        rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle - Math.PI / 6), edgeY - headLen * Math.sin(angle - Math.PI / 6), { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 });
        rc.line(edgeX, edgeY, edgeX - headLen * Math.cos(angle + Math.PI / 6), edgeY - headLen * Math.sin(angle + Math.PI / 6), { stroke: "#666", strokeWidth: 1.5, roughness: 0.5 });

        if (conn.label) {
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          ctx.font = "14px 'Caveat', cursive";
          ctx.fillStyle = "#666";
          ctx.textAlign = "center";
          ctx.fillText(conn.label, midX, midY - 8);
        }
      });

      // Nodes
      data.nodes.forEach((node, i) => drawNode(rc, ctx, node, i));

      // Title
      if (data.title) {
        ctx.font = "bold 28px 'Caveat', cursive";
        ctx.fillStyle = "hsl(220, 20%, 25%)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(data.title, data.width / 2, 16);
      }
    }, [data, drawNode]);

    useEffect(() => {
      draw();
    }, [draw]);

    // SVG export
    useImperativeHandle(
      ref,
      () => ({
        exportSvg: () => {
          if (!data) return null;

          const svgNs = "http://www.w3.org/2000/svg";
          const svgEl = document.createElementNS(svgNs, "svg");
          svgEl.setAttribute("xmlns", svgNs);
          svgEl.setAttribute("width", String(data.width));
          svgEl.setAttribute("height", String(data.height));
          svgEl.setAttribute("viewBox", `0 0 ${data.width} ${data.height}`);

          // Background
          const bg = document.createElementNS(svgNs, "rect");
          bg.setAttribute("width", String(data.width));
          bg.setAttribute("height", String(data.height));
          bg.setAttribute("fill", "#faf7f2");
          svgEl.appendChild(bg);

          const rc = rough.svg(svgEl);

          // Connections
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

            if (conn.label) {
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const text = document.createElementNS(svgNs, "text");
              text.setAttribute("x", String(midX));
              text.setAttribute("y", String(midY - 8));
              text.setAttribute("text-anchor", "middle");
              text.setAttribute("font-family", "'Caveat', cursive");
              text.setAttribute("font-size", "14");
              text.setAttribute("fill", "#666");
              text.textContent = conn.label;
              svgEl.appendChild(text);
            }
          });

          // Nodes
          data.nodes.forEach((node, i) => {
            const color = node.color || colorPalette[i % colorPalette.length];
            const opts = { fill: color, fillStyle: "solid" as const, roughness: 1.5, stroke: "#333", strokeWidth: 1.5 };

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

            // Label
            const text = document.createElementNS(svgNs, "text");
            text.setAttribute("x", String(node.x + node.width / 2));
            text.setAttribute("y", String(node.y + node.height / 2));
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "central");
            text.setAttribute("font-family", "'Caveat', cursive");
            text.setAttribute("font-size", "16");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("fill", "#fff");
            text.textContent = node.label;
            svgEl.appendChild(text);
          });

          // Title
          if (data.title) {
            const text = document.createElementNS(svgNs, "text");
            text.setAttribute("x", String(data.width / 2));
            text.setAttribute("y", "32");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-family", "'Caveat', cursive");
            text.setAttribute("font-size", "28");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("fill", "hsl(220, 20%, 25%)");
            text.textContent = data.title;
            svgEl.appendChild(text);
          }

          return new XMLSerializer().serializeToString(svgEl);
        },
      }),
      [data, colorPalette]
    );

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-muted-foreground font-sketch text-xl">מצייר את הרעיונות שלך...</p>
          </div>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3 max-w-sm">
            <p className="text-3xl font-sketch text-muted-foreground/40">✏️</p>
            <p className="text-lg font-sketch text-muted-foreground/60">הדיאגרמה שלך תופיע כאן</p>
            <p className="text-sm text-muted-foreground/40">כתוב טקסט ולחץ על "ייצור דיאגרמה"</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full overflow-auto p-4">
        <canvas ref={canvasRef} className="max-w-full" />
        <div ref={svgContainerRef} className="hidden" />
      </div>
    );
  }
);

DiagramCanvas.displayName = "DiagramCanvas";

export default DiagramCanvas;
