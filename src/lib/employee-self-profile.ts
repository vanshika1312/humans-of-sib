import { z } from "zod";
import type { Gender } from "@/generated/prisma";

export const employeeSelfProfileSchema = z.object({
  birthday: z.string().min(1, "Date of birth is required"),
  pan: z
    .string()
    .min(10)
    .max(10)
    .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "Enter a valid PAN"),
  aadhar: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  fatherName: z.string().min(1, "Required").max(200),
  motherName: z.string().min(1, "Required").max(200),
  emergencyContactName: z.string().min(1, "Required").max(200),
  emergencyContactPhone: z.string().min(5, "Enter a valid phone").max(32),
  emergencyContactRelation: z.string().min(1, "Required").max(100),
  residentialAddress: z.string().min(3, "Address is required").max(2000),
  personalEmail: z.string().email("Enter a valid personal email"),
  cityId: z.string().min(1, "Choose your city"),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
  phone: z.string().max(32).optional(),
});

export type EmployeeSelfProfileInput = z.infer<typeof employeeSelfProfileSchema>;

export function parseEmployeeSelfProfileForm(fd: FormData) {
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  return employeeSelfProfileSchema.safeParse({
    birthday: fd.get("birthday"),
    pan: String(fd.get("pan") ?? "").trim().toUpperCase(),
    aadhar: String(fd.get("aadhar") ?? "").replace(/\s/g, ""),
    fatherName: fd.get("fatherName"),
    motherName: fd.get("motherName"),
    emergencyContactName: fd.get("emergencyContactName"),
    emergencyContactPhone: fd.get("emergencyContactPhone"),
    emergencyContactRelation: fd.get("emergencyContactRelation"),
    residentialAddress: fd.get("residentialAddress"),
    personalEmail: String(fd.get("personalEmail") ?? "").trim().toLowerCase(),
    cityId: fd.get("cityId"),
    gender: fd.get("gender"),
    phone: phoneRaw.length > 0 ? phoneRaw : undefined,
  });
}

export type EmployeeProfileRecord = {
  personalEmail: string | null;
  birthday: Date | null;
  gender: Gender | null;
  cityId: string | null;
  residentialAddress: string | null;
  pan: string | null;
  aadhar: string | null;
  fatherName: string | null;
  motherName: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
};

export function isEmployeeProfileComplete(user: EmployeeProfileRecord): boolean {
  return !!(
    user.personalEmail?.trim() &&
    user.birthday &&
    user.gender &&
    user.cityId &&
    user.residentialAddress?.trim() &&
    user.pan?.trim() &&
    user.aadhar?.trim() &&
    user.fatherName?.trim() &&
    user.motherName?.trim() &&
    user.emergencyContactName?.trim() &&
    user.emergencyContactPhone?.trim() &&
    user.emergencyContactRelation?.trim()
  );
}

export function employeeSelfProfileToDb(v: EmployeeSelfProfileInput) {
  return {
    birthday: new Date(v.birthday),
    pan: v.pan,
    aadhar: v.aadhar,
    fatherName: v.fatherName.trim(),
    motherName: v.motherName.trim(),
    emergencyContactName: v.emergencyContactName.trim(),
    emergencyContactPhone: v.emergencyContactPhone.trim(),
    emergencyContactRelation: v.emergencyContactRelation.trim(),
    residentialAddress: v.residentialAddress.trim(),
    personalEmail: v.personalEmail,
    cityId: v.cityId,
    gender: v.gender as Gender,
    phone: v.phone?.trim() || null,
    invitationPending: false,
    onboardingInviteToken: null,
    onboardingInviteExpiresAt: null,
  };
}

export function genderDisplayLabel(g: Gender | string | null | undefined): string {
  if (!g) return "—";
  switch (g) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "NON_BINARY":
      return "Non-binary";
    case "PREFER_NOT_TO_SAY":
      return "Prefer not to say";
    default:
      return g;
  }
}
