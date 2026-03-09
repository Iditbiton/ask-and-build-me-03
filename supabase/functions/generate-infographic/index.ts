import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Available AntV Infographic templates organized by data type
const TEMPLATE_MAP = {
  list: [
    "list-row-simple-horizontal-arrow",
    "list-row-horizontal-icon-arrow",
    "list-grid-compact-card",
    "list-row-simple-vertical",
    "list-column-simple",
    "list-grid-icon-card",
    "list-row-simple-horizontal-number",
  ],
  sequence: [
    "sequence-steps-simple",
    "sequence-stairs-front-pill-badge",
    "sequence-steps-card",
    "sequence-snake-horizontal-card",
    "sequence-timeline-horizontal",
    "sequence-timeline-vertical",
  ],
  comparison: [
    "compare-binary-card",
    "compare-binary-simple",
    "compare-swot-card",
    "compare-quadrant-simple",
  ],
  hierarchy: [
    "hierarchy-mindmap-right",
    "hierarchy-mindmap-lr",
    "hierarchy-org-chart",
    "hierarchy-tree-vertical",
  ],
  relation: [
    "relation-dagre-flow-tb-simple-circle-node",
    "relation-dagre-flow-lr-card",
    "relation-radial-simple",
    "relation-cycle-simple",
  ],
  chart: [
    "chart-pie-simple",
    "chart-bar-simple",
    "chart-column-simple",
    "chart-line-simple",
  ],
};

const ALL_TEMPLATES = Object.values(TEMPLATE_MAP).flat();

const SYSTEM_PROMPT = `You are an expert infographic designer. Given text, generate AntV Infographic syntax.

AntV Infographic syntax format:
\`\`\`
infographic <template-name>
data
  title <title text>
  desc <description>
  lists
    - label <item label>
      desc <item description>
      value <number if applicable>
      icon <icon-keyword>
\`\`\`

DATA TYPES by template prefix:
- list-*: Use "lists" field with label, desc, icon
- sequence-*: Use "sequences" field with label, desc  
- compare-*: Use "lists" field split into groups
- hierarchy-*: Use "root" with "children" (recursive)
- relation-*: Use "nodes" with "relations" (from, to)
- chart-*: Use "lists" with label, value

RULES:
1. Return ONLY the infographic syntax, no markdown, no backticks, no explanation
2. Detect the INPUT language. If Hebrew, ALL labels/title/desc MUST be in Hebrew
3. Labels should be SHORT (1-4 words)
4. Descriptions should be one concise sentence
5. Choose the most appropriate template from the available list
6. Use 3-8 items max
7. Add relevant icons using simple keywords (e.g., rocket, chart-line, users, target, etc.)

AVAILABLE TEMPLATES:
${ALL_TEMPLATES.join(", ")}

Choose the template that BEST matches the content structure:
- Linear process/steps → sequence-*
- Feature list/capabilities → list-*
- Pros/cons/comparison → compare-*
- Org chart/tree → hierarchy-*
- Flow/relationships → relation-*
- Data with numbers → chart-*`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
            content: `Generate an AntV Infographic syntax for the following text. Choose the best template and structure:\n\n${text}`,
          },
        ],
        temperature: 0.4,
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

    // Clean up: remove markdown code blocks if present
    let syntax = content.trim();
    if (syntax.startsWith("```")) {
      syntax = syntax.replace(/^```(?:infographic|text)?\n?/, "").replace(/\n?```$/, "");
    }

    console.info("Generated AntV syntax:", syntax.substring(0, 200));

    return new Response(JSON.stringify({ syntax }), {
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
