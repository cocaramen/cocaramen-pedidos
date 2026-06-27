import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { ExpensesManager } from "@/components/gastos/expenses-manager";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  const [rows, [agg]] = await Promise.all([
    db.select().from(expenses).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)).limit(300),
    db.select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int` }).from(expenses),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Gastos" description="Registrá los gastos operativos del negocio." />
      <ExpensesManager expenses={rows} totalCents={agg?.total ?? 0} />
    </div>
  );
}
