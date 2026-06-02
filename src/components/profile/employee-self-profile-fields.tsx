import { Input, Select, Label, Textarea } from "@/components/ui/input";

type CityOption = { id: string; name: string; isHQ: boolean };

export type EmployeeSelfProfileDefaults = {
  personalEmail?: string | null;
  birthday?: Date | null;
  gender?: string | null;
  cityId?: string | null;
  residentialAddress?: string | null;
  pan?: string | null;
  aadhar?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  phone?: string | null;
};

export function EmployeeSelfProfileFields({
  cities,
  defaults = {},
  officialEmail,
}: {
  cities: CityOption[];
  defaults?: EmployeeSelfProfileDefaults;
  officialEmail?: string;
}) {
  const birthdayValue = defaults.birthday
    ? new Date(defaults.birthday).toISOString().split("T")[0]
    : "";

  return (
    <div className="space-y-4">
      {officialEmail && (
        <p className="text-xs text-ink-400">
          Official work email: <span className="font-medium text-ink-600">{officialEmail}</span>
        </p>
      )}

      <div>
        <Label htmlFor="personalEmail">Personal email *</Label>
        <Input
          id="personalEmail"
          name="personalEmail"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaults.personalEmail ?? ""}
          placeholder="you@gmail.com"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults.phone ?? ""}
            placeholder="+91 98765 43210"
          />
        </div>
        <div>
          <Label htmlFor="birthday">Date of birth *</Label>
          <Input id="birthday" name="birthday" type="date" required defaultValue={birthdayValue} />
        </div>
      </div>

      <div>
        <Label htmlFor="gender">Gender *</Label>
        <Select id="gender" name="gender" required defaultValue={defaults.gender ?? ""}>
          <option value="" disabled>
            Choose…
          </option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="NON_BINARY">Non-binary</option>
          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="cityId">Location (city) *</Label>
        <Select id="cityId" name="cityId" required defaultValue={defaults.cityId ?? ""}>
          <option value="" disabled>
            Choose your city…
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isHQ ? " (HQ)" : ""}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="residentialAddress">Full address *</Label>
        <Textarea
          id="residentialAddress"
          name="residentialAddress"
          required
          defaultValue={defaults.residentialAddress ?? ""}
          placeholder="House no., street, area, PIN code"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pan">PAN *</Label>
          <Input
            id="pan"
            name="pan"
            required
            defaultValue={defaults.pan ?? ""}
            placeholder="ABCDE1234F"
            maxLength={10}
          />
        </div>
        <div>
          <Label htmlFor="aadhar">Aadhaar (12 digits) *</Label>
          <Input
            id="aadhar"
            name="aadhar"
            required
            inputMode="numeric"
            maxLength={12}
            defaultValue={defaults.aadhar ?? ""}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fatherName">Father&apos;s name *</Label>
          <Input id="fatherName" name="fatherName" required defaultValue={defaults.fatherName ?? ""} />
        </div>
        <div>
          <Label htmlFor="motherName">Mother&apos;s name *</Label>
          <Input id="motherName" name="motherName" required defaultValue={defaults.motherName ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="emergencyContactName">Emergency contact name *</Label>
        <Input
          id="emergencyContactName"
          name="emergencyContactName"
          required
          defaultValue={defaults.emergencyContactName ?? ""}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="emergencyContactPhone">Emergency contact phone *</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            required
            defaultValue={defaults.emergencyContactPhone ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="emergencyContactRelation">Relationship *</Label>
          <Input
            id="emergencyContactRelation"
            name="emergencyContactRelation"
            required
            placeholder="e.g. Spouse"
            defaultValue={defaults.emergencyContactRelation ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
