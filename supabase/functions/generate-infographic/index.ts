import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Layout instructions per template — guides the AI to produce the right visual structure.
 */
const TEMPLATE_LAYOUTS: Record<string, string> = {
  stacked: `LAYOUT: Vertical stacked cards/layers from top to bottom. Each layer is a full-width rounded rectangle, stacked with slight spacing. Use decreasing opacity or color intensity from top to bottom. Great for hierarchies or priorities.`,
  arrow: `LAYOUT: Horizontal arrow/chevron flow from right to left (RTL) or left to right. Use chevron-shaped elements or arrow-connected boxes in a linear sequence. Each step flows into the next with arrow connectors. Great for processes and workflows.`,
  diamond: `LAYOUT: Diamond/decision layout. Place a central diamond shape with 4 branches radiating to corners. The center holds the main question/concept, corners hold related factors or outcomes. Great for decision frameworks.`,
  puzzle: `LAYOUT: Puzzle/jigsaw layout. Create interlocking pieces that form a complete picture. Each piece is a rounded shape that visually connects to its neighbors. Use varied colors per piece. Great for showing complementary components.`,
  radial: `LAYOUT: Radial/hub-and-spoke layout. Place a large central circle with the main concept, surrounded by smaller circles or cards connected by lines radiating outward. Great for mind maps or central-theme breakdowns.`,
  pinwheel: `LAYOUT: Pinwheel/spiral layout. Arrange elements in a spiral or windmill pattern around a center point. Each element fans out at an angle. Great for cyclical processes or interconnected themes.`,
  eight: `LAYOUT: Figure-eight / infinity loop layout. Create two connected circular flows (like an ∞ symbol). The left loop and right loop each contain items, meeting at a central intersection point. Great for showing two reinforcing cycles.`,
  pyramid: `LAYOUT: Pyramid/triangle layout. Build a triangle from base to apex with horizontal layers. The base is widest (foundational) and the top is narrow (pinnacle). Use 3-5 layers. Great for hierarchies like Maslow's or value pyramids.`,
  funnel: `LAYOUT: Funnel layout. Create a wide top section that narrows progressively downward. Each stage is a trapezoid/rectangle that gets smaller. Show numbers or percentages decreasing. Great for sales funnels or filtering processes.`,
  timeline: `LAYOUT: Timeline layout. Create a horizontal or vertical line with alternating event markers (dots/circles) on both sides. Events zigzag above and below the line. Include dates or stage labels. Great for chronological sequences.`,
  hexagon: `LAYOUT: Hexagonal grid/honeycomb layout. Arrange hexagon shapes in a honeycomb pattern. Each hexagon contains one concept. Hexagons touch edges to show connections. Great for competencies, features, or equal-weight items.`,
  venn: `LAYOUT: Venn diagram layout. Create 2-3 overlapping circles with semi-transparent fills. Label each circle and the overlapping regions. Great for showing relationships, commonalities, and differences between concepts.`,
  cycle: `LAYOUT: Circular cycle layout. Arrange elements in a circle with curved arrows connecting each to the next, forming a continuous loop. Great for iterative processes, feedback loops, or recurring phases.`,
};

const BASE_SYSTEM_PROMPT = `You are an expert infographic designer. Generate a complete, self-contained SVG infographic from the given text.

CRITICAL RULES:
1. Return ONLY valid SVG markup. Start with <svg> and end with </svg>. NO markdown, NO explanation.
2. SVG dimensions: width="800" height="600" viewBox="0 0 800 600"
3. Detect input language. If Hebrew/Arabic, use dir="rtl" and text-anchor="end" for text, and place text right-aligned.
4. Use modern, clean, professional design with:
   - Rounded rectangles with soft shadows
   - A harmonious color palette (blues, teals, warm accents)
   - Clear visual hierarchy: large bold title, medium subtitles, smaller body text
   - Icons represented as simple geometric shapes or emoji characters
   - Connecting lines, arrows, or visual flow between elements
5. Font: Use sans-serif fonts. For Hebrew use 'Segoe UI', 'Arial', sans-serif.
6. Include a background (subtle gradient or solid light color).
7. Make it visually rich: use gradients, rounded corners (rx="12"), subtle drop shadows via <filter>.
8. Text MUST be inside the shapes, properly centered and sized to fit.
9. Use 4-8 content items maximum. Labels should be 1-4 words. Descriptions 1 short sentence.
10. IMPORTANT: You can also create a HAND-DRAWN / SKETCH style if instructed. For sketch style:
    - Use slightly irregular shapes (not perfectly aligned)
    - Add hand-drawn style strokes (stroke-dasharray, slight rotations, imperfect lines)
    - Use a warm, notebook-like background (#faf8f0 or similar)
    - Handwriting-style fonts or playful styling
    - Doodle-like icons and connectors

EXAMPLE SVG STRUCTURE:
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#f0f4f8"/>
      <stop offset="100%" style="stop-color:#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)" rx="0"/>
  <text x="400" y="50" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#1a365d">Title Here</text>
  <rect x="50" y="80" width="320" height="100" rx="12" fill="white" filter="url(#shadow)"/>
  <rect x="58" y="80" width="6" height="100" rx="3" fill="#3182ce"/>
  <text x="80" y="120" font-family="sans-serif" font-size="18" font-weight="bold" fill="#2d3748">Label</text>
  <text x="80" y="145" font-family="sans-serif" font-size="14" fill="#718096">Description text here</text>
</svg>

Make the infographic BEAUTIFUL and PROFESSIONAL. Use color coding, visual grouping, and clear information hierarchy.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, templateId } = await req.json();
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

    // Build system prompt with optional template layout
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (templateId && TEMPLATE_LAYOUTS[templateId]) {
      systemPrompt += `\n\n--- SELECTED TEMPLATE ---\n${TEMPLATE_LAYOUTS[templateId]}\nYou MUST follow this layout structure. Arrange the content items according to this specific layout pattern.`;
    }

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
            content: `Create a beautiful SVG infographic from this text. Return ONLY the SVG code:\n\n${text}`,
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

    // Extract SVG from response
    let svg = content.trim();
    
    // Remove markdown code blocks if present
    if (svg.startsWith("```")) {
      svg = svg.replace(/^```(?:svg|xml|html)?\n?/, "").replace(/\n?```$/, "");
    }
    
    // Extract just the SVG tag
    const svgStart = svg.indexOf("<svg");
    const svgEnd = svg.lastIndexOf("</svg>");
    if (svgStart !== -1 && svgEnd !== -1) {
      svg = svg.substring(svgStart, svgEnd + 6);
    }

    if (!svg.includes("<svg")) {
      console.error("No valid SVG in response:", svg.substring(0, 200));
      return new Response(JSON.stringify({ error: "Failed to generate valid SVG" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info("Generated SVG infographic, length:", svg.length, "template:", templateId || "auto");

    return new Response(JSON.stringify({ svg }), {
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
