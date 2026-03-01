export const LEVELS = [
  { name: "Rookie", min: 0, max: 4 },
  { name: "Challenger", min: 5, max: 14 },
  { name: "Warrior", min: 15, max: 29 },
  { name: "Beast Mode", min: 30, max: Infinity }
];

export function levelForTotal(totalWorkoutsCompleted) {
  const n = Number(totalWorkoutsCompleted || 0);
  for (const lvl of LEVELS) {
    if (n >= lvl.min && n <= lvl.max) return lvl.name;
  }
  return "Rookie";
}

export function nextLevelInfo(totalWorkoutsCompleted) {
  const n = Number(totalWorkoutsCompleted || 0);
  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = LEVELS[i];
    if (n >= lvl.min && n <= lvl.max) {
      const next = LEVELS[i + 1];
      if (!next) return { current: lvl.name, next: null, remaining: 0 };
      return { current: lvl.name, next: next.name, remaining: Math.max(0, next.min - n) };
    }
  }
  return { current: "Rookie", next: "Challenger", remaining: 5 };
}
