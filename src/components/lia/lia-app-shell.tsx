import { isLiaEnabled } from "@/lib/lia-config";
import { LiaFloatingAssistant } from "./lia-floating-assistant";

export function LiaAppShell() {
  if (!isLiaEnabled()) return null;
  return <LiaFloatingAssistant />;
}
