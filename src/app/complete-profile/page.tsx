import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { isEmployeeProfileComplete } from "@/lib/employee-self-profile";
import { displayName } from "@/lib/user-display-name";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmployeeSelfProfileFields } from "@/components/profile/employee-self-profile-fields";
import { completeMyProfile } from "./actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function CompleteProfilePage({ searchParams }: Props) {
  const user = await requireAppViewer();
  if (!user) redirect("/sign-in");

  if (isEmployeeProfileComplete(user)) {
    redirect("/home");
  }

  const { error: errorParam } = await searchParams;
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="w-full max-w-lg">
      <PageHeader
        title="Complete your profile"
        emoji="👋"
        subtitle={`Welcome, ${displayName(user)}. We need a few personal details before you can use Humans of SIB.`}
      />

      {user.employeeCode && (
        <p className="text-sm text-ink-500 mb-4">
          Your employee ID: <span className="font-semibold text-ink-700">{user.employeeCode}</span>
        </p>
      )}

      {errorParam && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form action={completeMyProfile} className="space-y-4">
            <EmployeeSelfProfileFields
              cities={cities}
              officialEmail={user.email}
              defaults={{
                personalEmail: user.personalEmail,
                birthday: user.birthday,
                gender: user.gender,
                cityId: user.cityId,
                residentialAddress: user.residentialAddress,
                pan: user.pan,
                aadhar: user.aadhar,
                fatherName: user.fatherName,
                motherName: user.motherName,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                emergencyContactRelation: user.emergencyContactRelation,
                phone: user.phone,
              }}
            />
            <Button type="submit" variant="accent" className="w-full">
              Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
