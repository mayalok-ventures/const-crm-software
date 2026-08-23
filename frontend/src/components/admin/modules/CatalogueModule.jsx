'use client';

import React from 'react';
import { Plus, ShoppingBag, Trash2, Tag, CheckCircle2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function CatalogueModule({
  catalogues = [],
  loading = false,
  error = null,
  onRetry,
  onAddCatalogue,
  onDeleteCatalogue,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Product / Service Name',
      accessor: 'itemName',
      render: (row) => (
        <div>
          <div className="font-bold text-white text-xs flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{row.itemName || row.name}</span>
          </div>
          {row.description && (
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (row) => (
        <span className="text-xs text-slate-300 font-medium">{row.category || 'GENERAL'}</span>
      ),
    },
    {
      header: 'Retail Price',
      accessor: 'price',
      render: (row) => (
        <span className="text-xs text-slate-400 line-through">
          ₹{Number(row.price || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Offer Price',
      accessor: 'discountedPrice',
      render: (row) => (
        <span className="font-bold text-emerald-400 text-xs">
          ₹{Number(row.discountedPrice || row.price || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            row.isActive !== false
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {row.isActive !== false ? 'ACTIVE' : 'ARCHIVED'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <button
          onClick={() => onDeleteCatalogue && onDeleteCatalogue(row._id)}
          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          title="Delete Item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Product & Service Catalogue
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Manage packages, digital goods, and subscriptions available for sales reps to pitch
          </p>
        </div>

        {onAddCatalogue && (
          <button
            onClick={onAddCatalogue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={catalogues}
        loading={loading}
        emptyTitle="Catalogue is empty"
        emptyDescription="Add your products, packages, or services to enable reps to quote exact prices."
        emptyActionLabel="Add First Item"
        onEmptyAction={onAddCatalogue}
      />
    </div>
  );
}
