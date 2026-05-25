import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { nominateWin } from "../actions";
import type { WinWallData } from "../_lib/win-wall-data";

const CATEGORIES = [
  { value: "LEARNING", label: "Learning" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "SALES", label: "Sales" },
  { value: "INNOVATION", label: "Innovation" },
];

const REWARD_PILLS = [
  { value: "CASH", label: "Cash reward" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "CASH_AND_CERTIFICATE", label: "Cash + Certificate" },
  { value: "VOUCHER", label: "Gift voucher" },
  { value: "SHOUTOUT", label: "Public shoutout" },
];

export function WinNominateForm({ members }: { members: WinWallData["members"] }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2 uppercase tracking-wide text-xs">
          <span className="text-orange-500" aria-hidden>
            ■
          </span>
          Nominate a win
        </h3>
        <form action={nominateWin} className="space-y-4">
          <div>
            <Label htmlFor="nom-userId">Team member</Label>
            <Select id="nom-userId" name="userId" required defaultValue="">
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
          <div>
            <Label htmlFor="nom-category">Win category</Label>
            <Select id="nom-category" name="category" required defaultValue="">
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
            <Label htmlFor="nom-title">Win title</Label>
            <Input id="nom-title" name="title" required placeholder="e.g. Highest demo conversion in Q1" />
          </div>
          <div>
            <Label htmlFor="nom-description">Tell us more</Label>
            <Textarea
              id="nom-description"
              name="description"
              rows={4}
              placeholder="Describe the win and its impact on the team or company…"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-ink-700 mb-2">Reward type</legend>
            <div className="flex flex-wrap gap-2">
              {REWARD_PILLS.map((r, i) => (
                <label
                  key={r.value}
                  className="inline-flex items-center px-3 py-2 rounded-full border text-sm cursor-pointer has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50 has-[:checked]:text-orange-900 border-ink-200 text-ink-600"
                >
                  <input
                    type="radio"
                    name="rewardType"
                    value={r.value}
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="nom-rewardAmount">Suggested amount (₹, optional)</Label>
            <Input id="nom-rewardAmount" name="rewardAmount" type="number" min={0} placeholder="500" />
          </div>
          <Button type="submit" variant="accent" className="w-full">
            Submit &amp; celebrate ↑
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
