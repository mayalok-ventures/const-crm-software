'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Building2, User, Layers, ArrowRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function SuperAdminGlobalSearch({
  isOpen,
  onClose,
  onSelectResult,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/super-admin/search?q=${encodeURIComponent(query.trim())}`);
        if (data.success) {
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-xl bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-800 flex items-center gap-3 bg-[#070b14]">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organisations, users, leads, subscriptions..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {query.trim().length >= 2 && results.length === 0 && !loading && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching records found for "{query}"
            </div>
          )}

          {results.map((item) => {
            const badgeClasses =
              item.badgeColor === 'blue'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : item.badgeColor === 'purple'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : item.badgeColor === 'amber'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  if (onSelectResult) onSelectResult(item);
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {item.type === 'ORGANISATION' && <Building2 className="w-4 h-4 text-blue-400" />}
                    {item.type === 'USER' && <User className="w-4 h-4 text-purple-400" />}
                    {item.type === 'LEAD' && <Layers className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                      <span>{item.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${badgeClasses}`}>
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 shrink-0 transition-colors" />
              </div>
            );
          })}

          {!query && (
            <div className="p-4 text-[11px] text-slate-500 text-center">
              Type at least 2 characters to search across all tenants, users, and leads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
