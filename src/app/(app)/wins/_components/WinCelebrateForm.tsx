import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { celebrateWin } from "../actions";
import type { WinWallData } from "../_lib/win-wall-data";

const CATEGORIES = [
  { value: "LEARNING", label: "Learning" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "SALES", label: "Sales" },
  { value: "INNOVATION", label: "Innovation" },
];

const REWARDS = [
  { value: "CASH", label: "Cash reward" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "CASH_AND_CERTIFICATE", label: "Cash + Certificate" },
  { value: "VOUCHER", label: "Gift voucher" },
  { value: "SHOUTOUT", label: "Public shoutout" },
  { value: "NONE", label: "Recognition only" },
];

export function WinCelebrateForm({
  members,
  title = "Celebrate a win",
}: {
  members: WinWallData["members"];
  title?: string;
}) {
  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardContent className="pt-5">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2">
          <span className="text-orange-500" aria-hidden>
            ■
          </span>
          {title}
        </h3>
        <form action={celebrateWin} className="space-y-4">
          <div>
            <Label htmlFor="celebrate-userId">Team member</Label>
            <Select id="celebrate-userId" name="userId" required defaultValue="">
              <option value="" disabled>
                Select a member…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? "Unnamed"}
                  {m.department ? ` · ${m.department.name}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="celebrate-category">Win category</Label>
              <Select id="celebrate-category" name="category" required defaultValue="">
                <option value="" disabled>
                  Select category…
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="celebrate-rewardType">Reward type</Label>
              <Select id="celebrate-rewardType" name="rewardType" defaultValue="CASH">
                {REWARDS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="celebrate-title">Win title</Label>
            <Input
              id="celebrate-title"
              name="title"
              required
              placeholder="e.g. Highest demo conversion in Q1"
            />
          </div>
          <div>
            <Label htmlFor="celebrate-description">Tell us more</Label>
            <Textarea
              id="celebrate-description"
              name="description"
              rows={3}
              placeholder="Describe the win and its impact on the team or company…"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="celebrate-rewardAmount">Reward amount (₹, optional)</Label>
              <Input id="celebrate-rewardAmount" name="rewardAmount" type="number" min={0} placeholder="5000" />
            </div>
            <div>
              <Label htmlFor="celebrate-rewardLabel">Custom reward label (optional)</Label>
              <Input id="celebrate-rewardLabel" name="rewardLabel" placeholder="₹5,000 cash reward" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" name="setSpotlight" value="on" className="rounded border-ink-300" />
            Set as spotlight of the month
          </label>
          <Button type="submit" variant="accent" className="w-full sm:w-auto">
            Celebrate &amp; publish ↑
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
