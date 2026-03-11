import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import InlineDiagram from "@/components/InlineDiagram";
import AntVDiagram from "@/components/AntVDiagram";
import GenerationModeToggle, { type GenerationMode } from "@/components/GenerationModeToggle";
import type { DiagramData } from "@/types/diagram";
import { supabase } from "@/integrations/supabase/client";
import type { DiagramTemplateId } from "@/data/diagramTemplates";
import type { RenderStyle } from "@/components/RenderStyleToggle";

export interface DocumentBlock {
  id: string;
  type: "text" | "diagram";
  content: string;
  diagramData?: DiagramData;
  antvSyntax?: string;
  sourceText?: string;
  templateId?: DiagramTemplateId;
  renderStyle?: RenderStyle;
}

interface InlineEditorProps {
  colorPalette: string[];
  selectedTemplateId: DiagramTemplateId;
  aiAuto?: boolean;
  renderStyle?: RenderStyle;
  onAiSuggestTemplate?: (templateId: DiagramTemplateId) => void;
  onAiSuggestColorTheme?: (themeId: string) => void;
}

const InlineEditor = forwardRef<{ insertText: (text: string) => void }, InlineEditorProps>(
  ({ colorPalette, selectedTemplateId, aiAuto = true, renderStyle = "sketch", onAiSuggestTemplate, onAiSuggestColorTheme }, ref) => {
    const [generationMode, setGenerationMode] = useState<GenerationMode>("literal");

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        setBlocks((prev) => {
          const textBlockIndex = prev.findIndex(b => b.type === "text");
          if (textBlockIndex !== -1) {
            return prev.map((b, i) =>
              i === textBlockIndex ? { ...b, content: text } : b
            );
          }
          return [...prev, { id: `text-${Date.now()}`, type: "text", content: text }];
        });
        setTimeout(() => {
          const allEditables = editorRef.current?.querySelectorAll("[data-block-id][contenteditable]");
          if (allEditables && allEditables.length > 0) {
            allEditables[0].textContent = text;
          }
        }, 0);
      },
    }));

    const [blocks, setBlocks] = useState<DocumentBlock[]>([
      { id: "initial", type: "text", content: "" },
    ]);
    const [selectionInfo, setSelectionInfo] = useState<{
      text: string;
      blockId: string;
      rect: DOMRect | null;
    } | null>(null);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const handleTextChange = useCallback((blockId: string, value: string) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, content: value } : b))
      );
    }, []);

    useEffect(() => {
      const handleSelectionChange = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setTimeout(() => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) {
              setSelectionInfo(null);
            }
          }, 200);
          return;
        }

        const selectedText = selection.toString().trim();
        if (selectedText.length < 3) return;

        const range = selection.getRangeAt(0);
        const container = range.startContainer.parentElement;
        const blockEl = container?.closest("[data-block-id]");
        const blockId = blockEl?.getAttribute("data-block-id");

        if (blockId) {
          const rect = range.getBoundingClientRect();
          setSelectionInfo({ text: selectedText, blockId, rect });
        }
      };

      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    const generateDiagram = useCallback(
      async (selectedText: string, afterBlockId: string) => {
        const newDiagramId = `diagram-${Date.now()}`;
        setLoadingBlockId(newDiagramId);

        setBlocks((prev) => {
          const idx = prev.findIndex((b) => b.id === afterBlockId);
          if (idx === -1) return prev;

          const newBlock: DocumentBlock = {
            id: newDiagramId,
            type: "diagram",
            content: "",
            sourceText: selectedText,
            templateId: selectedTemplateId,
            renderStyle,
          };

          const needsTextAfter =
            idx === prev.length - 1 || prev[idx + 1]?.type === "diagram";
          const newBlocks = [...prev];
          const insertItems: DocumentBlock[] = [newBlock];
          if (needsTextAfter) {
            insertItems.push({
              id: `text-${Date.now()}`,
              type: "text",
              content: "",
            });
          }
          newBlocks.splice(idx + 1, 0, ...insertItems);
          return newBlocks;
        });

        setSelectionInfo(null);

        try {
          console.log("[DEBUG] generateDiagram start", { renderStyle, generationMode, aiAuto, selectedTemplateId });
          if (renderStyle === "professional") {
            // Use AntV Infographic generation
            const { data, error } = await supabase.functions.invoke(
              "generate-infographic",
              { body: { text: selectedText } }
            );

            if (error || data?.error) {
              toast.error(data?.error || "שגיאה בייצור האינפוגרפיקה.");
              setBlocks((prev) => prev.filter((b) => b.id !== newDiagramId));
              return;
            }

            setBlocks((prev) =>
              prev.map((b) =>
                b.id === newDiagramId
                  ? { ...b, antvSyntax: data.svg, renderStyle: "professional" }
                  : b
              )
            );
            toast.success("האינפוגרפיקה נוצרה!");
          } else {
            // Use roughjs sketch generation
            const requestBody: Record<string, unknown> = {
              text: selectedText,
              mode: generationMode,
            };
            if (!aiAuto) {
              requestBody.templateId = selectedTemplateId;
            }

            console.log("[DEBUG] Calling generate-diagram with:", requestBody);
            const { data, error } = await supabase.functions.invoke(
              "generate-diagram",
              { body: requestBody }
            );
            console.log("[DEBUG] generate-diagram response:", { data, error });

            if (error) {
              toast.error("שגיאה בייצור הדיאגרמה. נסה שנית.");
              setBlocks((prev) => prev.filter((b) => b.id !== newDiagramId));
              return;
            }

            if (data?.error) {
              toast.error(data.error);
              setBlocks((prev) => prev.filter((b) => b.id !== newDiagramId));
              return;
            }

            const diagramResult = data as DiagramData;

            if (diagramResult.suggestedTemplateId && onAiSuggestTemplate) {
              onAiSuggestTemplate(diagramResult.suggestedTemplateId as DiagramTemplateId);
            }
            if (diagramResult.suggestedColorTheme && onAiSuggestColorTheme) {
              onAiSuggestColorTheme(diagramResult.suggestedColorTheme);
            }

            setBlocks((prev) =>
              prev.map((b) =>
                b.id === newDiagramId
                  ? {
                      ...b,
                      diagramData: diagramResult,
                      templateId: (diagramResult.suggestedTemplateId as DiagramTemplateId) || selectedTemplateId,
                      renderStyle: "sketch",
                    }
                  : b
              )
            );
            toast.success("הדיאגרמה נוצרה!");
          }
        } catch {
          toast.error("משהו השתבש. נסה שנית.");
          setBlocks((prev) => prev.filter((b) => b.id !== newDiagramId));
        } finally {
          setLoadingBlockId(null);
        }
      },
      [generationMode, selectedTemplateId, aiAuto, renderStyle, onAiSuggestTemplate, onAiSuggestColorTheme]
    );

    const removeDiagram = useCallback((blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    }, []);

    const regenerateDiagram = useCallback(
      async (blockId: string) => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block?.sourceText) return;

        setLoadingBlockId(blockId);
        try {
          const blockStyle = block.renderStyle || renderStyle;

          if (blockStyle === "professional") {
            const { data, error } = await supabase.functions.invoke(
              "generate-infographic",
              { body: { text: block.sourceText } }
            );

            if (error || data?.error) {
              toast.error("שגיאה בייצור מחדש.");
              return;
            }

            setBlocks((prev) =>
              prev.map((b) =>
                b.id === blockId
                  ? { ...b, antvSyntax: data.svg }
                  : b
              )
            );
          } else {
            const requestBody: Record<string, unknown> = {
              text: block.sourceText,
              mode: generationMode,
            };
            if (!aiAuto) {
              requestBody.templateId = selectedTemplateId;
            }

            const { data, error } = await supabase.functions.invoke(
              "generate-diagram",
              { body: requestBody }
            );

            if (error || data?.error) {
              toast.error("שגיאה בייצור מחדש.");
              return;
            }

            setBlocks((prev) =>
              prev.map((b) =>
                b.id === blockId
                  ? { ...b, diagramData: data as DiagramData, templateId: selectedTemplateId }
                  : b
              )
            );
          }
          toast.success("יוצר מחדש!");
        } catch {
          toast.error("משהו השתבש.");
        } finally {
          setLoadingBlockId(null);
        }
      },
      [blocks, generationMode, selectedTemplateId, aiAuto, renderStyle]
    );

    return (
      <div className="relative w-full max-w-4xl mx-auto" ref={editorRef}>
        {selectionInfo && selectionInfo.rect && (
          <div
            className="fixed z-50 animate-in fade-in zoom-in-95"
            style={{
              top: selectionInfo.rect.top - 48,
              left: selectionInfo.rect.left + selectionInfo.rect.width / 2 - 70,
            }}
          >
            <Button
              size="sm"
              className="gap-1.5 shadow-lg font-medium"
              onMouseDown={(e) => {
                e.preventDefault();
                generateDiagram(selectionInfo.text, selectionInfo.blockId);
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {renderStyle === "professional" ? "צור אינפוגרפיקה" : "צור דיאגרמה"}
            </Button>
          </div>
        )}

        <div className="flex justify-end mb-2 px-4">
          <GenerationModeToggle mode={generationMode} onModeChange={setGenerationMode} />
        </div>

        <div className="space-y-0">
          {blocks.map((block) =>
            block.type === "text" ? (
              <div
                key={block.id}
                data-block-id={block.id}
                contentEditable
                suppressContentEditableWarning
                dir="rtl"
                onInput={(e) => {
                  const target = e.currentTarget;
                  handleTextChange(block.id, target.textContent || "");
                }}
                data-placeholder="כתוב את הרעיונות שלך כאן... סמן טקסט כדי ליצור דיאגרמה ✏️"
                className="w-full border-0 bg-transparent text-base leading-relaxed focus:outline-none focus:ring-0 font-sans p-4 min-h-[120px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none"
              />
            ) : (
              <div key={block.id} data-block-id={block.id}>
                {loadingBlockId === block.id && !block.diagramData && !block.antvSyntax ? (
                  <div className="flex items-center justify-center py-12 border-y border-border/50">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      <p className="text-muted-foreground font-sketch text-lg">
                        {block.renderStyle === "professional" ? "מעצב אינפוגרפיקה..." : "מצייר את הרעיונות שלך..."}
                      </p>
                    </div>
                  </div>
                ) : block.renderStyle === "professional" && block.antvSyntax ? (
                  <AntVDiagram
                    svgContent={block.antvSyntax}
                    sourceText={block.sourceText || ""}
                    isRegenerating={loadingBlockId === block.id}
                    onRemove={() => removeDiagram(block.id)}
                    onRegenerate={() => regenerateDiagram(block.id)}
                  />
                ) : block.diagramData ? (
                  <InlineDiagram
                    data={block.diagramData}
                    colorPalette={colorPalette}
                    templateId={block.templateId ?? selectedTemplateId}
                    sourceText={block.sourceText || ""}
                    isRegenerating={loadingBlockId === block.id}
                    onRemove={() => removeDiagram(block.id)}
                    onRegenerate={() => regenerateDiagram(block.id)}
                  />
                ) : null}
              </div>
            )
          )}
        </div>
      </div>
    );
  }
);

InlineEditor.displayName = "InlineEditor";

export default InlineEditor;
