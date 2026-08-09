"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api/client";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { toast } from "sonner";
import type { Supplier, SupplierChannel } from "@/types";

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<SupplierChannel>("whatsapp");

  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => getSuppliers(),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, phone: phone || undefined, email: email || undefined, preferred_channel: channel };
      return editId ? updateSupplier(editId, payload) : createSupplier(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editId ? "Supplier profile updated." : "Supplier profile created.");
      closeForm();
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to save supplier details.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier profile deleted.");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to delete supplier.");
    },
  });

  const openEdit = (supplier: Supplier) => {
    setEditId(supplier.supplier_id);
    setName(supplier.name);
    setPhone(supplier.phone || "");
    setEmail(supplier.email || "");
    setChannel(supplier.preferred_channel);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditId(null);
    setName("");
    setPhone("");
    setEmail("");
    setChannel("whatsapp");
    setIsFormOpen(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">SUPPLIER DIRECTORY</h1>
            <p className="text-xs text-zinc-500 mt-0.5 font-500">Manage external distributor relationships, preferred dispatch channels, and deep-link drafts.</p>
          </div>
          {!isFormOpen && (
            <Button size="sm" variant="primary" onClick={() => setIsFormOpen(true)}>
              Add Supplier Profile
            </Button>
          )}
        </div>

        {/* Form Modal/Card */}
        {isFormOpen && (
          <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">
              {editId ? "Edit Supplier profile" : "Create Supplier Profile"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
            >
              <div className="space-y-1">
                <label className="block font-700 text-zinc-500 uppercase">Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="Karnataka Grains Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-700 text-zinc-500 uppercase">Preferred dispatch Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as SupplierChannel)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none bg-zinc-50 text-zinc-800"
                >
                  <option value="whatsapp">WhatsApp Direct Msg</option>
                  <option value="email">Email Invoice Request</option>
                  <option value="phone">Voice Call Escalation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-700 text-zinc-500 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91-XXXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-700 text-zinc-500 uppercase">Email Address</label>
                <input
                  type="email"
                  placeholder="orders@supplier.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
                />
              </div>

              <div className="col-span-1 md:col-span-2 flex gap-3 pt-2">
                <Button variant="primary" size="sm" type="submit" loading={saveMutation.isPending}>
                  Save Supplier details
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Suppliers List Table */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton cols={5} rows={4} />
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load supplier records.</div>
          ) : suppliers?.length === 0 ? (
            <EmptyState
              title="No Suppliers Configured"
              description="No external suppliers are registered in the directory. This will prevent automatic restock drafting during network deficit negotiations."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Distributor</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Primary Channel</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Contact details</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {suppliers?.map((s) => (
                    <tr key={s.supplier_id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-600 text-zinc-450">
                        #{s.supplier_id}
                      </td>
                      <td className="px-4 py-3.5 font-700 text-zinc-900">
                        {s.name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-700 uppercase border bg-zinc-55 text-zinc-650 border-zinc-200">
                          {s.preferred_channel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 space-y-1 font-500 text-zinc-600">
                        {s.phone && <p>Phone: {s.phone}</p>}
                        {s.email && <p>Email: {s.email}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deleteMutation.isPending && deleteMutation.variables === s.supplier_id}
                          onClick={() => {
                            if (confirm("Delete supplier profile?")) {
                              deleteMutation.mutate(s.supplier_id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
