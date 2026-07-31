import type { ChangeEvent } from "react";

/** Forces an input's value to uppercase as the user types, in place. */
export const uppercaseOnChange = (e: ChangeEvent<HTMLInputElement>) => {
  e.target.value = e.target.value.toUpperCase();
};
