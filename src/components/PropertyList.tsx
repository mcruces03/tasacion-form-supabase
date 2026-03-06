import { useState, useEffect, useRef } from 'react';
import {
  List,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

export type PropertyStatus = 'to_sell' | 'sold' | 'cancelled' | 'to_rent' | 'rented' | 'pending';

const STATUS_LABELS: Record<PropertyStatus, string> = {
  to_sell: 'En venta',
  sold: 'Vendido',
  cancelled: 'Cancelado',
  to_rent: 'En alquiler',
  rented: 'Alquilado',
  pending: 'Pendiente',
};

const STATUS_COLORS: Record<PropertyStatus, string> = {
  to_sell: 'bg-blue-50 text-blue-700 border-blue-200',
  sold: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  to_rent: 'bg-violet-50 text-violet-700 border-violet-200',
  rented: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_DOT: Record<PropertyStatus, string> = {
  to_sell: 'bg-blue-400',
  sold: 'bg-green-400',
  cancelled: 'bg-red-400',
  to_rent: 'bg-violet-400',
  rented: 'bg-emerald-400',
  pending: 'bg-amber-400',
};

export interface PropertyRow {
  id: string;
  internal_id: string;
  direccion: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at?: string;
}

interface PropertyListProps {
  onNew: () => void;
  onEdit: (id: string) => void;
  onEmail: (id: string) => void;
  onDownloadPdf: (id: string) => void;
  onDownloadExcel: (id: string) => void;
}

export default function PropertyList({
  onNew,
  onEdit,
  onEmail,
  onDownloadPdf,
  onDownloadExcel,
}: PropertyListProps) {
  const [list, setList] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const [downloadMenuPos, setDownloadMenuPos] = useState<{ top: number; left: number } | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number } | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/properties');
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(Array.isArray(data) ? 'Error al cargar' : (data as { error?: string }).error);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar propiedades');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  useEffect(() => {
    const openMenuId = downloadMenuId || statusMenuId;
    if (!openMenuId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (downloadMenuId && downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
        setDownloadMenuId(null);
        setDownloadMenuPos(null);
      }
      if (statusMenuId && statusMenuRef.current && !statusMenuRef.current.contains(target)) {
        setStatusMenuId(null);
        setStatusMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [downloadMenuId, statusMenuId]);

  const handleDeleteConfirmed = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error al eliminar');
      }
      setList((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: PropertyStatus) => {
    setStatusMenuId(null);
    setStatusMenuPos(null);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error al actualizar estado');
      }
      setList((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar estado');
    }
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const allStatuses: PropertyStatus[] = ['to_sell', 'sold', 'to_rent', 'rented', 'pending', 'cancelled'];
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | null>(null);

  const filters: Array<{ label: string; value: PropertyStatus | null }> = [
    { label: 'Todos', value: null },
    { label: 'En venta', value: 'to_sell' },
    { label: 'En alquiler', value: 'to_rent' },
    { label: 'Vendidas', value: 'sold' },
    { label: 'Alquiladas', value: 'rented' },
  ];

  const filteredList = statusFilter ? list.filter((p) => p.status === statusFilter) : list;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-800">Propiedades</h1>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center justify-center gap-2 rounded-xl bg-oliva-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-oliva-600"
        >
          <Plus className="h-4 w-4" />
          Nueva valoración
        </button>
      </div>

      {!loading && list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = statusFilter === f.value;
            const count = f.value ? list.filter((p) => p.status === f.value).length : list.length;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-oliva-400 bg-oliva-500 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${active ? 'text-oliva-100' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-oliva-500" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <List className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p>No hay propiedades guardadas.</p>
          <p className="mt-1 text-sm">Crea una desde el formulario de valoración.</p>
          <button
            type="button"
            onClick={onNew}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-oliva-500 px-4 py-2 text-sm font-medium text-white hover:bg-oliva-600"
          >
            <Plus className="h-4 w-4" />
            Nueva valoración
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <List className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p>No hay propiedades con este estado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Dirección</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
                  <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-oliva-700">{row.internal_id}</td>
                    <td className="px-4 py-3 text-slate-800">{row.direccion || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (statusMenuId === row.id) {
                            setStatusMenuId(null);
                            setStatusMenuPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuH = allStatuses.length * 36 + 8;
                            const menuW = 160;
                            const gap = 4;
                            const spaceBelow = window.innerHeight - rect.bottom - gap;
                            const top = spaceBelow < menuH ? rect.top - menuH - gap : rect.bottom + gap;
                            const left = Math.min(rect.left, window.innerWidth - menuW - 8);
                            setStatusMenuPos({ top, left });
                            setStatusMenuId(row.id);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${STATUS_COLORS[row.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(row.id)}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-oliva-50 hover:text-oliva-700"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <div ref={downloadMenuId === row.id ? downloadMenuRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => {
                              if (downloadMenuId === row.id) {
                                setDownloadMenuId(null);
                                setDownloadMenuPos(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const menuW = 160;
                                const menuH = 88;
                                const gap = 4;
                                const spaceBelow = window.innerHeight - rect.bottom - gap;
                                const top = spaceBelow < menuH ? rect.top - menuH - gap : rect.bottom + gap;
                                const left = Math.min(rect.right - menuW, window.innerWidth - menuW - 8);
                                setDownloadMenuPos({ top, left });
                                setDownloadMenuId(row.id);
                              }
                            }}
                            className="flex items-center gap-0.5 rounded-lg p-2 text-slate-500 transition-colors hover:bg-oliva-50 hover:text-oliva-700"
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEmail(row.id)}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-oliva-50 hover:text-oliva-700"
                          title="Enviar por email"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.id)}
                          disabled={deletingId === row.id}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixed download dropdown */}
      {downloadMenuId && downloadMenuPos && (
        <div
          className="fixed z-[200] w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
          style={{ top: downloadMenuPos.top, left: downloadMenuPos.left }}
          ref={downloadMenuRef}
        >
          <button
            type="button"
            onClick={() => { const id = downloadMenuId; setDownloadMenuId(null); setDownloadMenuPos(null); onDownloadPdf(id); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-oliva-50"
          >
            <FileText className="h-4 w-4 text-oliva-500" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => { const id = downloadMenuId; setDownloadMenuId(null); setDownloadMenuPos(null); onDownloadExcel(id); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-oliva-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (() => {
        const prop = list.find((p) => p.id === confirmDeleteId);
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Eliminar propiedad</h3>
                  <p className="text-sm text-slate-500">
                    {prop ? `${prop.internal_id}${prop.direccion ? ` — ${prop.direccion}` : ''}` : ''}
                  </p>
                </div>
              </div>
              <p className="mb-5 text-sm text-slate-600">
                ¿Estás seguro de que quieres eliminar esta propiedad? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirmed}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Fixed status dropdown */}
      {statusMenuId && statusMenuPos && (
        <div
          className="fixed z-[200] w-40 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
          style={{ top: statusMenuPos.top, left: statusMenuPos.left }}
          ref={statusMenuRef}
        >
          {allStatuses.map((s) => {
            const current = list.find((p) => p.id === statusMenuId)?.status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChange(statusMenuId, s)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${s === current ? 'font-semibold text-oliva-700 bg-oliva-50' : 'text-gray-700'}`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
