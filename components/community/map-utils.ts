export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; pin: string }> = {
    "Neighborhood": { bg: "bg-blue-500/15", text: "text-blue-500", border: "border-blue-500/30", pin: "#3b82f6" },
    "Environment": { bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", pin: "#10b981" },
    "Education": { bg: "bg-violet-500/15", text: "text-violet-500", border: "border-violet-500/30", pin: "#8b5cf6" },
    "Arts & Culture": { bg: "bg-pink-500/15", text: "text-pink-500", border: "border-pink-500/30", pin: "#ec4899" },
    "Sports & Recreation": { bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30", pin: "#f97316" },
    "Safety & Watch": { bg: "bg-red-500/15", text: "text-red-500", border: "border-red-500/30", pin: "#ef4444" },
    "Local Business": { bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/30", pin: "#f59e0b" },
    "Tech & Innovation": { bg: "bg-cyan-500/15", text: "text-cyan-500", border: "border-cyan-500/30", pin: "#06b6d4" },
    "Health & Wellness": { bg: "bg-lime-500/15", text: "text-lime-500", border: "border-lime-500/30", pin: "#84cc16" },
    "Other": { bg: "bg-slate-500/15", text: "text-slate-500", border: "border-slate-500/30", pin: "#64748b" },
};

export const CATEGORIES = Object.keys(CATEGORY_COLORS);

export function getCategoryStyle(cat: string) {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"];
}
