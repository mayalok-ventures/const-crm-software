'use client';

import React from 'react';
import { Plus, Ticket, Trash2, Tag, Calendar, CheckCircle2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function CouponsModule({
  coupons = [],
  loading = false,
  error = null,
  onRetry,
  onAddCoupon,
  onDeleteCoupon,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Coupon Code',
      accessor: 'code',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-mono font-bold text-amber-300 text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: 'Discount Offered',
      accessor: 'discountValue',
      render: (row) => (
        <span className="font-bold text-emerald-400 text-xs">
          {row.discountType === 'PERCENTAGE' ? `${row.discountValue}% OFF` : `₹${row.discountValue} FLAT OFF`}
        </span>
      ),
    },
    {
      header: 'Usage Limits',
      accessor: 'maxOverallUses',
      render: (row) => (
        <span className="text-slate-300 text-xs">
          {row.usedCount || 0} / {row.maxOverallUses || '∞'} used
        </span>
      ),
    },
    {
      header: 'Valid Until',
      accessor: 'validUntil',
      render: (row) => (
        <span className="text-slate-400 text-[11px]">
          {row.validUntil ? new Date(row.validUntil).toLocaleDateString() : 'No Expiry'}
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
          {row.isActive !== false ? 'ACTIVE' : 'EXPIRED'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <button
          onClick={() => onDeleteCoupon && onDeleteCoupon(row._id)}
          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          title="Delete Coupon"
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
            Promotional Coupons & Discount Engine
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Create discount vouchers, promotional codes, and limited-time offer tokens
          </p>
        </div>

        {onAddCoupon && (
          <button
            onClick={onAddCoupon}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Coupon</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={coupons}
        loading={loading}
        emptyTitle="No coupons active"
        emptyDescription="Create discount codes to offer promotional pricing on your products or plans."
        emptyActionLabel="Create First Coupon"
        onEmptyAction={onAddCoupon}
      />
    </div>
  );
}
