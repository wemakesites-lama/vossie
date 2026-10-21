import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { formStatesContract } from "./form-states.contract";

// One-time tokens on the local stack (C4/C5 plan Task 2): takeFormState's twin calls take_form_state with the viewer's
// session, whose claims are the world account's.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("one-time tokens on the local stack (C4/C5 plan Task 2)", () => {
  formStatesContract(supabaseWorld);
});
