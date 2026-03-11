import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import InlineDiagram from "@/components/InlineDiagram";
import SvgDiagram from "@/components/SvgDiagram";
import GenerationModeToggle, { type GenerationMode } from "@/components/GenerationModeToggle";
import type { DiagramData } from "@/types/diagram";
import { supabase } from "@/integrations/supabase/client";
import { diagramTemplates, type DiagramTemplateId } from "@/data/diagramTemplates";
import type { RenderStyle } from "@/components/RenderStyleToggle";

export interface DocumentBlock {
  id: string;
  type: "text" | "diagram";
  content: string;
  diagramData?: DiagramData;
  svgContent?: string;
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

/** Validate that a templateId actually exists in the templates list */
function isValidTemplateId(id: string | undefined): id is DiagramTemplateId {
  return !!id && diagramTemplates.some((t) => t.id === id);
}

/** Shared logic: invoke the right edge function and return result */
async function invokeGeneration(
  style: RenderStyle,
  text: string,
  mode: GenerationMode,
  aiAuto: boolean,
  selectedTemplateId: DiagramTemplateId
): Promise<
  | { type: "professional"; svg: string }
  | { type: "sketch"; data: DiagramData }
  | { error: string }
> {
  if (style === "professional") {
    const { data, error } = await supabase.functions.invoke("generate-infographic", {
      body: { text, templateId: selectedTemplateId },
    });
    if (error || data?.error) return { error: data?.error || "שגיאה בייצור האינפוגרפיקה." };
    return { type: "professional", svg: data.svg };
  } else {
    const requestBody: Record<string, unknown> = { text, mode };
    if (!aiAuto) requestBody.templateId = selectedTemplateId;
    const { data, error } = await supabase.functions.invoke("generate-diagram", { body: requestBody });
    if (error || data?.error) return { error: data?.error || "שגיאה בייצור הדיאגרמה. נסה שנית." };
    return { type: "sketch", data: data as DiagramData };
  }
}

const InlineEditor = forwardRef<{ insertText: (text: string) => void }, InlineEditorProps>(
  ({ colorPalette, selectedTemplateId, aiAuto = true, renderStyle = "sketch", onAiSuggestTemplate, onAiSuggestColorTheme }, ref) => {
    const [generationMode, setGenerationMode] = useState<GenerationMode>("literal");

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        setBlocks((prev) => {
          const textBlockIndex = prev.findIndex(b => b.type === "text");
          if (textBlockIndex !== -1) {
            return prev.map((b, i) => i === textBlockIndex ? { ...b, content: text } : b);
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
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: value } : b)));
    }, []);

    // Fix #5: robust selectionchange — handle Text nodes safely
    useEffect(() => {
      const handleSelectionChange = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setTimeout(() => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) setSelectionInfo(null);
          }, 200);
          return;
        }
        const selectedText = selection.toString().trim();
        if (selectedText.length < 3) return;

        try {
          const range = selection.getRangeAt(0);
          const node = range.startContainer;
          // Handle both Element and Text nodes
          const element = node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
          if (!element) return;

          const blockEl = element.closest("[data-block-id]");
          const blockId = blockEl?.getAttribute("data-block-id");
          if (blockId) {
            setSelectionInfo({ text: selectedText, blockId, rect: range.getBoundingClientRect() });
          }
        } catch {
          // Selection API can throw in edge cases — ignore silently
        }
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    const insertDiagramBlock = useCallback((afterBlockId: string, newDiagramId: string, selectedText: string) => {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === afterBlockId);
        if (idx === -1) return prev;
        const newBlock: DocumentBlock = {
          id: newDiagramId, type: "diagram", content: "",
          sourceText: selectedText, templateId: selectedTemplateId, renderStyle,
        };
        const needsTextAfter = idx === prev.length - 1 || prev[idx + 1]?.type === "diagram";
        const newBlocks = [...prev];
        const insertItems: DocumentBlock[] = [newBlock];
        if (needsTextAfter) {
          insertItems.push({ id: `text-${Date.now()}`, type: "text", content: "" });
        }
        newBlocks.splice(idx + 1, 0, ...insertItems);
        return newBlocks;
      });
    }, [selectedTemplateId, renderStyle]);

    /** Apply generation result to a block — shared between generate & regenerate */
    const applyResult = useCallback(
      (blockId: string, result: Awaited<ReturnType<typeof invokeGeneration>>) => {
        if ("error" in result) {
          toast.error(result.error);
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));
          return;
        }

        if (result.type === "professional") {
          setBlocks((prev) => prev.map((b) =>
            b.id === blockId ? { ...b, svgContent: result.svg, renderStyle: "professional" } : b
          ));
          toast.success("האינפוגרפיקה נוצרה!");
        } else {
          const diagramResult = result.data;

          // Fix #4: validate suggestedTemplateId before using it
          const validSuggestedTemplate = isValidTemplateId(diagramResult.suggestedTemplateId)
            ? diagramResult.suggestedTemplateId
            : undefined;

          if (validSuggestedTemplate && onAiSuggestTemplate) {
            onAiSuggestTemplate(validSuggestedTemplate);
          }
          if (diagramResult.suggestedColorTheme && onAiSuggestColorTheme) {
            onAiSuggestColorTheme(diagramResult.suggestedColorTheme);
          }

          setBlocks((prev) => prev.map((b) =>
            b.id === blockId ? {
              ...b, diagramData: diagramResult,
              templateId: validSuggestedTemplate || selectedTemplateId,
              renderStyle: "sketch",
            } : b
          ));
          toast.success("הדיאגרמה נוצרה!");
        }
      },
      [selectedTemplateId, onAiSuggestTemplate, onAiSuggestColorTheme]
    );

    // Fix #3: unified generate function — no duplication
    const generateDiagram = useCallback(
      async (selectedText: string, afterBlockId: string) => {
        const newDiagramId = `diagram-${Date.now()}`;
        setLoadingBlockId(newDiagramId);
        insertDiagramBlock(afterBlockId, newDiagramId, selectedText);
        setSelectionInfo(null);

        try {
          const result = await invokeGeneration(renderStyle, selectedText, generationMode, aiAuto, selectedTemplateId);
          applyResult(newDiagramId, result);
        } catch {
          toast.error("משהו השתבש. נסה שנית.");
          setBlocks((prev) => prev.filter((b) => b.id !== newDiagramId));
        } finally {
          setLoadingBlockId(null);
        }
      },
      [generationMode, selectedTemplateId, aiAuto, renderStyle, insertDiagramBlock, applyResult]
    );

    const removeDiagram = useCallback((blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    }, []);

    // Fix #3: regenerate reuses the same invokeGeneration + applyResult
    const regenerateDiagram = useCallback(
      async (blockId: string) => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block?.sourceText) return;
        setLoadingBlockId(blockId);
        try {
          const blockStyle = block.renderStyle || renderStyle;
          const result = await invokeGeneration(blockStyle, block.sourceText, generationMode, aiAuto, selectedTemplateId);
          // For regenerate, don't remove on error — keep existing content
          if ("error" in result) {
            toast.error(result.error);
          } else if (result.type === "professional") {
            setBlocks((prev) => prev.map((b) =>
              b.id === blockId ? { ...b, svgContent: result.svg } : b
            ));
            toast.success("יוצר מחדש!");
          } else {
            const validTemplate = isValidTemplateId(result.data.suggestedTemplateId)
              ? result.data.suggestedTemplateId
              : selectedTemplateId;
            setBlocks((prev) => prev.map((b) =>
              b.id === blockId ? { ...b, diagramData: result.data, templateId: validTemplate } : b
            ));
            toast.success("יוצר מחדש!");
          }
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
            style={{ top: selectionInfo.rect.top - 48, left: selectionInfo.rect.left + selectionInfo.rect.width / 2 - 70 }}
          >
            <Button
              size="sm"
              className="gap-1.5 shadow-lg font-medium"
              onMouseDown={(e) => { e.preventDefault(); generateDiagram(selectionInfo.text, selectionInfo.blockId); }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {renderStyle === "professional" ? "צור אינפוגרפיקה" : "צור דיאגרמה"}
            </Button>
          </div>
        )}

        {renderStyle === "sketch" && (
          <div className="flex justify-end mb-2 px-4">
            <GenerationModeToggle mode={generationMode} onModeChange={setGenerationMode} />
          </div>
        )}

        <div className="space-y-0">
          {blocks.map((block) =>
            block.type === "text" ? (
              <div
                key={block.id}
                data-block-id={block.id}
                contentEditable
                suppressContentEditableWarning
                dir="rtl"
                onInput={(e) => handleTextChange(block.id, e.currentTarget.textContent || "")}
                data-placeholder="כתוב את הרעיונות שלך כאן... סמן טקסט כדי ליצור דיאגרמה ✏️"
                className="w-full border-0 bg-transparent text-base leading-relaxed focus:outline-none focus:ring-0 font-sans p-4 min-h-[120px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none"
              />
            ) : (
              <div key={block.id} data-block-id={block.id}>
                {loadingBlockId === block.id && !block.diagramData && !block.svgContent ? (
                  <div className="flex items-center justify-center py-12 border-y border-border/50">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      <p className="text-muted-foreground font-sketch text-lg">
                        {block.renderStyle === "professional" ? "מעצב אינפוגרפיקה..." : "מצייר את הרעיונות שלך..."}
                      </p>
                    </div>
                  </div>
                ) : block.renderStyle === "professional" && block.svgContent ? (
                  <SvgDiagram
                    svgContent={block.svgContent}
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
