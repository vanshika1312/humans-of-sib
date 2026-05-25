import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { issueCertificate } from "../actions";
import type { WinWallData } from "../_lib/win-wall-data";
import { WinCertificateDisplay } from "./WinCertificateDisplay";
import { WinCertificateTemplateEditor } from "./WinCertificateTemplateEditor";
import { WinCertificateActions } from "./WinCertificateActions";

export function WinWallCertificates({
  latest,
  members,
  canIssue,
  template,
  customizeOpen,
}: {
  latest: WinWallData["latestCert"];
  members: WinWallData["members"];
  canIssue: boolean;
  template: WinWallData["certTemplate"];
  customizeOpen?: boolean;
}) {
  const issuedLabel = latest
    ? formatDate(latest.issuedAt, { month: "long", year: "numeric" })
    : formatDate(new Date(), { month: "long", year: "numeric" });

  const previewRecipient = latest?.user.name ?? "Team Member Name";
  const previewAchievement =
    latest?.achievement ?? "Outstanding contribution to the team this quarter";

  return (
    <div className="space-y-6">
      {canIssue && (
        <WinCertificateTemplateEditor
          key={template.updatedAt}
          initial={template}
          previewRecipient={previewRecipient}
          previewAchievement={previewAchievement}
          previewIssuedLabel={issuedLabel}
          defaultOpen={customizeOpen}
        />
      )}

      {canIssue && (
        <Card className="border-violet-200 bg-violet-50/20">
          <CardContent className="pt-5">
            <h3 className="font-semibold text-ink-700 mb-3">Issue new certificate</h3>
            <form action={issueCertificate} className="space-y-3">
              <div>
                <Label htmlFor="cert-userId">Recipient</Label>
                <Select id="cert-userId" name="userId" required defaultValue="">
                  <option value="" disabled>
                    Select a member…
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? "Unnamed"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cert-achievement">Achievement</Label>
                <Textarea
                  id="cert-achievement"
                  name="achievement"
                  required
                  rows={2}
                  placeholder="e.g. Crossing ₹5,00,000 in personal monthly revenue"
                />
              </div>
              <Button type="submit" variant="accent" size="sm">
                Issue certificate
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 flex items-center gap-2 mb-4">
          <span className="text-orange-500" aria-hidden>
            ■
          </span>
          Certificate preview
        </h2>
        {latest ? (
          <WinCertificateDisplay
            template={template}
            recipientName={latest.user.name ?? "Team member"}
            achievement={latest.achievement}
            issuedLabel={issuedLabel}
            certNumber={latest.certNumber}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-ink-500">
              No certificates issued yet. Managers can issue the first one above.
            </CardContent>
          </Card>
        )}

        <WinCertificateActions
          certId={latest?.id}
          canAct={canIssue}
          alreadyOnWall={!!latest?.winId}
        />
      </section>
    </div>
  );
}
