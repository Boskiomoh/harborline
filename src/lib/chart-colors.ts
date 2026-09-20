// Chart fills derived from the brand accents, validated with the dataviz palette validator
// (light mode, #FFFFFF surface): lightness band, chroma floor, adjacent CVD separation and
// normal-vision floor all pass. The PRD's UI tokens (#0E5C4C teal, #C1571F coral) are too
// dark / low-chroma for large chart fills, so charts use these steps of the same hues.
// Amber sits below 3:1 against the surface, so every chart ships a legend and a table view.

/** Stack order bottom to top is resolved, waiting, in progress, new: each adjacent pair was validated. */
export const STATUS_CHART_COLORS = {
  new_count: "#D09A2C",
  in_progress_count: "#23A383",
  waiting_count: "#D4602A",
  resolved_count: "#00806A",
} as const;

export const CATEGORY_CHART_COLORS = {
  open_count: "#D4602A",
  resolved_count: "#00806A",
} as const;

export const CHART_CHROME = {
  grid: "#EFE7D8",
  axis: "#E4D9C3",
  tick: "#5B4E3F",
  surface: "#FFFFFF",
} as const;
