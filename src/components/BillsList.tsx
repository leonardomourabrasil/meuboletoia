import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Building, RotateCcw, Trash2, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/FileUploader";
import { cn } from "@/lib/utils";

export interface Bill {
  id: string;
  beneficiary: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  category?: string;
  paymentMethod?: "PIX" | "Cartão de Crédito" | "Transferência Bancária";
  paidAt?: string; // Data em que a conta foi efetivamente paga
  barcode?: string; // Linha digitável do boleto
}

interface BillsListProps {
  bills: Bill[];
  onBillStatusChange: (billId: string, newStatus: "pending" | "paid", paymentMethod?: string) => void;
  onBillDelete: (billId: string) => void;
  title: string;
  showCheckbox?: boolean;
}

export const BillsList = ({ 
  bills, 
  onBillStatusChange,
  onBillDelete,
  title, 
  showCheckbox = true 
}: BillsListProps) => {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    billId: string;
    billName: string;
    action: "pay" | "unpay" | "delete";
  }>({
    isOpen: false,
    billId: "",
    billName: "",
    action: "pay"
  });

  const [downloadDialog, setDownloadDialog] = useState<{
    isOpen: boolean;
    billName: string;
  }>({
    isOpen: false,
    billName: ""
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  const handleFileSelect = (file: File) => {
    setReceiptFile(file);
  };

  const handleFileRemove = () => {
    setReceiptFile(null);
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action === "delete") {
      onBillDelete(confirmDialog.billId);
    } else {
      const newStatus = confirmDialog.action === "pay" ? "paid" : "pending";
      onBillStatusChange(
        confirmDialog.billId, 
        newStatus, 
        confirmDialog.action === "pay" ? selectedPaymentMethod : undefined
      );
    }
    setConfirmDialog({ isOpen: false, billId: "", billName: "", action: "pay" });
    setReceiptFile(null);
    setSelectedPaymentMethod("");
  };

  const closeDialog = () => {
    setConfirmDialog({ isOpen: false, billId: "", billName: "", action: "pay" });
    setReceiptFile(null);
    setSelectedPaymentMethod("");
  };

  const openConfirmDialog = (billId: string, billName: string, action: "pay" | "unpay" | "delete") => {
    setConfirmDialog({ isOpen: true, billId, billName, action });
    setReceiptFile(null);
    setSelectedPaymentMethod("");
  };

  const openDownloadDialog = (billName: string) => {
    setDownloadDialog({ isOpen: true, billName });
  };

  const closeDownloadDialog = () => {
    setDownloadDialog({ isOpen: false, billName: "" });
  };

  const handleDownloadReceipt = () => {
    // Simular download do comprovante
    const link = document.createElement('a');
    link.href = '#'; // Em uma implementação real, seria a URL do arquivo
    link.download = `comprovante-${downloadDialog.billName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    closeDownloadDialog();
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (bill: Bill) => {
    if (bill.status === "paid") {
      return <Badge variant="outline" className="bg-success-light text-success border-success/30 text-xs px-1.5 py-0.5">Pago</Badge>;
    }

    const daysUntilDue = getDaysUntilDue(bill.dueDate);
    
    if (daysUntilDue < 0) {
      return <Badge variant="destructive" className="text-xs px-1.5 py-0.5">Vencido</Badge>;
    } else if (daysUntilDue <= 3) {
      return <Badge variant="outline" className="bg-warning-light text-warning border-warning/30 text-xs px-1.5 py-0.5 whitespace-nowrap">Vence em {daysUntilDue}d</Badge>;
    } else {
      return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 whitespace-nowrap">Em {daysUntilDue}d</Badge>;
    }
  };

  const formatBarcode = (barcode?: string) => {
    if (!barcode) return '';
    return barcode.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-3 h-full">
          {bills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground h-full flex flex-col justify-center min-h-[200px]">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma conta encontrada</p>
            </div>
          ) : (
            bills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => bill.status === "paid" && openDownloadDialog(bill.beneficiary)}
                className={cn(
                  "flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg border transition-all duration-200",
                  bill.status === "paid" 
                    ? "bg-success-light/30 border-success/30 cursor-pointer hover:bg-success-light/40" 
                    : "bg-card border-border hover:shadow-md"
                )}
              >
                {showCheckbox && bill.status === "pending" && (
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => openConfirmDialog(bill.id, bill.beneficiary, "pay")}
                    className="transition-transform hover:scale-110 mt-1 flex-shrink-0"
                  />
                )}
                
                {bill.status === "paid" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfirmDialog(bill.id, bill.beneficiary, "unpay");
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground mt-1 flex-shrink-0"
                    title="Desfazer pagamento"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">{bill.beneficiary}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-shrink-0">
                        {getStatusBadge(bill)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfirmDialog(bill.id, bill.beneficiary, "delete");
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                        title="Excluir boleto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="whitespace-nowrap">{formatDate(bill.dueDate)}</span>
                      </div>
                      {bill.category && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {bill.category}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-primary text-sm sm:text-base flex-shrink-0">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>

                  {bill.barcode && (
                    <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground mt-1">
                      <Barcode className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate" title={bill.barcode}>{formatBarcode(bill.barcode)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => 
        !open && closeDialog()
      }>
        <AlertDialogContent className={cn(confirmDialog.action === "pay" ? "max-w-2xl" : "max-w-md")}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "pay" && "Confirmar Pagamento"}
              {confirmDialog.action === "unpay" && "Desfazer Pagamento"}
              {confirmDialog.action === "delete" && "Excluir Boleto"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "pay" && `Marcar "${confirmDialog.billName}" como pago`}
              {confirmDialog.action === "unpay" && `Tem certeza que deseja desfazer o pagamento de "${confirmDialog.billName}"?`}
              {confirmDialog.action === "delete" && `Tem certeza que deseja excluir permanentemente o boleto "${confirmDialog.billName}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {confirmDialog.action === "pay" && (
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="payment-method" className="text-sm font-medium">
                  Forma de Pagamento *
                </Label>
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Comprovante de Pagamento</Label>
                <div className="mt-2">
                  <FileUploader
                    onFileSelect={handleFileSelect}
                    onFileRemove={handleFileRemove}
                    selectedFile={receiptFile}
                  />
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={confirmDialog.action === "pay" && !selectedPaymentMethod}>
              {confirmDialog.action === "pay" && "Confirmar"}
              {confirmDialog.action === "unpay" && "Desfazer"}
              {confirmDialog.action === "delete" && "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};