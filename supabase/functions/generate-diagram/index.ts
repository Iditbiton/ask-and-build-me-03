import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  stacked:
    "Use a stacked layout: 3-5 horizontal layers from top to bottom, each layer wider or equal to the one above. Keep clear vertical separation.",
  arrow:
    "Use a directional arrow layout: place nodes in a clear left-to-right or top-to-bottom chain emphasizing progression.",
  diamond:
    "Use a diamond-centric decision layout: one core decision node in the center with branches to supporting nodes around it.",
  puzzle:
    "Use a puzzle layout: 4-6 tightly grouped complementary nodes arranged as interlocking parts of one whole concept.",
  radial:
    "Use a radial layout: one central node with surrounding nodes distributed evenly in a circle.",
  pinwheel:
    "Use a pinwheel layout: center-focused rotational arrangement where branches sweep around the center in a spiral-like order.",
  eight:
    "Use a figure-eight layout: arrange nodes in two connected loops (left loop and right loop) with one bridge between loops.",
  pyramid:
    "Use a pyramid layout: hierarchical triangular structure with one top node, 2 middle nodes, and 3+ base nodes.",
  funnel:
    "Use a funnel layout: wide at the top narrowing down, representing filtering or narrowing of items.",
  timeline:
    "Use a timeline layout: horizontal or vertical sequence with clear temporal ordering.",
  hexagon:
    "Use a hexagon grid layout: honeycomb pattern with hexagonal grouping of related concepts.",
  venn:
    "Use a Venn diagram layout: overlapping circles showing relationships and intersections between groups.",
  cycle:
    "Use a cycle layout: circular arrangement showing a repeating process with arrows connecting back to the start.",
};

const COLOR_THEMES: Record<string, string[]> = {
  default: ["#e07a3a", "#3d9b8f", "#5b7bb5", "#c75c5c", "#7cab5e", "#9b72b0"],
  ocean: ["#1a73e8", "#00acc1", "#5c6bc0", "#0d47a1", "#26a69a", "#7986cb"],
  sunset: ["#ff6f00", "#e65100", "#ff8f00", "#d84315", "#f4511e", "#ff9100"],
  forest: ["#2e7d32", "#558b2f", "#33691e", "#4caf50", "#689f38", "#1b5e20"],
  pastel: ["#f48fb1", "#ce93d8", "#90caf9", "#80cbc4", "#a5d6a7", "#ffcc80"],
  monochrome: ["#424242", "#616161", "#757575", "#9e9e9e", "#546e7a", "#78909c"],
  neon: ["#00e676", "#00b0ff", "#d500f9", "#ff1744", "#ffea00", "#76ff03"],
  earth: ["#8d6e63", "#a1887f", "#6d4c41", "#795548", "#bcaaa4", "#4e342e"],
};

type TemplateId = keyof typeof TEMPLATE_INSTRUCTIONS;

type DiagramType = "flowchart" | "mindmap" | "list" | "comparison" | "process";

