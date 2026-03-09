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
};

type TemplateId = keyof typeof TEMPLATE_INSTRUCTIONS;

type DiagramType = "flowchart" | "mindmap" | "list" | "comparison" | "process";

type DiagramNode = {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "circle";
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
};

const SYSTEM_PROMPT = `You are an expert diagram designer. Given text describing an idea, process, comparison, or concept, you MUST return a JSON object that describes a visual diagram.

RULES:
- Return ONLY valid JSON, no markdown, no backticks, no explanation
- The diagram should fit within the given canvas dimensions
- Position nodes logically based on the diagram type and requested template instruction
- If a specific template instruction is provided by the user prompt, you MUST follow it
- Use descriptive short labels (1-4 words max per label)
- Ensure nodes don't overlap
- Canvas dimensions: width 800, height 600
- Leave 60px top margin for the title
- Space nodes with at least 30px between them
- CRITICAL: Detect the language of the input text. If the text is in Hebrew, ALL labels and the title MUST be in Hebrew. If in English, use English. Always match the language of the input.

JSON Schema:
{
  "title": "string - a short title for the diagram (in the SAME language as input)",
  "type": "flowchart" | "mindmap" | "list" | "comparison" | "process",
  "nodes": [
    {
      "id": "string",
      "type": "rectangle" | "ellipse" | "diamond" | "circle",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "label": "string (in the SAME language as input)"
    }
  ],
  "connections": [
    {
      "from": "node_id",
      "to": "node_id",
      "label": "optional string (in the SAME language as input)"
    }
  ],
  "width": 800,
  "height": 600
}

Diagram type guidelines:
- flowchart: Use rectangles for steps, diamonds for decisions, connect with arrows
- mindmap: Central ellipse with surrounding rectangles/circles branching out
- list: Vertical stack of rectangles
- comparison: Side-by-side columns with rectangles
- process: Horizontal or vertical chain of rectangles with arrows

Choose the most appropriate diagram type based on the content. Use a mix of shapes for visual interest.`;

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
      return createSequentialConnections(nodes);

    case "diamond":
    case "radial":
      return createStarConnections(nodes);

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
  }

  clampToCanvas(nodes);
  diagram.connections = dedupeConnections(buildTemplateConnections(nodes, templateId));
};

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

    const templateId = toTemplateId(rawTemplateId);
    console.info("generate-diagram request", { mode, rawTemplateId, templateId });
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modeInstruction = mode === "creative"
      ? "Be creative and expand on the ideas. Add related concepts, elaborate on connections, and make the diagram richer than the literal text. Think of what the user might have meant and add value."
      : "Stay as close as possible to the original text. Use the exact terms and structure from the text. Do not add concepts that are not explicitly mentioned.";

    const templateInstruction = templateId
      ? `Template style is '${templateId}'. ${TEMPLATE_INSTRUCTIONS[templateId]}`
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
