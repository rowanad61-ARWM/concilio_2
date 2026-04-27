import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const users = await db.user_account.findMany({
    orderBy: {
      email: "asc",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Users</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {users.length} users
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#edf1f4] hover:bg-[#FAFBFC]">
                <td className="px-4 py-3 font-medium text-[#113238]">{user.email}</td>
                <td className="px-4 py-3 text-[#4b5563]">{user.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-[999px] bg-[#FEF0E7] px-2 py-1 text-[11px] font-medium text-[#B45309]">
                    {user.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
