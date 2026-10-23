import type { ViewerActivity } from "@/lib/types";

// Sample activity for the signed-in context strip (spec 7.4), shown only behind the development switch.
export const sampleActivity: ViewerActivity = { newMessages: 2, salesToConfirm: 1, newNotifications: 1 };
