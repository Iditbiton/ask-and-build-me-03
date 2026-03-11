import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  stacked: "Stacked layout: horizontal layers from top to bottom.",
  arrow: "Arrow layout: left-to-right or top-to-bottom chain showing progression.",
  diamond: "Diamond layout: one core decision node in center with branches around it.",
  puzzle: "Puzzle layout: tightly grouped complementary nodes as interlocking parts.",
  radial: "Radial layout: one central node with surrounding nodes in a circle.",
  pinwheel: "Pinwheel layout: center-focused spiral arrangement.",
  eight: "Figure-eight layout: two connected loops with a bridge node.",
  pyramid: "Pyramid layout: triangular hierarchy, one top, more at base.",
  funnel: "Funnel layout: wide at top, narrow at bottom, showing filtering.",
  timeline: "Timeline layout: horizontal/vertical sequence with temporal ordering.",
  hexagon: "Hexagon grid layout: honeycomb pattern with hexagonal nodes.",
  venn: "Venn diagram layout: overlapping circles showing relationships.",
  cycle: "Cycle layout: circular arrangement with arrows connecting back to start.",
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

/**
 * Extract distinct concepts from text by splitting on common delimiters.
 * Returns the list of concept strings found.
 */
function extractConcepts(text: string): string[] {
  // Try splitting by common separators
  const separators = [
    /[,،]+/,       // commas
    /←|→|↔|⇒|⇔|->|<-|➜|➤/,  // arrows
    /\n+/,          // newlines
    /[;؛]+/,        // semicolons
    /\d+\.\s/,      // numbered lists (1. 2. 3.)
    /[-•●◦▪]\s/,    // bullet points
  ];

  let bestSplit: string[] = [text];

  for (const sep of separators) {
    const parts = text.split(sep).map(s => s.trim()).filter(s => s.length > 1);
    if (parts.length > bestSplit.length) {
      bestSplit = parts;
    }
  }

  // If we only found 1 part, try splitting by Hebrew "ו" conjunctions or colons
  if (bestSplit.length <= 2) {
    // Try colon split first (title: items)
    const colonParts = text.split(/[:：]/).map(s => s.trim()).filter(s => s.length > 1);
    if (colonParts.length >= 2) {
      // Re-split the part after colon
      const afterColon = colonParts.slice(1).join(" ");
      const subParts = afterColon.split(/[,،]+/).map(s => s.trim()).filter(s => s.length > 1);
      if (subParts.length > bestSplit.length) {
        bestSplit = subParts;
      }
    }
  }

  // Limit to 12
  return bestSplit.slice(0, 12);
}

const toTemplateId = (value: unknown): TemplateId | null => {
  if (typeof value !== "string") return null;
  return value in TEMPLATE_INSTRUCTIONS ? (value as TemplateId) : null;
};

