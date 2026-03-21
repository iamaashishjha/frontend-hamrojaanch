/**
 * Student purchase history — lists orders for the current user (from backend GET /orders).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Receipt, ShoppingBag } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { listOrders } from "@/lib/payments-api";
import type { Order } from "@/lib/payments-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusVariant(status: Order["status"]) {
  if (status === "paid") return "success-light";
  if (status === "refunded" || status === "cancelled") return "secondary";
  return "warning-light";
}

export default function StudentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/student-dashboard" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student-dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <StudentNavUser />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-900">Purchase history</h1>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5" />
                No orders yet
              </CardTitle>
              <CardDescription>
                When you purchase an exam, it will appear here. You can also view your exam access from the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/all-exams">Browse exams</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Order — {format(new Date(order.createdAt), "PPp")}
                    </CardTitle>
                    <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  </div>
                  <CardDescription>
                    {order.currency} {order.amount.toLocaleString()} · {order.items.length} item(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exam</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item) => (
                        <TableRow key={item.examId}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right">
                            {item.currency} {item.price.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/all-exams?exam=${item.examId}`}>View exam</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
