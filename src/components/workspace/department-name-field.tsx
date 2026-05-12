"use client";

import { useId } from "react";
import { Label } from "@/components/ui/input";
import { CreatableCombo } from "@/components/ui/creatable-combo";
import { WORKSPACE_DEPARTMENT_NAMES } from "@/lib/workspace-departments";
import { cn } from "@/lib/utils";

type Props = {
  /** Form field name (default `departmentName`). */
  name?: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Standard department picker: fixed SIB list + free text creates a new `Department` row on save.
 */
export function DepartmentNameField({
  name = "departmentName",
  label = "Department",
  required,
  defaultValue = "",
  placeholder = "Choose or type a department…",
  className,
}: Props) {
  const inputId = useId();
  return (
    <div className={cn(className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="mt-1.5">
        <CreatableCombo
          name={name}
          label={label}
          showLabel={false}
          inputId={inputId}
          options={[...WORKSPACE_DEPARTMENT_NAMES]}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputClassName="rounded-md h-10 py-2"
        />
      </div>
      <p className="text-xs text-ink-400 mt-1.5">Pick from the list or type a new department name.</p>
    </div>
  );
}
