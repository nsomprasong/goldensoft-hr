import { redirect } from "next/navigation";

/** Legacy menu path — compensation lives on the employee profile; pay items replaced this nav. */
export default function CompensationPage() {
  redirect("/hr/pay-items");
}
