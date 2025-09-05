import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/StatsCard";
import { BillsList, Bill } from "@/components/BillsList";
import { PaymentChart } from "@/components/PaymentChart";
import { CategoryChart } from "@/components/CategoryChart";
import { TotalSpendingByCategory } from "@/components/TotalSpendingByCategory";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AddBillModal } from "@/components/AddBillModal";
import { ReportModal } from "@/components/ReportModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, TrendingUp, Calendar, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

// Mock data for demonstration
const mockBills: Bill[] = [
  {
    id: "1",
    beneficiary: "Enel Energia",
    amount: 245.50,
    dueDate: "2024-08-20",
    status: "pending",
    category: "Energia"
  },
  {
    id: "2", 
    beneficiary: "Copasa",
    amount: 89.30,
    dueDate: "2024-08-18",
    status: "pending",
    category: "Água"
  },
  {
    id: "3",
    beneficiary: "Condomínio Residencial",
    amount: 1250.00,
    dueDate: "2024-08-15",
    status: "pending",
    category: "Condomínio"
  },
  {
    id: "4",
    beneficiary: "Internet Vivo",
    amount: 99.90,
    dueDate: "2024-07-25",
    status: "paid",
    category: "Internet",
    paidAt: "2024-08-15", // Pago em agosto
    paymentMethod: "PIX"
  },
  {
    id: "5",
    beneficiary: "Supermercado Extra",
    amount: 456.78,
    dueDate: "2024-07-30",
    status: "paid",
    category: "Mercado",
    paidAt: "2024-08-10", // Pago em agosto
    paymentMethod: "Transferência Bancária"
  }
];

// Mock payment history with more detailed data including categories
type MonthlyPaymentData = {
  month: string;
  Energia: number;
  Água: number;
  Condomínio: number;
  Internet: number;
  Mercado: number;
};

