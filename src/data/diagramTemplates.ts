import {
  Layers,
  ArrowRight,
  Diamond,
  Puzzle,
  Orbit,
  Wind,
  Infinity,
  Pyramid,
  Filter,
  Clock,
  Hexagon,
  CircleDot,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export type DiagramTemplateId =
  | "stacked"
  | "arrow"
  | "diamond"
  | "puzzle"
  | "radial"
  | "pinwheel"
  | "eight"
  | "pyramid"
  | "funnel"
  | "timeline"
  | "hexagon"
  | "venn"
  | "cycle";

export interface DiagramTemplate {
  id: DiagramTemplateId;
  name: string;
  description: string;
  icon: LucideIcon;
  sampleText: string;
}

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: "stacked",
    name: "Stacked",
    icon: Layers,
    description: "שכבות מסר מדורגות מלמעלה למטה",
    sampleText:
      "תוכנית מוצר: חזון (למה), אסטרטגיה (איך), יוזמות (מה), מדדים (איך נמדוד הצלחה)",
  },
  {
    id: "arrow",
    name: "Arrow",
    icon: ArrowRight,
    description: "תהליך לינארי עם כיוון ברור קדימה",
    sampleText:
      "קליטת לקוח חדש: יצירת ליד → שיחת היכרות → הצעת מחיר → אישור → הטמעה → מעקב",
  },
  {
    id: "diamond",
    name: "Diamond",
    icon: Diamond,
    description: "מבנה החלטות סביב נקודת ליבה",
    sampleText:
      "האם להשיק פיצ'ר: ערך ללקוח? עלות פיתוח? סיכון טכני? אם רוב התשובות חיוביות: משיקים",
  },
  {
    id: "puzzle",
    name: "Puzzle",
    icon: Puzzle,
    description: "רכיבים משלימים שיוצרים תמונה אחת",
    sampleText:
      "מרכיבי הצלחת צוות: אנשים נכונים, תהליך ברור, תקשורת פתוחה, יעדים מדידים, משוב רציף",
  },
  {
    id: "radial",
    name: "Radial",
    icon: Orbit,
    description: "רעיון מרכזי עם ענפים היקפיים",
    sampleText:
      "אסטרטגיית שיווק 2026: מותג, תוכן, קהילה, שיתופי פעולה, פרפורמנס, מדידה",
  },
  {
    id: "pinwheel",
    name: "Pinwheel",
    icon: Wind,
    description: "ספירלה/סיבוב של שלבים סביב מרכז",
    sampleText:
      "מחזור פיתוח: מחקר משתמשים → אפיון → עיצוב → פיתוח → בדיקות → למידה וחזרה למחקר",
  },
  {
    id: "eight",
    name: "Eight",
    icon: Infinity,
    description: "שני מעגלים מחוברים בסגנון אינסוף",
    sampleText:
      "צמיחה מתמשכת: רכישת משתמשים ↔ שימור משתמשים, כשכל צד מזין את השני",
  },
  {
    id: "pyramid",
    name: "Pyramid",
    icon: Pyramid,
    description: "היררכיה ברורה משכבת בסיס לפסגה",
    sampleText:
      "פירמידת ערך מוצר: תשתית יציבה בבסיס, UX באמצע, בידול עסקי בפסגה",
  },
  {
    id: "funnel",
    name: "Funnel",
    icon: Filter,
    description: "משפך - רחב למעלה וצר למטה, סינון שלבים",
    sampleText:
      "משפך מכירות: 1000 מבקרים → 200 לידים → 50 פגישות → 15 הצעות → 5 עסקאות",
  },
  {
    id: "timeline",
    name: "Timeline",
    icon: Clock,
    description: "ציר זמן עם אירועים לסירוגין",
    sampleText:
      "אבני דרך 2026: Q1 השקה, Q2 גיוס, Q3 התרחבות, Q4 רווחיות",
  },
  {
    id: "hexagon",
    name: "Hexagon",
    icon: Hexagon,
    description: "רשת משושים בסגנון כוורת",
    sampleText:
      "מיומנויות מפתח: מנהיגות, תקשורת, חשיבה אנליטית, יצירתיות, עבודת צוות, גמישות",
  },
  {
    id: "venn",
    name: "Venn",
    icon: CircleDot,
    description: "עיגולים חופפים שמראים קשרים בין קבוצות",
    sampleText:
      "איקיגאי: מה שאתה אוהב, מה שאתה טוב בו, מה שהעולם צריך, מה שמשלמים עליו",
  },
  {
    id: "cycle",
    name: "Cycle",
    icon: RefreshCw,
    description: "תהליך מחזורי שחוזר על עצמו",
    sampleText:
      "מחזור למידה: תכנון → ביצוע → מדידה → למידה → שיפור → חזרה לתכנון",
  },
];
