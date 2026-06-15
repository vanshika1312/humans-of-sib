"use client";

import { useState } from "react";
import { Label, Select, Input } from "@/components/ui/input";
import { QUANTITY_UNIT_PRESETS } from "@/lib/work-tracking/config";

export function QuantityUnitFields({
  defaultUnit = "units",
  idPrefix = "qty-unit",
}: {
  defaultUnit?: string;
  idPrefix?: string;
}) {
  const isPreset = QUANTITY_UNIT_PRESETS.includes(defaultUnit as (typeof QUANTITY_UNIT_PRESETS)[number]);
  const [mode, setMode] = useState(isPreset ? defaultUnit : "__custom__");

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={`${idPrefix}-preset`}>Unit</Label>
        <Select
          id={`${idPrefix}-preset`}
          name="quantityUnitPreset"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {QUANTITY_UNIT_PRESETS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </Select>
      </div>
      {mode === "__custom__" && (
        <div>
          <Label htmlFor={`${idPrefix}-custom`}>Custom unit</Label>
          <Input
            id={`${idPrefix}-custom`}
            name="quantityUnitCustom"
            placeholder="e.g. demos"
            defaultValue={isPreset ? "" : defaultUnit}
            required
          />
        </div>
      )}
    </div>
  );
}