const mockPaymentHistoryWithCategories: MonthlyPaymentData[] = [
  { month: "Fev", Energia: 245, Água: 89, Condomínio: 1250, Internet: 100, Mercado: 456 },
  { month: "Mar", Energia: 220, Água: 92, Condomínio: 1250, Internet: 100, Mercado: 518 },
  { month: "Abr", Energia: 280, Água: 85, Condomínio: 1250, Internet: 100, Mercado: 675 },
  { month: "Mai", Energia: 235, Água: 91, Condomínio: 1250, Internet: 100, Mercado: 580 },
  { month: "Jun", Energia: 210, Água: 88, Condomínio: 1250, Internet: 100, Mercado: 475 },
  { month: "Jul", Energia: 255, Água: 95, Condomínio: 1250, Internet: 100, Mercado: 478 },
];

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  // const [bills, setBills] = useState<Bill[]>(mockBills);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Map DB row -> UI Bill
  const mapRowToBill = (row: Tables<'bills'>): Bill => ({
    id: row.id,
    beneficiary: row.beneficiary,
    amount: row.amount,
    dueDate: row.due_date,
    status: (row.status as 'pending' | 'paid') ?? 'pending',
    category: row.category ?? undefined,
    paymentMethod: (row.payment_method as Bill['paymentMethod']) ?? undefined,
    paidAt: row.paid_at ?? undefined,
    barcode: row.barcode ?? undefined,
  });

  // Fetch bills from Supabase for the current user
  const { data: dbBills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user!.id)
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data as Tables<'bills'>[];
    }
  });

  const bills: Bill[] = useMemo(() => dbBills.map(mapRowToBill), [dbBills]);

  // Mutations
  const addBillMutation = useMutation({
    mutationFn: async (newBill: Omit<Bill, "id" | "status">) => {
      const insert = {
        user_id: user!.id,
        beneficiary: newBill.beneficiary,
        amount: newBill.amount,
        due_date: newBill.dueDate,
        category: newBill.category ?? null,
        barcode: newBill.barcode ?? null,
        status: 'pending' as const,
      };
      const { data, error } = await supabase
        .from('bills')
        .insert(insert)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Tables<'bills'>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ billId, newStatus, paymentMethod }: { billId: string; newStatus: 'pending' | 'paid'; paymentMethod?: string }) => {
      const patch: Partial<Tables<'bills'>> = { status: newStatus } as any;
      if (newStatus === 'paid') {
        patch.paid_at = new Date().toISOString().split('T')[0];
        patch.payment_method = paymentMethod ?? null;
      } else {
        patch.paid_at = null;
        patch.payment_method = null;
      }
      const { error } = await supabase
        .from('bills')
        .update(patch)
        .eq('id', billId)
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
    }
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
    }
  });

  const stats = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Todas as contas pendentes (independente do mês)
    const allPendingBills = bills.filter(bill => bill.status === "pending");

    // Contas pagas apenas do mês atual (para o card "Total Pago (Mês)")
    const paidBills = bills.filter(bill => {
      if (bill.status !== "paid" || !bill.paidAt) return false;
      
      const paidDate = new Date(bill.paidAt);
      return paidDate.getMonth() === currentMonth && 
             paidDate.getFullYear() === currentYear;
    });

    // Todas as contas pagas (para o novo card "Valor Total Pago Geral")
    const allPaidBills = bills.filter(bill => bill.status === "paid");

    const totalPending = allPendingBills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalPaid = paidBills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalPaidOverall = allPaidBills.reduce((sum, bill) => sum + bill.amount, 0);

    // Get bills due in next 7 days para o card "Próximos Vencimentos"
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingBills = allPendingBills.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      return dueDate <= nextWeek;
    });

    return {
      totalPending,
      totalPaid,
      totalPaidOverall,
      upcomingCount: upcomingBills.length
    };
  }, [bills]);

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    bills.forEach(bill => {
      const current = categoryMap.get(bill.category) || { amount: 0, count: 0 } as { amount: number; count: number };
      categoryMap.set(bill.category as string, {
        amount: current.amount + bill.amount,
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
  }, [bills]);

  const paymentHistoryData = useMemo(() => {
    if (!selectedCategory) {
      // Show total for all categories
      return mockPaymentHistoryWithCategories.map(item => ({
        month: item.month,
        amount: (item.Energia + item.Água + item.Condomínio + item.Internet + item.Mercado)
      }));
    } else {
      // Show data for selected category only
      return mockPaymentHistoryWithCategories.map(item => ({
        month: item.month,
        amount: item[selectedCategory as keyof MonthlyPaymentData] as number || 0
      }));
    }
  }, [selectedCategory]);

  // Filter bills by selected month if applicable
  const filteredBillsByMonth = useMemo(() => {
    if (!selectedMonth) return bills;
    
    return bills.filter(bill => {
      const billDate = new Date(bill.dueDate);
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
        'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
      };
      return billDate.getMonth() === monthMap[selectedMonth];
    });
  }, [bills, selectedMonth]);

  const categories = useMemo(() => {
    return Array.from(new Set(bills.map(bill => bill.category))).sort();
  }, [bills]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const handleBillStatusChange = (billId: string, newStatus: "pending" | "paid", paymentMethod?: string) => {
    updateStatusMutation.mutate({ billId, newStatus, paymentMethod });
  };

  const handleDeleteBill = (billId: string) => {
    deleteBillMutation.mutate(billId);
  };

  const handleAddBill = (newBill: Omit<Bill, "id" | "status">) => {
    addBillMutation.mutate(newBill);
  };

  const filteredBills = useMemo(() => {
    let result = selectedMonth ? filteredBillsByMonth : bills;
    if (selectedCategory) {
      result = result.filter(bill => bill.category === selectedCategory);
    }
    return result;
  }, [bills, selectedCategory, selectedMonth, filteredBillsByMonth]);

  const pendingBills = filteredBills.filter(bill => bill.status === "pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  const paidBills = filteredBills.filter(bill => bill.status === "paid")
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  if (loading || billsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Carregando...</h2>
          <p className="text-muted-foreground">Buscando suas contas</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 lg:h-18">
            {/* Logo and Title - Responsive */}
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate">
                  MeuBoleto AI
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block lg:block">
                  Sistema Inteligente de Controle de Contas
                </p>
              </div>
            </div>
            
            {/* User Info and Actions - Responsive */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 ml-4">
              {/* User greeting - hidden on very small screens */}
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:block max-w-[120px] lg:max-w-none truncate">
                Olá, {user.email}
              </span>
              
              {/* Settings button - icon only on mobile */}
              <Link to="/configuracoes">
                <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline ml-1 sm:ml-2">Configurações</span>
                </Button>
              </Link>
              
              {/* Logout button - icon only on mobile */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="h-8 sm:h-9 px-2 sm:px-3"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1 sm:ml-2">Sair</span>
              </Button>
              
              {/* Action buttons - stack on mobile, inline on larger screens */}
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                <ReportModal bills={bills} />
                <AddBillModal onAddBill={handleAddBill} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatsCard
            title="Total a Pagar"
            value={formatCurrency(stats.totalPending)}
            icon={<DollarSign className="h-4 w-4" />}
            description="Soma das contas pendentes"
          />
          <StatsCard
            title="Total Pago (Mês)"
            value={formatCurrency(stats.totalPaid)}
            icon={<CreditCard className="h-4 w-4" />}
            description="Somente o mês atual"
          />
          <StatsCard
            title="Valor Total Pago Geral"
            value={formatCurrency(stats.totalPaidOverall)}
            icon={<TrendingUp className="h-4 w-4" />}
            description="Desde o início"
          />
          <StatsCard
            title="Próximos Vencimentos"
            value={`${stats.upcomingCount}`}
            icon={<Calendar className="h-4 w-4" />}
            description="Nos próximos 7 dias"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-6">
          <CategoryFilter 
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BillsList
                title="A Pagar"
                bills={pendingBills}
                onBillStatusChange={handleBillStatusChange}
                onBillDelete={handleDeleteBill}
                showCheckbox
              />
              <BillsList
                title="Pagas"
                bills={paidBills}
                onBillStatusChange={handleBillStatusChange}
                onBillDelete={handleDeleteBill}
                showCheckbox={false}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <PaymentChart data={paymentHistoryData} />
            <CategoryChart data={categoryData} />
            <TotalSpendingByCategory data={categoryData} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} MeuBoleto AI. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
