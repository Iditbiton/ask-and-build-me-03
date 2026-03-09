import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { X, RotateCcw, Download, Copy, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AntVDiagramProps {
  svgContent: string;
  sourceText: string;
  isRegenerating: boolean;
  onRemove: () => void;
  onRegenerate: () => void;
}

const AntVDiagram = ({
  svgContent,
  sourceText,
  isRegenerating,
  onRemove,
  onRegenerate,
}: AntVDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = `infographic-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("SVG הורד!");
  }, [svgContent]);

  const handleCopy = useCallback(async () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
            if (blob) {
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
              toast.success("הועתק ללוח!");
            }
          });
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
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
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={handleDownload} title="הורד SVG">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={handleCopy} title="העתק">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={onRemove} title="הסר">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex items-center justify-center p-4 overflow-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ minHeight: "300px" }}
      />
    </motion.div>
  );
};

export default AntVDiagram;
