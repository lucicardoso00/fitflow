/** The browser's only entry point for workout plans. */
export async function fetchPlan(choices, signal) {
  const query = new URLSearchParams({
    parts: choices.parts.join(','),
    minutes: choices.minutes,
    equipment: choices.equipment,
  });
  const response = await fetch(`/v1/plan?${query}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Could not load your plan.');
  return data.plan;
}
