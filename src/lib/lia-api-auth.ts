import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isEmployeeProfileComplete } from "@/lib/employee-self-profile";

export type LiaApiViewer = {
  id: string;
  email: string;
  invitationPending: boolean;
};

export async function requireLiaApiViewer(): Promise<LiaApiViewer | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      invitationPending: true,
      status: true,
      personalEmail: true,
      birthday: true,
      gender: true,
      cityId: true,
      residentialAddress: true,
      pan: true,
      aadhar: true,
      fatherName: true,
      motherName: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
    },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (!isEmployeeProfileComplete(user)) return null;
  return { id: user.id, email: user.email, invitationPending: user.invitationPending };
}
