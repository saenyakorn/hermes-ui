import { hydrateRoot } from "react-dom/client";
import { WorkspaceTabs } from "../server/ui/workspace-tabs";

const root = document.getElementById("workspace-tabs-root");
if (root) {
  hydrateRoot(root, <WorkspaceTabs />);
}
