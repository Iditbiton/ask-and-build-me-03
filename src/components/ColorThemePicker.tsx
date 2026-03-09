import { useState } from "react";
import { Palette, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ColorTheme {
  id: string;
  name: string;
  colors: string[];
}

export const colorThemes: ColorTheme[] = [
  {
    id: "default",
    name: "ברירת מחדל",
    colors: ["#e07a3a", "#3d9b8f", "#5b7bb5", "#c75c5c", "#7cab5e", "#9b72b0"],
  },
  {
    id: "ocean",
    name: "אוקיינוס",
    colors: ["#1a73e8", "#00acc1", "#5c6bc0", "#0d47a1", "#26a69a", "#7986cb"],
  },
  {
    id: "sunset",
    name: "שקיעה",
    colors: ["#ff6f00", "#e65100", "#ff8f00", "#d84315", "#f4511e", "#ff9100"],
  },
  {
    id: "forest",
    name: "יער",
    colors: ["#2e7d32", "#558b2f", "#33691e", "#4caf50", "#689f38", "#1b5e20"],
  },
  {
    id: "pastel",
    name: "פסטל",
    colors: ["#f48fb1", "#ce93d8", "#90caf9", "#80cbc4", "#a5d6a7", "#ffcc80"],
  },
  {
    id: "monochrome",
    name: "מונוכרום",
    colors: ["#424242", "#616161", "#757575", "#9e9e9e", "#546e7a", "#78909c"],
  },
  {
    id: "neon",
    name: "ניאון",
    colors: ["#00e676", "#00b0ff", "#d500f9", "#ff1744", "#ffea00", "#76ff03"],
  },
  {
    id: "earth",
    name: "אדמה",
    colors: ["#8d6e63", "#a1887f", "#6d4c41", "#795548", "#bcaaa4", "#4e342e"],
  },
];

interface ColorThemePickerProps {
  selectedTheme: string;
  onSelect: (theme: ColorTheme) => void;
}

const ColorThemePicker = ({ selectedTheme, onSelect }: ColorThemePickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Palette className="w-3.5 h-3.5" />
          צבעים
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid gap-1">
          {colorThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => {
                onSelect(theme);
                setOpen(false);
              }}
              className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/10 transition-colors w-full"
            >
              <div className="flex gap-1">
                {theme.colors.slice(0, 4).map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-sm text-foreground flex-1 text-right">{theme.name}</span>
              {selectedTheme === theme.id && (
                <Check className="w-3.5 h-3.5 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorThemePicker;
