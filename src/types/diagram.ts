export interface DiagramNode {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "circle" | "hexagon";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface DiagramData {
  title: string;
  type: "flowchart" | "mindmap" | "list" | "comparison" | "process";
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  width: number;
  height: number;
  suggestedTemplateId?: string;
  suggestedColorTheme?: string;
}
