"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { MockEmployeeJourney } from "../_data/mockEmployeeData";
import { formatTenure, MILESTONE_META } from "./journey-theme";

type Props = {
  data: MockEmployeeJourney;
};

export function ExportButton({ data }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const { employee, stats, milestones, certifications, awards } = data;
      const tenure = formatTenure(employee.joinedAt);

      const milestoneRows = [...milestones]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 12)
        .map(
          (m) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px">${formatDate(m.date)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px"><strong>${m.title}</strong><br/><span style="color:#666">${MILESTONE_META[m.type].label} — ${m.description}</span></td></tr>`,
        )
        .join("");

      const certRows = certifications
        .map(
          (c) =>
            `<li style="margin-bottom:6px;font-size:11px"><strong>${c.name}</strong> — ${c.issuer} (${formatDate(c.date)})</li>`,
        )
        .join("");

      const awardRows = awards
        .map(
          (a) =>
            `<li style="margin-bottom:6px;font-size:11px"><strong>${a.name}</strong> — ${a.givenBy}, ${formatDate(a.date)}</li>`,
        )
        .join("");

      const html = `
        <div style="font-family:Inter,system-ui,sans-serif;color:#1a1a1a;padding:24px;max-width:720px">
          <div style="background:linear-gradient(135deg,#29b6e8,#f26522 65%,#ffc93c);color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:20px">
            <h1 style="margin:0;font-size:22px">${employee.name}</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px">${employee.designation} · ${employee.department}</p>
            <p style="margin:4px 0 0;opacity:0.75;font-size:12px">${employee.location} · ${tenure} at SIB</p>
          </div>
          <h2 style="font-size:14px;color:#1282aa;margin:0 0 8px">At a glance</h2>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px">
            <tr>
              <td style="padding:8px;background:#f7f7f7;border-radius:4px"><strong>${stats.trainingsCompleted}</strong><br/>Trainings</td>
              <td style="padding:8px;background:#f7f7f7;border-radius:4px"><strong>${stats.certificationsEarned}</strong><br/>Certifications</td>
              <td style="padding:8px;background:#f7f7f7;border-radius:4px"><strong>${stats.awardsCount}</strong><br/>Awards</td>
              <td style="padding:8px;background:#f7f7f7;border-radius:4px"><strong>${stats.performanceSummary}</strong><br/>Performance</td>
            </tr>
          </table>
          <h2 style="font-size:14px;color:#1282aa;margin:0 0 8px">Recent milestones</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${milestoneRows}</table>
          <h2 style="font-size:14px;color:#1282aa;margin:0 0 8px">Certifications</h2>
          <ul style="padding-left:18px;margin:0 0 20px">${certRows}</ul>
          <h2 style="font-size:14px;color:#1282aa;margin:0 0 8px">Awards</h2>
          <ul style="padding-left:18px;margin:0">${awardRows}</ul>
          <p style="margin-top:24px;font-size:10px;color:#999">Generated from My Journey · SIB</p>
        </div>
      `;

      const el = document.createElement("div");
      el.innerHTML = html;
      document.body.appendChild(el);

      await html2pdf()
        .set({
          margin: 10,
          filename: `${employee.name.replace(/\s+/g, "-")}-career-snapshot.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(el)
        .save();

      document.body.removeChild(el);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setLoading(false);
    }
  }, [data]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Download className="size-4" aria-hidden />
      )}
      {loading ? "Generating…" : "Download snapshot"}
    </Button>
  );
}
