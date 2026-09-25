import {
  filterActivitiesByCategory,
  formatActivityLabel,
  getActivityCategories,
} from "./activityUtils";

test("activity categories include supported tabs and new backend types", () => {
  const categories = getActivityCategories([
    { type: "login" },
    { type: "custom_type" },
  ]);

  expect(categories).toEqual(expect.arrayContaining([
    "login",
    "security",
    "academic",
    "question_set",
    "custom_type",
  ]));
});

test("activity filtering supports all and individual categories", () => {
  const activities = [
    { id: 1, type: "login" },
    { id: 2, type: "academic" },
    { id: 3, type: "login" },
  ];

  expect(filterActivitiesByCategory(activities, "all")).toHaveLength(3);
  expect(filterActivitiesByCategory(activities, "login").map((item) => item.id)).toEqual([1, 3]);
  expect(filterActivitiesByCategory(activities, "export")).toEqual([]);
});

test("activity labels are readable", () => {
  expect(formatActivityLabel("question_set")).toBe("Question Set");
});
