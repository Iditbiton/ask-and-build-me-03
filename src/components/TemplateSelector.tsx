import { useState, forwardRef } from "react";
import { LayoutGrid, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  diagramTemplates,
  type DiagramTemplate,
  type DiagramTemplateId,
} from "@/data/diagramTemplates";

export type Template = DiagramTemplate;

interface TemplateSelectorProps {
  selectedTemplateId: DiagramTemplateId;
  onSelect: (template: Template) => void;
}

const TemplatePreview = ({ templateId }: { templateId: DiagramTemplateId }) => {
  const node = "absolute h-2.5 w-2.5 rounded-[3px] bg-primary/80";
  const roundNode = "absolute h-2.5 w-2.5 rounded-full bg-primary/80";

  return (
    <div className="relative h-11 w-16 shrink-0 rounded-md border border-border/60 bg-muted/40">
      {templateId === "arrow" && (
        <>
          <span className={`${roundNode} left-2 top-4`} />
          <span className={`${node} left-6 top-4`} />
          <span className={`${node} left-10 top-4`} />
          <span className={`${roundNode} left-[3.1rem] top-4`} />
        </>
      )}

      {templateId === "stacked" && (
        <>
          <span className={`${node} left-6 top-2`} />
          <span className={`${node} left-6 top-5`} />
          <span className={`${node} left-6 top-8`} />
        </>
      )}

      {templateId === "diamond" && (
        <>
          <span className="absolute left-7 top-4 h-3 w-3 rotate-45 rounded-[2px] bg-primary/80" />
          <span className={`${roundNode} left-2 top-1`} />
          <span className={`${roundNode} left-12 top-1`} />
          <span className={`${roundNode} left-2 top-8`} />
          <span className={`${roundNode} left-12 top-8`} />
        </>
      )}

      {templateId === "puzzle" && (
        <>
          <span className={`${roundNode} left-3 top-2`} />
          <span className={`${node} left-9 top-2`} />
          <span className={`${node} left-3 top-7`} />
          <span className={`${roundNode} left-9 top-7`} />
        </>
      )}

      {templateId === "radial" && (
        <>
          <span className={`${roundNode} left-7 top-4`} />
          <span className={`${node} left-2 top-4`} />
          <span className={`${node} left-12 top-4`} />
          <span className={`${node} left-7 top-1`} />
          <span className={`${node} left-7 top-8`} />
        </>
      )}

      {templateId === "pinwheel" && (
        <>
          <span className={`${roundNode} left-7 top-4`} />
          <span className={`${node} left-10 top-2`} />
          <span className={`${node} left-12 top-6`} />
          <span className={`${node} left-8 top-8`} />
          <span className={`${node} left-4 top-7`} />
        </>
      )}

      {templateId === "eight" && (
        <>
          <span className={`${roundNode} left-3 top-3`} />
          <span className={`${roundNode} left-3 top-7`} />
          <span className={`${roundNode} left-11 top-3`} />
          <span className={`${roundNode} left-11 top-7`} />
          <span className={`${node} left-7 top-5`} />
        </>
      )}

      {templateId === "pyramid" && (
        <>
          <span className="absolute left-7 top-1 h-3 w-3 rotate-45 rounded-[2px] bg-primary/80" />
          <span className={`${node} left-4 top-5`} />
          <span className={`${node} left-10 top-5`} />
          <span className={`${node} left-2 top-8`} />
          <span className={`${node} left-7 top-8`} />
          <span className={`${node} left-12 top-8`} />
        </>
      )}

      {templateId === "funnel" && (
        <>
          <span className="absolute left-2 top-2 h-2 w-12 rounded-[2px] bg-primary/80" />
          <span className="absolute left-4 top-5 h-2 w-8 rounded-[2px] bg-primary/60" />
          <span className="absolute left-6 top-8 h-2 w-4 rounded-[2px] bg-primary/40" />
        </>
      )}

      {templateId === "timeline" && (
        <>
          <span className="absolute left-1 top-5 w-14 h-[2px] bg-primary/40" />
          <span className={`${node} left-2 top-2`} />
          <span className={`${node} left-7 top-6`} />
          <span className={`${node} left-12 top-2`} />
        </>
      )}

      {templateId === "hexagon" && (
        <>
          <span className={`${roundNode} left-4 top-2`} />
          <span className={`${roundNode} left-10 top-2`} />
          <span className={`${roundNode} left-2 top-6`} />
          <span className={`${roundNode} left-7 top-6`} />
          <span className={`${roundNode} left-12 top-6`} />
        </>
      )}

      {templateId === "venn" && (
        <>
          <span className="absolute left-3 top-3 h-6 w-6 rounded-full border-2 border-primary/60 bg-transparent" />
          <span className="absolute left-7 top-3 h-6 w-6 rounded-full border-2 border-primary/60 bg-transparent" />
        </>
      )}

      {templateId === "cycle" && (
        <>
          <span className={`${roundNode} left-7 top-1`} />
          <span className={`${roundNode} left-12 top-4`} />
          <span className={`${roundNode} left-10 top-8`} />
          <span className={`${roundNode} left-4 top-8`} />
          <span className={`${roundNode} left-2 top-4`} />
        </>
      )}
    </div>
  );
};

const TemplateSelector = ({ selectedTemplateId, onSelect }: TemplateSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selectedTemplate =
    diagramTemplates.find((template) => template.id === selectedTemplateId) ?? diagramTemplates[0];

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 min-w-[170px] justify-between">
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              תבנית: {selectedTemplate.name}
            </span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[28rem] p-2 max-h-[70vh] overflow-y-auto" align="start">
          <div className="space-y-1">
            {diagramTemplates.map((template) => {
              const Icon = template.icon;

              return (
                <button
                  key={template.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(template);
                    setOpen(true);
                  }}
                  className="flex items-start gap-3 rounded-lg p-3 text-right hover:bg-accent/10 transition-colors w-full"
                >
                  <TemplatePreview templateId={template.id} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-foreground inline-flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-primary" />
                        {template.name}
                      </p>
                      {selectedTemplateId === template.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border/60 mt-2 pt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              סגור
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TemplateSelector;
