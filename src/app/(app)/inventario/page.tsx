import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { ingredients as ingredientsTable } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IngredientsManager } from "@/components/inventario/ingredients-manager";
import { RecipesEditor } from "@/components/inventario/recipes-editor";
import { PurchasesManager } from "@/components/inventario/purchases-manager";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const [ingredients, products, purchases] = await Promise.all([
    db.query.ingredients.findMany({
      orderBy: [asc(ingredientsTable.sortOrder), asc(ingredientsTable.name)],
    }),
    db.query.products.findMany({ with: { recipe: true } }),
    db.query.purchases.findMany({ with: { items: true }, orderBy: (p, { desc: d }) => [d(p.purchaseDate), d(p.createdAt)], limit: 200 }),
  ]);

  const ingForRecipes = ingredients.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }));
  const ingForPurchases = ingredients
    .filter((i) => i.isActive)
    .map((i) => ({
      id: i.id,
      name: i.name,
      baseUnit: i.baseUnit,
      purchaseUnitLabel: i.purchaseUnitLabel,
      purchaseToBase: i.purchaseToBase,
    }));
  const recipeProducts = products
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      costCents: p.costCents,
      recipe: p.recipe.map((r) => ({
        id: r.id,
        ingredientId: r.ingredientId,
        qtyPerUnitBase: r.qtyPerUnitBase,
      })),
    }));
  const purchaseRows = purchases.map((p) => ({
    id: p.id,
    purchaseDate: p.purchaseDate,
    vendor: p.vendor,
    totalCents: p.totalCents,
    itemCount: p.items.length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Insumos, recetas y compras. El stock se descuenta solo al entregar cada pedido."
      />
      <Tabs defaultValue="insumos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="recetas">Recetas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos">
          <IngredientsManager ingredients={ingredients} />
        </TabsContent>
        <TabsContent value="recetas">
          <RecipesEditor products={recipeProducts} ingredients={ingForRecipes} />
        </TabsContent>
        <TabsContent value="compras">
          <PurchasesManager purchases={purchaseRows} ingredients={ingForPurchases} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
