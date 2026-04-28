import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { submitCeoFeedback } from "../actions";

export default function NewCeoFeedbackPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Message the CEO" emoji="📣" subtitle="Ideas, concerns, kudos. Sign your name or stay anonymous — both are welcome." />

      <Card>
        <CardContent className="pt-6">
          <form action={submitCeoFeedback} className="space-y-4">
            <div>
              <Label htmlFor="category">Type</Label>
              <Select id="category" name="category" defaultValue="IDEA" required>
                <option value="IDEA">💡 Idea</option>
                <option value="CONCERN">⚠️ Concern</option>
                <option value="KUDOS">🙌 Kudos</option>
                <option value="BUG">🐛 Issue / bug</option>
                <option value="PROCESS">⚙️ Process</option>
                <option value="OTHER">📝 Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required maxLength={200} placeholder="What's this about?" />
            </div>
            <div>
              <Label htmlFor="message">Your message</Label>
              <Textarea id="message" name="message" required minLength={10} maxLength={5000} rows={8} placeholder="Say what you need to say. No fluff needed." />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-ink-50 hover:bg-ink-100 cursor-pointer">
              <input type="checkbox" name="anonymous" className="mt-1" />
              <div>
                <div className="text-sm font-medium text-ink-700">Send anonymously</div>
                <div className="text-xs text-ink-400 mt-0.5">
                  Your name and email won&apos;t be shared with the CEO. You won&apos;t see responses in your inbox.
                </div>
              </div>
            </label>

            <div className="flex items-center justify-between pt-2">
              <Link href="/feedback/ceo" className="text-sm text-ink-400 hover:text-ink-600">← Cancel</Link>
              <Button type="submit" variant="accent">Send to CEO →</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
