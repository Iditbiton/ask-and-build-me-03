import { Lightbulb, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type GenerationMode = "creative" | "literal";

interface GenerationModeToggleProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
}

const GenerationModeToggle = ({ mode, onModeChange }: GenerationModeToggleProps) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/50 p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "literal" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 text-xs px-2.5"
              onClick={() => onModeChange("literal")}
            >
              <BookOpen className="w-3 h-3" />
              צמוד לטקסט
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>הדיאגרמה תשקף את הטקסט בדיוק</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "creative" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 text-xs px-2.5"
              onClick={() => onModeChange("creative")}
            >
              <Lightbulb className="w-3 h-3" />
              חופשי
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>הבינה המלאכותית תרחיב ותוסיף רעיונות</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default GenerationModeToggle;
