export const ACTIVITY_CATEGORIES = [
  "login",
  "security",
  "user",
  "upload",
  "generate",
  "academic",
  "classify",
  "question",
  "question_set",
  "review",
  "export",
  "delete",
];

export const getActivityCategories = (activities = []) => [...new Set([
  ...ACTIVITY_CATEGORIES,
  ...activities.map((activity) => activity.type || "other"),
])];

export const filterActivitiesByCategory = (activities = [], category = "all") => (
  category === "all"
    ? activities
    : activities.filter((activity) => (activity.type || "other") === category)
);

export const formatActivityLabel = (value) => String(value || "other")
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
