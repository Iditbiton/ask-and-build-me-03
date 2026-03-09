import { Textarea } from "@/components/ui/textarea";

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const PLACEHOLDER = `Write your ideas here and we'll turn them into a visual diagram...

Examples:
• "The software development lifecycle: Planning → Design → Development → Testing → Deployment → Maintenance"
• "Compare React vs Vue vs Angular: performance, learning curve, ecosystem, community"
• "Steps to launch a startup: Idea → Validate → MVP → Launch → Grow"`;

const TextEditor = ({ value, onChange }: TextEditorProps) => {
  return (
    <div className="flex flex-col h-full">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        className="flex-1 resize-none border-0 bg-transparent text-base leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 font-sans placeholder:text-muted-foreground/60 min-h-[300px]"
      />
    </div>
  );
};

export default TextEditor;
