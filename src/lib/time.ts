import { cache } from "react";

/** A single timestamp per server request, so every relative time on a page agrees. */
export const getRequestNow = cache(() => Date.now());
