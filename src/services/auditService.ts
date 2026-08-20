import apiClient from "./apiClient";
import { getToken } from "./session";

/** Fire-and-forget page-view beat -- never blocks or throws into the caller,
 * this is telemetry for the Audit Log's Usage & Time tab, not a real action. */
export const recordPageView = (path: string): void => {
  const token = getToken();
  if (!token) return;
  apiClient.post("/audit/pageview", { path }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
};
