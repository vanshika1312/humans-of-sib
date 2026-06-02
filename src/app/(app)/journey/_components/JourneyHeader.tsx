"use client";

import { MapPin, Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MockEmployeeJourney } from "../_data/mockEmployeeData";
import { formatTenure } from "./journey-theme";

type Props = {
  employee: MockEmployeeJourney["employee"];
};

export function JourneyHeader({ employee }: Props) {
  const tenure = formatTenure(employee.joinedAt);

  return (
    <Card className="overflow-hidden">
      <div className="h-24 brand-gradient confetti" />
      <CardContent className="pt-0 -mt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar
              src={employee.avatarUrl}
              name={employee.name}
              size="xl"
              className="ring-4 ring-white"
            />
            <div className="pb-1">
              <h2 className="text-xl font-bold text-ink-700">{employee.name}</h2>
              <p className="text-sm text-ink-500">{employee.designation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="sky">
                  <Building2 className="size-3" aria-hidden />
                  {employee.department}
                </Badge>
                <Badge tone="ink">
                  <MapPin className="size-3" aria-hidden />
                  {employee.location}
                </Badge>
                <Badge tone="orange">{tenure} at SIB</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
