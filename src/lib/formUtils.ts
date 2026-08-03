import type { ChangeEvent } from "react";

/** Normalizes a pump model input as the user types: uppercase, no hyphens. */
export const normalizeModelOnChange = (e: ChangeEvent<HTMLInputElement>) => {
  e.target.value = e.target.value.toUpperCase().replace(/-/g, "");
};
