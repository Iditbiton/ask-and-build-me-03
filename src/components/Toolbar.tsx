import { Button } from "@/components/ui/button";
import { Sparkles, Download, Copy, RotateCcw, FileImage } from "lucide-react";
import TemplateSelector, { type Template } from "@/components/TemplateSelector";
import ColorThemePicker, { type ColorTheme } from "@/components/ColorThemePicker";
import type { DiagramTemplateId } from "@/data/diagramTemplates";

interface ToolbarProps {
  onGenerate: () => void;
  onExport: () => void;
  onExportSvg: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onSelectTemplate: (template: Template) => void;
  onSelectColorTheme: (theme: ColorTheme) => void;
  selectedColorTheme: string;
  selectedTemplateId?: DiagramTemplateId;
  isLoading: boolean;
  hasResult: boolean;
}

const Toolbar = ({
  onGenerate,
  onExport,
  onExportSvg,
  onCopy,
  onRegenerate,
  onSelectTemplate,
  onSelectColorTheme,
  selectedColorTheme,
  selectedTemplateId = "stacked",
  isLoading,
  hasResult,
}: ToolbarProps) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TemplateSelector selectedTemplateId={selectedTemplateId} onSelect={onSelectTemplate} />
      <ColorThemePicker selectedTheme={selectedColorTheme} onSelect={onSelectColorTheme} />

      <Button
        onClick={onGenerate}
        disabled={isLoading}
        className="gap-2 font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
        size="lg"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? "מייצר..." : "ייצור דיאגרמה"}
      </Button>

      {hasResult && (
        <>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isLoading} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            חדש
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={onExportSvg} className="gap-1.5">
            <FileImage className="w-3.5 h-3.5" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" />
            העתק
          </Button>
        </>
      )}
    </div>
  );
};

export default Toolbar;