type DiagramNode = {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "circle" | "hexagon";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

type DiagramConnection = {
  from: string;
  to: string;
  label?: string;
};

type DiagramResponse = {
  title: string;
  type: DiagramType;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  width: number;
  height: number;
  suggestedTemplateId?: string;
  suggestedColorTheme?: string;
};

const SYSTEM_PROMPT = `You are an expert infographic designer — think Napkin.ai quality. Given text, return a JSON object describing a BEAUTIFULLY DESIGNED visual diagram where text and visuals are TIGHTLY INTEGRATED.

CRITICAL RULE — NODE COUNT:
- Create ONE node for EVERY distinct concept, step, or item mentioned in the text.
- If the text mentions 7 concepts, create 7 nodes. If it mentions 4, create 4.
- Do NOT summarize or merge concepts. Each concept = one node.
- Minimum 3 nodes, maximum 12 nodes.

DESIGN PRINCIPLES:
- Think like a VISUAL DESIGNER, not a text formatter
- Each node label should be SHORT and PUNCHY: 1-3 words MAXIMUM
- The title should be catchy and concise (2-4 words)
- Think about visual HIERARCHY: the FIRST node is the main/central concept
- The diagram should tell a STORY - there must be a clear visual flow

TEXT-VISUAL INTEGRATION RULES:
- Labels ARE the visual — they must fit perfectly inside their shapes
- The first/main node should be wider (180-220px) and taller (80-100px)
- Regular nodes: width 130-160px, height 60-70px
- NEVER make a label longer than the node width allows (roughly 1 word per 70px)
- Connection labels explain the RELATIONSHIP (e.g., "leads to", "causes", "enables")
- Every connection MUST have a short label (1-2 words) explaining the relationship

RULES:
- Return ONLY valid JSON, no markdown, no backticks, no explanation
- Canvas dimensions: width 800, height 600
- Leave 60px top margin for the title
- Space nodes with at least 40px between them
- CRITICAL: Detect the language of the input text. If Hebrew, ALL labels and title MUST be in Hebrew.
- CRITICAL: Labels must be EXTREMELY concise. "תשתית יציבה בבסיס" → "תשתית". "User Experience Design" → "UX".
- Make the first node visually dominant (larger, centered or at top)
- Connections must form a logical flow that matches the content's narrative

JSON Schema:
{
  "title": "string - catchy 2-4 word title",
  "type": "flowchart" | "mindmap" | "list" | "comparison" | "process",
  "nodes": [
    {
      "id": "string",
      "type": "rectangle" | "ellipse" | "diamond" | "circle" | "hexagon",
      "x": number,
      "y": number,
      "width": number (first node 180-220, others 130-160),
      "height": number (first node 80-100, others 60-70),
      "label": "string - 1-3 words MAX"
    }
  ],
  "connections": [
    {
      "from": "node_id",
      "to": "node_id",
      "label": "REQUIRED - 1-2 word relationship label"
    }
  ],
  "width": 800,
  "height": 600
}

Diagram type guidelines:
- flowchart: Rectangles for steps, diamonds for decisions, clear directional flow
- mindmap: Central ellipse (large) with branching rectangles/circles radiating out
- list: Vertical aligned rectangles with sequential connections
- comparison: Side-by-side columns with cross-connections showing contrasts
- process: Chain of shapes with labeled arrows showing progression

Choose the most appropriate type. Use a mix of shapes for visual interest.`;

const toTemplateId = (value: unknown): TemplateId | null => {
  if (typeof value !== "string") return null;
  return value in TEMPLATE_INSTRUCTIONS ? (value as TemplateId) : null;
};

const enforceNodeSizes = (nodes: DiagramNode[]) => {
  nodes.forEach((node) => {
    node.width = 130;
    node.height = 64;
  });
};

const clampToCanvas = (nodes: DiagramNode[]) => {
  nodes.forEach((node) => {
    node.x = Math.max(20, Math.min(800 - node.width - 20, Math.round(node.x)));
    node.y = Math.max(70, Math.min(600 - node.height - 20, Math.round(node.y)));
  });
};

const createSequentialConnections = (nodes: DiagramNode[]): DiagramConnection[] =>
  nodes.slice(0, -1).map((node, i) => ({
    from: node.id,
    to: nodes[i + 1].id,
  }));

const createStarConnections = (nodes: DiagramNode[]): DiagramConnection[] => {
  if (nodes.length < 2) return [];
  const [center, ...rest] = nodes;
  return rest.map((node) => ({ from: center.id, to: node.id }));
};

const dedupeConnections = (connections: DiagramConnection[]): DiagramConnection[] => {
  const seen = new Set<string>();
  return connections.filter((connection) => {
    const key = `${connection.from}->${connection.to}:${connection.label ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildTemplateConnections = (
  nodes: DiagramNode[],
  templateId: TemplateId,
): DiagramConnection[] => {
  if (nodes.length < 2) return [];

  switch (templateId) {
    case "arrow":
    case "stacked":
    case "pinwheel":
    case "pyramid":
    case "funnel":
    case "timeline":
      return createSequentialConnections(nodes);

    case "diamond":
    case "radial":
    case "hexagon":
      return createStarConnections(nodes);

    case "cycle": {
      const conns = createSequentialConnections(nodes);
      if (nodes.length > 2) {
        conns.push({ from: nodes[nodes.length - 1].id, to: nodes[0].id });
      }
      return conns;
    }

    case "venn": {
      // Connect overlapping neighbors
      const vennConns: DiagramConnection[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          vennConns.push({ from: nodes[i].id, to: nodes[j].id });
        }
      }
      return vennConns;
    }

    case "puzzle": {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const gridConnections: DiagramConnection[] = [];

      nodes.forEach((node, index) => {
        const rightIndex = index + 1;
        const downIndex = index + cols;

        if (rightIndex < nodes.length && rightIndex % cols !== 0) {
          gridConnections.push({ from: node.id, to: nodes[rightIndex].id });
        }

        if (downIndex < nodes.length) {
          gridConnections.push({ from: node.id, to: nodes[downIndex].id });
        }
      });

      return gridConnections;
    }

    case "eight": {
      const half = Math.ceil(nodes.length / 2);
      const leftLoop = nodes.slice(0, half);
      const rightLoop = nodes.slice(half);
      const loopConnections: DiagramConnection[] = [];

      const connectLoop = (loop: DiagramNode[]) => {
        if (loop.length < 2) return;
        for (let i = 0; i < loop.length - 1; i += 1) {
          loopConnections.push({ from: loop[i].id, to: loop[i + 1].id });
        }
        if (loop.length > 2) {
          loopConnections.push({ from: loop[loop.length - 1].id, to: loop[0].id });
        }
      };

      connectLoop(leftLoop);
      connectLoop(rightLoop);

      if (leftLoop[0] && rightLoop[0]) {
        loopConnections.push({ from: leftLoop[0].id, to: rightLoop[0].id });
      }

      return loopConnections;
    }
  }

  return createSequentialConnections(nodes);
};

const applyTemplateLayout = (diagram: DiagramResponse, templateId: TemplateId | null) => {
  if (!templateId || !diagram.nodes?.length) return;

  const n = diagram.nodes.length;
  const nodes = diagram.nodes;
  enforceNodeSizes(nodes);

  const centerX = 400;
  const centerY = 315;

  switch (templateId) {
    case "arrow": {
      const minGapX = 24;
      const maxCols = Math.max(
        2,
        Math.floor((800 - 120 + minGapX) / (130 + minGapX)),
      );
      const rows = Math.ceil(n / maxCols);
      let cursor = 0;

      for (let row = 0; row < rows; row += 1) {
        const count = Math.min(maxCols, n - cursor);
        const rowWidth = count * 130 + (count - 1) * minGapX;
        const startX = (800 - rowWidth) / 2;
        const y = 120 + row * 130;

        for (let col = 0; col < count; col += 1) {
          const visualCol = row % 2 === 0 ? col : count - col - 1;
          const node = nodes[cursor];
          node.x = startX + visualCol * (130 + minGapX);
          node.y = y;
          node.type = cursor === 0 || cursor === n - 1 ? "ellipse" : "rectangle";
          cursor += 1;
        }
      }

      diagram.type = "process";
      break;
    }

    case "stacked": {
      if (n <= 5) {
        const gap = n > 1 ? 95 : 0;
        nodes.forEach((node, i) => {
          node.x = centerX - 65;
          node.y = 120 + i * gap;
          node.type = "rectangle";
        });
      } else {
        const rows = Math.ceil(n / 2);
        const totalWidth = 2 * 130 + 140;
        const startX = (800 - totalWidth) / 2;

        nodes.forEach((node, i) => {
          const col = i < rows ? 0 : 1;
          const row = i < rows ? i : i - rows;
          node.x = startX + col * (130 + 140);
          node.y = 120 + row * 90;
          node.type = "rectangle";
        });
      }

      diagram.type = "list";
      break;
    }

    case "diamond": {
      const radiusX = Math.min(230, 150 + n * 10);
      const radiusY = Math.min(165, 100 + n * 8);

      nodes.forEach((node, i) => {
        if (i === 0) {
          node.x = centerX - 65;
          node.y = centerY - 32;
          node.type = "diamond";
          return;
        }

        const angle = ((i - 1) / Math.max(1, n - 1)) * Math.PI * 2;
        node.x = centerX + radiusX * Math.cos(angle) - 65;
        node.y = centerY + radiusY * Math.sin(angle) - 32;
        node.type = i % 2 === 0 ? "ellipse" : "rectangle";
      });

      diagram.type = "flowchart";
      break;
    }

    case "puzzle": {
      const cols = Math.max(2, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);
      const gapX = 26;
      const gapY = 34;
      const totalWidth = cols * 130 + (cols - 1) * gapX;
      const startX = (800 - totalWidth) / 2;
      const startY = 120;

      nodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        node.x = startX + col * (130 + gapX) + (row % 2 === 0 ? 0 : 14);
        node.y = startY + row * (64 + gapY);
        node.type = (i + row) % 2 === 0 ? "ellipse" : "rectangle";
      });

      diagram.type = "comparison";
      break;
    }

    case "radial": {
      const firstRing = Math.min(6, Math.max(0, n - 1));
      const secondRing = Math.max(0, n - 1 - firstRing);

      nodes.forEach((node, i) => {
        if (i === 0) {
          node.x = centerX - 65;
          node.y = centerY - 32;
          node.type = "ellipse";
          return;
        }

        if (i <= firstRing) {
          const angle = ((i - 1) / Math.max(1, firstRing)) * Math.PI * 2;
          node.x = centerX + 150 * Math.cos(angle) - 65;
          node.y = centerY + 130 * Math.sin(angle) - 32;
          node.type = "rectangle";
          return;
        }

        const outerIndex = i - 1 - firstRing;
        const angle = (outerIndex / Math.max(1, secondRing)) * Math.PI * 2;
        node.x = centerX + 235 * Math.cos(angle) - 65;
        node.y = centerY + 190 * Math.sin(angle) - 32;
        node.type = "rectangle";
      });

      diagram.type = "mindmap";
      break;
    }

    case "pinwheel": {
      nodes.forEach((node, i) => {
        const angle = i * 1.05;
        const radius = 44 + i * 40;
        node.x = centerX + radius * Math.cos(angle) - 65;
        node.y = centerY + radius * Math.sin(angle) - 32;
        node.type = i === 0 ? "circle" : "rectangle";
      });

      diagram.type = "process";
      break;
    }

    case "eight": {
      const half = Math.ceil(n / 2);
      const left = { x: 280, y: 315 };
      const right = { x: 520, y: 315 };

      nodes.forEach((node, i) => {
        const inLeft = i < half;
        const sideCount = inLeft ? half : Math.max(1, n - half);
        const sideIndex = inLeft ? i : i - half;
        const angle = (sideIndex / sideCount) * Math.PI * 2;
        const center = inLeft ? left : right;

        node.x = center.x + 108 * Math.cos(angle) - 65;
        node.y = center.y + 82 * Math.sin(angle) - 32;
        node.type = i === 0 ? "circle" : "ellipse";
      });

      diagram.type = "process";
      break;
    }

    case "pyramid": {
      let currentIndex = 0;
      let row = 1;

      while (currentIndex < n) {
        const itemsInRow = Math.min(row, n - currentIndex);
        const totalWidth = itemsInRow * 130 + (itemsInRow - 1) * 22;
        const startX = (800 - totalWidth) / 2;
        const y = 120 + (row - 1) * 98;

        for (let j = 0; j < itemsInRow && currentIndex < n; j += 1) {
          const node = nodes[currentIndex];
          node.x = startX + j * (130 + 22);
          node.y = y;
          node.type = row === 1 ? "diamond" : "rectangle";
          currentIndex += 1;
        }

        row += 1;
      }

      diagram.type = "comparison";
      break;
    }

    case "funnel": {
      // Funnel: items get narrower (centered) as they go down
      const maxWidth = 260;
      const stepHeight = Math.min(90, Math.floor((600 - 120) / n));
      
      nodes.forEach((node, i) => {
        const ratio = 1 - (i / Math.max(1, n - 1)) * 0.6;
        const w = Math.max(130, Math.round(maxWidth * ratio));
        node.width = w;
        node.height = 64;
        node.x = centerX - w / 2;
        node.y = 100 + i * stepHeight;
        node.type = i === n - 1 ? "ellipse" : "rectangle";
      });

      diagram.type = "process";
      break;
    }

    case "timeline": {
      // Timeline: horizontal line with nodes above/below alternating
      const gap = Math.min(140, Math.floor((800 - 80) / n));
      const startX = (800 - (n - 1) * gap) / 2 - 65;

      nodes.forEach((node, i) => {
        node.x = startX + i * gap;
        node.y = i % 2 === 0 ? 180 : 360;
        node.type = "rectangle";
      });

      diagram.type = "process";
      break;
    }

    case "hexagon": {
      // Hex grid: honeycomb arrangement with hexagonal nodes
      const hexW = 150;
      const hexH = 90;
      const cols = Math.max(2, Math.ceil(Math.sqrt(n)));

      nodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const offsetX = row % 2 === 0 ? 0 : hexW * 0.55;
        node.x = 120 + col * (hexW + 10) + offsetX;
        node.y = 120 + row * (hexH + 10);
        node.width = 140;
        node.height = 80;
        node.type = "hexagon";
      });

      diagram.type = "mindmap";
      break;
    }

    case "venn": {
      // Venn: overlapping circles
      const radius = Math.min(160, 100 + n * 15);
      
      nodes.forEach((node, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = n <= 2 ? 80 : radius * 0.45;
        node.x = centerX + r * Math.cos(angle) - 65;
        node.y = centerY + r * Math.sin(angle) - 32;
        node.type = "circle";
        node.width = 140;
        node.height = 140;
      });

      diagram.type = "comparison";
      break;
    }

    case "cycle": {
      // Cycle: circular arrangement
      const cycleRadius = Math.min(180, 120 + n * 12);

      nodes.forEach((node, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        node.x = centerX + cycleRadius * Math.cos(angle) - 65;
        node.y = centerY + cycleRadius * Math.sin(angle) - 32;
        node.type = "ellipse";
      });

      diagram.type = "process";
      break;
    }
  }

  clampToCanvas(nodes);
  diagram.connections = dedupeConnections(buildTemplateConnections(nodes, templateId));
};

// Use tool calling to let AI pick template + color theme
const autoSelectTools = [
  {
    type: "function",
    function: {
      name: "select_style",
      description: "Select the best visual template and color theme for the given text content.",
      parameters: {
        type: "object",
        properties: {
          templateId: {
            type: "string",
            enum: Object.keys(TEMPLATE_INSTRUCTIONS),
            description: "The template that best fits the content structure. stacked=layers/hierarchy, arrow=linear process, diamond=decisions, puzzle=complementary parts, radial=central concept with branches, pinwheel=spiral/iterative, eight=two connected loops, pyramid=hierarchy top-to-bottom, funnel=filtering/narrowing, timeline=temporal sequence, hexagon=honeycomb grouping, venn=overlapping relationships, cycle=repeating circular process",
          },
          colorTheme: {
            type: "string",
            enum: Object.keys(COLOR_THEMES),
            description: "The color theme that best matches the content mood. default=balanced, ocean=professional/tech, sunset=warm/energetic, forest=nature/growth, pastel=soft/friendly, monochrome=serious/formal, neon=bold/modern, earth=grounded/traditional",
          },
          reasoning: {
            type: "string",
            description: "Brief explanation of why this template and color were chosen",
          },
        },
        required: ["templateId", "colorTheme", "reasoning"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, mode, templateId: rawTemplateId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userTemplateId = toTemplateId(rawTemplateId);
    console.info("generate-diagram request", { mode, rawTemplateId, userTemplateId });
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: If no template specified, let AI auto-select template + color
    let templateId = userTemplateId;
    let suggestedColorTheme: string | null = null;

    if (!templateId) {
      const styleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "You are a visual design expert. Analyze the text and select the best diagram template and color theme.",
            },
            {
              role: "user",
              content: `Analyze this text and select the best visual template and color theme:\n\n${text}`,
            },
          ],
          tools: autoSelectTools,
          tool_choice: { type: "function", function: { name: "select_style" } },
          temperature: 0.3,
        }),
      });

      if (styleResponse.ok) {
        try {
          const styleData = await styleResponse.json();
          const toolCall = styleData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const args = JSON.parse(toolCall.function.arguments);
            console.info("AI style selection:", args);
            templateId = toTemplateId(args.templateId);
            if (args.colorTheme && args.colorTheme in COLOR_THEMES) {
              suggestedColorTheme = args.colorTheme;
            }
          }
        } catch (e) {
          console.error("Failed to parse style selection:", e);
        }
      }

      // Fallback
      if (!templateId) templateId = "radial";
      if (!suggestedColorTheme) suggestedColorTheme = "default";
    }

    // Step 2: Generate diagram content
    const modeInstruction = mode === "creative"
      ? "Be creative and expand on the ideas. Add related concepts, elaborate on connections, and make the diagram richer than the literal text. Think of what the user might have meant and add value."
      : "Stay as close as possible to the original text. Use the exact terms and structure from the text. Do not add concepts that are not explicitly mentioned.";

    const templateInstruction = templateId
      ? `Template style is '${templateId}'. ${TEMPLATE_INSTRUCTIONS[templateId as string]}`
      : "No explicit template style provided. Choose the best fitting layout naturally.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${modeInstruction}\n\n${templateInstruction}\n\nCreate a visual diagram for the following text:\n\n${text}`,
          },
        ],
        temperature: mode === "creative" ? 0.9 : 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add AI credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleanJson = content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const diagramData = JSON.parse(cleanJson) as DiagramResponse;

    if (!diagramData.nodes || !Array.isArray(diagramData.nodes)) {
      return new Response(JSON.stringify({ error: "Invalid diagram structure from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    diagramData.width = diagramData.width || 800;
    diagramData.height = diagramData.height || 600;

    applyTemplateLayout(diagramData, templateId);

    // Include AI suggestions in response
    if (!userTemplateId) {
      diagramData.suggestedTemplateId = templateId as string;
    }
    if (suggestedColorTheme) {
      diagramData.suggestedColorTheme = suggestedColorTheme;
    }

    return new Response(JSON.stringify(diagramData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
