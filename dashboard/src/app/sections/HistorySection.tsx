'use client'

import { Check, Clock, Download, Film, Search, X } from 'lucide-react'
import type { DashboardSection, HistorySummary } from '@/lib/types'

interface Props {
  historySummaries: HistorySummary[]
  isLoadingHistory: boolean
  historyEditMode: boolean
  selectedHistoryIds: Set<string>
  isDeletingHistory: boolean
  setHistoryEditMode: (v: boolean) => void
  setSelectedHistoryIds: (fn: (prev: Set<string>) => Set<string>) => void
  toggleHistorySelection: (id: string) => void
  exitHistoryEditMode: () => void
  deleteSelectedEntries: () => Promise<void>
  backupSelectedEntries: () => Promise<void>
  loadHistoryEntry: (requestId: string) => Promise<void>
  openSection: (section: DashboardSection) => void
  historySearch: string
  setHistorySearch: (v: string) => void
  historyFilter: 'all' | 'approved' | 'revision'
  setHistoryFilter: (v: 'all' | 'approved' | 'revision') => void
}

export function HistorySection({
  historySummaries,
  isLoadingHistory,
  historyEditMode,
  selectedHistoryIds,
  isDeletingHistory,
  setHistoryEditMode,
  setSelectedHistoryIds,
  toggleHistorySelection,
  exitHistoryEditMode,
  deleteSelectedEntries,
  backupSelectedEntries,
  loadHistoryEntry,
  openSection,
  historySearch,
  setHistorySearch,
  historyFilter,
  setHistoryFilter,
}: Props) {
  const filtered = historySummaries.filter((h) => {
    const matchesSearch = historySearch === '' || h.filename.toLowerCase().includes(historySearch.toLowerCase())
    const matchesFilter =
      historyFilter === 'all' ||
      (historyFilter === 'approved' && h.approved) ||
      (historyFilter === 'revision' && !h.approved)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Search + filter bar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search by filename…"
            className="w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-seedtag-coral/40 transition-colors"
          />
          {historySearch && (
            <button type="button" onClick={() => setHistorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
          {(['all', 'approved', 'revision'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setHistoryFilter(f)}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                historyFilter === f
                  ? f === 'approved'
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : f === 'revision'
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-seedtag-coral text-white'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              {f === 'all' ? 'All' : f === 'approved' ? 'Approved' : 'Revision'}
            </button>
          ))}
        </div>

        {/* Edit / Done / Select all */}
        {!isLoadingHistory && historySummaries.length > 0 && (
          historyEditMode ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedHistoryIds(() => new Set(filtered.map(s => s.request_id)))}
                className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={exitHistoryEditMode}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHistoryEditMode(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all shrink-0"
            >
              Edit
            </button>
          )
        )}
      </div>

      {/* Count line */}
      <p className="text-[10px] text-gray-600 shrink-0">
        {isLoadingHistory ? 'Loading…' : `${filtered.length} of ${historySummaries.length} run${historySummaries.length !== 1 ? 's' : ''}`}
        {historyEditMode && selectedHistoryIds.size > 0 && (
          <span className="ml-2 text-seedtag-coral font-bold">· {selectedHistoryIds.size} selected</span>
        )}
      </p>

      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
          <div className="w-6 h-6 border-2 border-seedtag-coral border-t-transparent rounded-full animate-spin mr-3" />
          Loading history…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Clock size={40} className="text-gray-700" />
          <p className="text-sm font-bold text-gray-400">
            {historySummaries.length === 0 ? 'No past diagnostics yet' : 'No results match your filters'}
          </p>
          <p className="text-xs text-gray-600">
            {historySummaries.length === 0
              ? 'Run an analysis to start building history.'
              : 'Try clearing the search or changing the filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pb-20">
          {filtered.map((entry) => {
            const isSelected = selectedHistoryIds.has(entry.request_id)
            return (
              <div
                key={entry.request_id}
                className={`relative group rounded-xl border bg-white/[0.02] text-left transition-all overflow-hidden cursor-pointer ${
                  historyEditMode
                    ? isSelected
                      ? 'border-seedtag-coral/60 bg-seedtag-coral/10'
                      : 'border-white/10 hover:border-white/20'
                    : 'border-white/10 hover:border-seedtag-coral/40 hover:bg-seedtag-coral/5'
                }`}
                onClick={() => {
                  if (historyEditMode) {
                    toggleHistorySelection(entry.request_id)
                  } else {
                    loadHistoryEntry(entry.request_id)
                    openSection('diagnostics')
                  }
                }}
              >
                <div className={`h-1.5 w-full ${entry.approved ? 'bg-emerald-400' : 'bg-amber-400'}`} />

                {historyEditMode && (
                  <div className={`absolute top-3 right-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? 'border-seedtag-coral bg-seedtag-coral' : 'border-white/30 bg-black/40'
                  }`}>
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      entry.approved ? 'bg-emerald-400/10' : 'bg-amber-400/10'
                    }`}>
                      <Film size={18} className={entry.approved ? 'text-emerald-400' : 'text-amber-400'} />
                    </div>
                    {!historyEditMode && (
                      <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                        entry.approved
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                      }`}>
                        {entry.approved ? 'Approved' : 'Revision'}
                      </span>
                    )}
                  </div>

                  <p className={`text-xs font-bold truncate leading-snug mb-1 transition-colors ${
                    historyEditMode ? 'text-white' : 'text-white group-hover:text-seedtag-coral'
                  }`}>
                    {entry.filename}
                  </p>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-seedtag-coral">{entry.attention_score.toFixed(0)}%</span>
                    <span className="text-[10px] text-gray-500 truncate">{entry.strategy_category}</span>
                  </div>

                  <div className="h-1 w-full rounded-full bg-white/10 mb-3">
                    <div className="h-1 rounded-full bg-seedtag-coral/60" style={{ width: `${Math.min(entry.attention_score, 100)}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-gray-600">
                    <span>{entry.frames_analyzed} frames</span>
                    <span>{new Date(entry.analyzed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating action bar */}
      {historyEditMode && selectedHistoryIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111]/95 px-5 py-3 shadow-2xl backdrop-blur-md">
          <span className="text-xs font-bold text-white">
            {selectedHistoryIds.size} run{selectedHistoryIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-white/10" />
          <button
            type="button"
            onClick={backupSelectedEntries}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-gray-200 transition-all hover:bg-white/10"
          >
            <Download size={13} /> Backup ZIP
          </button>
          <button
            type="button"
            onClick={deleteSelectedEntries}
            disabled={isDeletingHistory}
            className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/15 px-4 py-2 text-xs font-bold text-red-200 transition-all hover:bg-red-400/25 disabled:opacity-50"
          >
            {isDeletingHistory
              ? <><div className="w-3 h-3 border border-red-300 border-t-transparent rounded-full animate-spin" /> Deleting…</>
              : <><X size={13} /> Delete</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
