import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { colorThemes, type ColorTheme } from "@/components/ColorThemePicker";
import ColorThemePicker from "@/components/ColorThemePicker";
import TemplateSelector, { type Template } from "@/components/TemplateSelector";
import AiAutoToggle from "@/components/AiAutoToggle";
import RenderStyleToggle, { type RenderStyle } from "@/components/RenderStyleToggle";
import InlineEditor from "@/components/InlineEditor";
import {
  diagramTemplates,
  type DiagramTemplateId,
} from "@/data/diagramTemplates";

const Index = () => {
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(colorThemes[0]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<DiagramTemplateId>(
    diagramTemplates[0].id
  );
  const [aiAuto, setAiAuto] = useState(true);
  const [renderStyle, setRenderStyle] = useState<RenderStyle>("sketch");
  const editorRef = useRef<{ insertText: (text: string) => void }>(null);

  const handleSelectColorTheme = useCallback((theme: ColorTheme) => {
    setSelectedTheme(theme);
    toast.success(`ערכת צבעים "${theme.name}" נבחרה`);
  }, []);

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplateId(template.id);
    toast.success(`תבנית "${template.name}" נטענה`);
  }, []);

  const handleAiSuggestTemplate = useCallback((templateId: DiagramTemplateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = diagramTemplates.find(t => t.id === templateId);
    if (tmpl) {
      toast.info(`🤖 הבינה בחרה תבנית "${tmpl.name}"`);
    }
  }, []);

  const handleAiSuggestColorTheme = useCallback((themeId: string) => {
    const theme = colorThemes.find(t => t.id === themeId);
    if (theme) {
      setSelectedTheme(theme);
      toast.info(`🎨 הבינה בחרה ערכת צבעים "${theme.name}"`);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold font-sketch tracking-wide">OpenNapkinAI</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RenderStyleToggle style={renderStyle} onStyleChange={setRenderStyle} />
            <AiAutoToggle aiAuto={aiAuto} onToggle={setAiAuto} />
            {!aiAuto && renderStyle === "sketch" && (
              <>
                <TemplateSelector
                  selectedTemplateId={selectedTemplateId}
                  onSelect={handleSelectTemplate}
                />
                <ColorThemePicker
                  selectedTheme={selectedTheme.id}
                  onSelect={handleSelectColorTheme}
                />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            {renderStyle === "professional"
              ? "כתוב טקסט, סמן חלק ממנו, ולחץ על \"צור אינפוגרפיקה\" ליצירת ויזואליזציה מקצועית ✨"
              : "כתוב טקסט, סמן חלק ממנו, ולחץ על \"צור דיאגרמה\" כדי להפוך אותו לויזואליזציה ✨"}
          </p>
        </div>
        <InlineEditor
          ref={editorRef}
          colorPalette={selectedTheme.colors}
          selectedTemplateId={selectedTemplateId}
          aiAuto={aiAuto}
          renderStyle={renderStyle}
          onAiSuggestTemplate={handleAiSuggestTemplate}
          onAiSuggestColorTheme={handleAiSuggestColorTheme}
        />
      </div>
    </div>
  );
};

export default Index;