const enforceNodeSizes = (nodes: DiagramNode[]) => {
  nodes.forEach((node, i) => {
    if (i === 0) {
      node.width = Math.max(node.width, 170);
      node.height = Math.max(node.height, 75);
    } else {
      node.width = 130;
      node.height = 64;
    }
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
    const key = `${connection.from}->${connection.to}`;
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
        for (let i = 0; i < loop.length - 1; i++) {
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
      const maxCols = Math.max(2, Math.floor((800 - 120 + minGapX) / (130 + minGapX)));
      const rows = Math.ceil(n / maxCols);
      let cursor = 0;
      for (let row = 0; row < rows; row++) {
        const count = Math.min(maxCols, n - cursor);
        const rowWidth = count * 130 + (count - 1) * minGapX;
        const startX = (800 - rowWidth) / 2;
        const y = 120 + row * 130;
        for (let col = 0; col < count; col++) {
          const visualCol = row % 2 === 0 ? col : count - col - 1;
          const node = nodes[cursor];
          node.x = startX + visualCol * (130 + minGapX);
          node.y = y;
          node.type = cursor === 0 || cursor === n - 1 ? "ellipse" : "rectangle";
          cursor++;
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
      nodes.forEach((node, i) => {
        if (i === 0) {
          node.x = centerX - node.width / 2;
          node.y = centerY - node.height / 2;
          node.type = "ellipse";
          return;
        }
        const count = n - 1;
        const angle = ((i - 1) / count) * Math.PI * 2 - Math.PI / 2;
        const radiusX = 170 + Math.min(count, 6) * 10;
        const radiusY = 140 + Math.min(count, 6) * 8;
        node.x = centerX + radiusX * Math.cos(angle) - node.width / 2;
        node.y = centerY + radiusY * Math.sin(angle) - node.height / 2;
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
        for (let j = 0; j < itemsInRow && currentIndex < n; j++) {
          const node = nodes[currentIndex];
          node.x = startX + j * (130 + 22);
          node.y = y;
          node.type = row === 1 ? "diamond" : "rectangle";
          currentIndex++;
        }
        row++;
      }
      diagram.type = "comparison";
      break;
    }

    case "funnel": {
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

// Tool calling for AI auto-select
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
            description: "The template that best fits the content structure.",
          },
          colorTheme: {
            type: "string",
            enum: Object.keys(COLOR_THEMES),
            description: "The color theme that best matches the content mood.",
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

function buildSystemPrompt(conceptCount: number, concepts: string[]): string {
  const conceptList = concepts.map((c, i) => `  ${i + 1}. "${c}"`).join("\n");

  return `You are an expert infographic designer. Given text, return a JSON object describing a diagram.

ABSOLUTE RULE — YOU MUST CREATE EXACTLY ${conceptCount} NODES:
The user's text contains these ${conceptCount} distinct concepts:
${conceptList}

You MUST create exactly ${conceptCount} nodes — one for each concept above. Do NOT merge, skip, or summarize any concept.

LABELS:
- Each node label: 1-3 words MAX (the SHORT version of each concept)
- Title: 2-4 words, catchy
- Detect language: if Hebrew input, ALL labels and title MUST be in Hebrew
- "תשתית יציבה בבסיס" → "תשתית"
- "User Experience Design" → "UX"

SIZING:
- First/main node: width 180-220, height 80-100
- Other nodes: width 130-160, height 60-70
- Canvas: width 800, height 600

CONNECTIONS:
- Every connection SHOULD have a short label (1-2 words) explaining the relationship
- Connections form a logical flow matching the content

Return ONLY valid JSON, no markdown, no backticks:
{
  "title": "string",
  "type": "flowchart" | "mindmap" | "list" | "comparison" | "process",
  "nodes": [
    { "id": "string", "type": "rectangle"|"ellipse"|"diamond"|"circle"|"hexagon", "x": number, "y": number, "width": number, "height": number, "label": "string" }
  ],
  "connections": [
    { "from": "node_id", "to": "node_id", "label": "string" }
  ],
  "width": 800,
  "height": 600
}`;
}

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
    const concepts = extractConcepts(text);
    const conceptCount = Math.max(3, concepts.length);

    console.info("generate-diagram request", {
      mode,
      rawTemplateId,
      userTemplateId,
      conceptCount,
      concepts,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: If no template, let AI auto-select
    let templateId = userTemplateId;
    let suggestedColorTheme: string | null = null;

    if (!templateId) {
      const styleController = new AbortController();
      const styleTimeout = setTimeout(() => styleController.abort(), 15000);

      try {
        const styleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: styleController.signal,
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are a visual design expert. Analyze the text and select the best diagram template and color theme." },
              { role: "user", content: `Analyze this text and select the best visual template and color theme:\n\n${text}` },
            ],
            tools: autoSelectTools,
            tool_choice: { type: "function", function: { name: "select_style" } },
            temperature: 0.3,
          }),
        });

        if (styleResponse.ok) {
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
        }
      } catch (e) {
        console.warn("Style selection timed out or failed, using defaults:", e);
      } finally {
        clearTimeout(styleTimeout);
      }

      if (!templateId) templateId = "radial";
      if (!suggestedColorTheme) suggestedColorTheme = "default";
    }

    // Step 2: Generate diagram content
    const modeInstruction = mode === "creative"
      ? "Be creative and expand on the ideas. Add related concepts."
      : "Stay close to the original text. Use the exact terms.";

    const templateInstruction = templateId
      ? `Template: '${templateId}'. ${TEMPLATE_INSTRUCTIONS[templateId as string]}`
      : "";

    const systemPrompt = buildSystemPrompt(conceptCount, concepts);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${modeInstruction}\n\n${templateInstruction}\n\nCreate a diagram with EXACTLY ${conceptCount} nodes for:\n\n${text}`,
          },
        ],
        temperature: mode === "creative" ? 0.7 : 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleanJson = content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const diagramData = JSON.parse(cleanJson) as DiagramResponse;

    if (!diagramData.nodes || !Array.isArray(diagramData.nodes)) {
      return new Response(JSON.stringify({ error: "Invalid diagram structure from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VALIDATION: If AI returned fewer nodes than concepts, pad with missing concepts
    if (diagramData.nodes.length < conceptCount) {
      console.warn(`AI returned ${diagramData.nodes.length} nodes, expected ${conceptCount}. Padding...`);
      const existingLabels = new Set(diagramData.nodes.map(n => n.label.toLowerCase()));
      
      for (let i = diagramData.nodes.length; i < conceptCount; i++) {
        const concept = concepts[i];
        if (concept && !existingLabels.has(concept.toLowerCase())) {
          // Shorten concept to 1-3 words
          const shortLabel = concept.split(/\s+/).slice(0, 3).join(" ");
          diagramData.nodes.push({
            id: `node_pad_${i}`,
            type: "rectangle",
            x: 100 + (i % 4) * 170,
            y: 120 + Math.floor(i / 4) * 120,
            width: 130,
            height: 64,
            label: shortLabel,
          });
        }
      }
    }

    diagramData.width = diagramData.width || 800;
    diagramData.height = diagramData.height || 600;

    // Apply template layout (repositions ALL nodes according to template)
    applyTemplateLayout(diagramData, templateId);

    console.info(`Final diagram: ${diagramData.nodes.length} nodes, template=${templateId}`);

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
