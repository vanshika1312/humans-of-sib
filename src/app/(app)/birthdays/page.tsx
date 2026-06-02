import { redirect } from "next/navigation";

/** Legacy route — Celebrations lives at `/celebrations`. */
export default function BirthdaysRedirect() {
  redirect("/celebrations");
}
