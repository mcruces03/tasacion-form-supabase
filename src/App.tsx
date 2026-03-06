import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Home,
  FileText,
  Ruler,
  ClipboardList,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Mail,
  X,
  Database,
  List,
  Save,
  Loader2,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import AccordionSection from './components/AccordionSection';
import FormField from './components/FormField';
import ImageUpload from './components/ImageUpload';
import PropertyList from './components/PropertyList';
import Select from './components/Select';
import { type ValoracionForm, defaultFormValues } from './types';
import { exportToPdf, exportToPdfBlob } from './utils/exportPdf';
import { exportToExcel, exportToExcelBlob } from './utils/exportExcel';
import { loadFormFromStorage, saveFormToStorage, mergeFormFromApi } from './utils/persistForm';

function countFilledKeys(obj: Record<string, unknown>, keys: string[]): number {
  return keys.filter((k) => {
    const v = obj[k];
    return typeof v === 'boolean' ? v : Boolean(v);
  }).length;
}

function countFilledArray(arr: string[]): number {
  return arr.filter(Boolean).length;
}

function parseCount(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) || n < 0 ? 0 : Math.min(n, 20);
}

function resizeArray(arr: string[], length: number): string[] {
  if (length <= 0) return [];
  if (arr.length === length) return arr;
  if (arr.length > length) return arr.slice(0, length);
  return [...arr, ...Array(length - arr.length).fill('')];
}

const basicKeys = [
  'fechaVisita', 'asesor', 'direccion', 'propietarios', 'oficina',
  'zona', 'telefonos', 'operacion', 'razonVenta', 'necesitaComprar', 'caracteristicasProximaCompra',
];
const edificioKeys = [
  'anoConstruccion', 'tipo', 'plantas', 'fachada', 'calefaccion',
  'ascensor', 'porteria', 'interfono', 'piscina', 'jardinComunitario',
];
const descripcionKeys = [
  'planta', 'dormitorios', 'banos', 'estado', 'gastosComunes',
  'terrazaBalcon', 'jardinPatio', 'garaje', 'exterior', 'interior', 'notas',
];
const titulacionKeys = [
  'expectativaCliente', 'fechaAdquisicion', 'hipoteca', 'banco',
  'compra', 'herencia', 'divorcio', 'valoracion',
];
const medidasFixedKeys = [
  'recibidor', 'comedor', 'cocina', 'aseo',
  'terrazaAbierta', 'terrazaCerrada', 'patio', 'pasilloDist', 'galeria',
  'totalesUtiles', 'totalesConst',
];

const DEFAULT_EMAIL = 'mfcruces@gmail.com';

function parseHash(): { view: 'list' | 'form'; editId: string | null; action: string | null } {
  const hash = window.location.hash.slice(1) || '/';
  if (hash === '/properties' || hash === '/properties/') {
    return { view: 'list', editId: null, action: null };
  }
  const match = hash.match(/^\/properties\/([^/?#]+)/);
  if (match) {
    const action = hash.includes('action=email') ? 'email' : null;
    return { view: 'form', editId: match[1], action };
  }
  return { view: 'form', editId: null, action: null };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [form, setForm] = useState<ValoracionForm>(loadFormFromStorage);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const cleanFormRef = useRef<string>('');
  const [showNavConfirm, setShowNavConfirm] = useState(false);
  const pendingHashRef = useRef<string | null>(null);

  const formIsDirty = useCallback(() => {
    if (!cleanFormRef.current) return false;
    return JSON.stringify(form) !== cleanFormRef.current;
  }, [form]);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash();
      const leavingForm = route.view === 'form';
      const stayingOnSameForm = next.view === 'form' && next.editId === route.editId;
      if (leavingForm && !stayingOnSameForm && formIsDirty()) {
        pendingHashRef.current = window.location.hash;
        window.location.hash = route.editId ? `/properties/${route.editId}` : '/';
        setShowNavConfirm(true);
        return;
      }
      setRoute(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [route, formIsDirty]);

  useEffect(() => {
    if (route.view === 'form' && route.editId) {
      let cancelled = false;
      setEditInternalId(null);
      fetch(`/api/properties/${route.editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const merged = data?.data ? mergeFormFromApi(data.data) : defaultFormValues;
          setForm(merged);
          cleanFormRef.current = JSON.stringify(merged);
          if (data?.internal_id) setEditInternalId(data.internal_id);
          if (route.action === 'email') {
            setShowEmailModal(true);
            setSendEmailError(null);
            setSendEmailSuccess(false);
            window.location.hash = `/properties/${route.editId}`;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setForm(defaultFormValues);
            cleanFormRef.current = JSON.stringify(defaultFormValues);
          }
        });
      return () => { cancelled = true; };
    }
    if (route.view === 'form' && !route.editId) {
      const loaded = loadFormFromStorage();
      setForm(loaded);
      cleanFormRef.current = JSON.stringify(loaded);
      setEditInternalId(null);
    }
  }, [route.view, route.editId, route.action]);

  useEffect(() => {
    const t = setTimeout(() => saveFormToStorage(form), 400);
    return () => clearTimeout(t);
  }, [form]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailToSend, setEmailToSend] = useState(DEFAULT_EMAIL);
  const [sendEmailLoading, setSendEmailLoading] = useState(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sendEmailSuccess, setSendEmailSuccess] = useState(false);
  const [saveDbLoading, setSaveDbLoading] = useState(false);
  const [saveDbMessage, setSaveDbMessage] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [editInternalId, setEditInternalId] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [exportMenuStyle, setExportMenuStyle] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  useEffect(() => {
    if (showExportMenu && exportButtonRef.current) {
      const rect = exportButtonRef.current.getBoundingClientRect();
      const menuHeight = 112;
      const menuWidth = 192;
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openAbove = spaceBelow < menuHeight && rect.top > menuHeight + gap;
      const top = openAbove ? rect.top - menuHeight - gap : rect.bottom + gap;
      const left = Math.max(gap, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - gap));
      setExportMenuStyle({ top, left });
    } else {
      setExportMenuStyle(null);
    }
  }, [showExportMenu]);

  const numDorm = parseCount(form.dormitorios);
  const numBanos = parseCount(form.banos);

  const update = useCallback(
    <K extends keyof ValoracionForm>(field: K, value: ValoracionForm[K]) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'dormitorios') {
          const count = parseCount(value as string);
          next.dormMedidas = resizeArray(prev.dormMedidas, count);
        }
        if (field === 'banos') {
          const count = parseCount(value as string);
          next.banoMedidas = resizeArray(prev.banoMedidas, count);
        }
        return next;
      });
    },
    []
  );

  const updateDormMedida = useCallback((index: number, value: string) => {
    setForm((prev) => {
      const arr = [...prev.dormMedidas];
      arr[index] = value;
      return { ...prev, dormMedidas: arr };
    });
  }, []);

  const updateBanoMedida = useCallback((index: number, value: string) => {
    setForm((prev) => {
      const arr = [...prev.banoMedidas];
      arr[index] = value;
      return { ...prev, banoMedidas: arr };
    });
  }, []);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    setForm(defaultFormValues);
    setShowResetConfirm(false);
  };

  const handleSendByEmail = async () => {
    const email = emailToSend.trim();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setSendEmailError('Introduce un email');
      return;
    }
    if (!re.test(email)) {
      setSendEmailError('Email no válido');
      return;
    }
    setSendEmailError(null);
    setSendEmailSuccess(false);
    setSendEmailLoading(true);
    try {
      const pdfBlob = await exportToPdfBlob(form);
      const excelBlob = exportToExcelBlob(form);

      const toBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

      const [pdfBase64, xlsxBase64] = await Promise.all([
        toBase64(pdfBlob),
        toBase64(excelBlob),
      ]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          form,
          pdfBase64,
          xlsxBase64,
          ...(route.editId ? { property_id: route.editId } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setSendEmailSuccess(true);
      setEmailToSend(DEFAULT_EMAIL);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setSendEmailError('Tiempo de espera agotado. Vuelve a intentar.');
      } else {
        setSendEmailError(e instanceof Error ? e.message : 'Error al enviar');
      }
    } finally {
      setSendEmailLoading(false);
    }
  };

  const handleSaveToDb = async () => {
    setSaveDbMessage(null);
    setSaveDbLoading(true);
    try {
      const isEdit = Boolean(route.editId);
      const url = isEdit ? `/api/properties/${route.editId}` : '/api/properties';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
      cleanFormRef.current = JSON.stringify(form);
      if (isEdit) {
        setSaveDbMessage('Cambios guardados correctamente.');
      } else {
        const internalId = (data as { internal_id?: string }).internal_id;
        setSaveDbMessage(internalId ? `Guardado correctamente. ID: ${internalId}` : 'Guardado correctamente en la base de datos.');
      }
    } catch (e) {
      setSaveDbMessage(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaveDbLoading(false);
    }
  };

  const medidasTotalCount = medidasFixedKeys.length + numDorm + numBanos;
  const medidasFilledCount = useMemo(
    () =>
      countFilledKeys(form as unknown as Record<string, unknown>, medidasFixedKeys) +
      countFilledArray(form.dormMedidas) +
      countFilledArray(form.banoMedidas),
    [form]
  );

  const totalFields = basicKeys.length + edificioKeys.length + descripcionKeys.length + titulacionKeys.length + medidasTotalCount;
  const totalFilled =
    countFilledKeys(form as unknown as Record<string, unknown>, [
      ...basicKeys, ...edificioKeys, ...descripcionKeys, ...titulacionKeys, ...medidasFixedKeys,
    ]) +
    countFilledArray(form.dormMedidas) +
    countFilledArray(form.banoMedidas);

  if (route.view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-oliva-50/40">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <a
              href="#/"
              className="flex items-center gap-3 rounded-lg transition-colors hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-oliva-500 to-oliva-600 shadow-md shadow-oliva-200">
                <Home className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 leading-tight">Valoración</h1>
                <p className="text-[11px] text-gray-400">Lista de propiedades</p>
              </div>
            </a>
          </div>
        </header>
        <PropertyList
          onNew={() => { window.location.hash = '/'; }}
          onEdit={(id) => { window.location.hash = `/properties/${id}`; }}
          onEmail={(id) => { window.location.hash = `/properties/${id}?action=email`; }}
          onDownloadPdf={async (id) => {
            try {
              const res = await fetch(`/api/properties/${id}`);
              const prop = await res.json();
              if (prop?.data) await exportToPdf(mergeFormFromApi(prop.data));
            } catch { /* ignore */ }
          }}
          onDownloadExcel={async (id) => {
            try {
              const res = await fetch(`/api/properties/${id}`);
              const prop = await res.json();
              if (prop?.data) exportToExcel(mergeFormFromApi(prop.data));
            } catch { /* ignore */ }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-oliva-50/40">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-oliva-500 to-oliva-600 shadow-md shadow-oliva-200">
                <Home className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 leading-tight">Valoración</h1>
                <p className="text-[11px] text-gray-400">
                  {route.editId
                    ? <span>Editar propiedad {editInternalId && <span className="font-mono font-semibold text-oliva-600">{editInternalId}</span>}</span>
                    : `${totalFilled}/${totalFields} campos`}
                </p>
              </div>
            </div>
            <a
              href="#/properties"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Propiedades</span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Limpiar formulario"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                ref={exportButtonRef}
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-oliva-500 to-oliva-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-oliva-200 transition-all hover:shadow-lg hover:shadow-oliva-300 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              {showExportMenu && exportMenuStyle && (
                <div
                  className="fixed z-[100] w-48 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
                  style={{ top: exportMenuStyle.top, left: exportMenuStyle.left }}
                >
                  <button
                    type="button"
                    onClick={async () => { await exportToPdf(form); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-oliva-50"
                  >
                    <FileText className="h-4 w-4 text-oliva-500" />
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => { exportToExcel(form); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-oliva-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Exportar Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExportMenu(false); setShowEmailModal(true); setSendEmailError(null); setSendEmailSuccess(false); }}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-oliva-50"
                  >
                    <Mail className="h-4 w-4 text-oliva-500" />
                    Enviar por email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExportMenu(false); setShowSaveConfirm(true); }}
                    disabled={saveDbLoading}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-oliva-50 disabled:opacity-60"
                  >
                    <Database className="h-4 w-4 text-sky-600" />
                    {route.editId ? 'Guardar cambios' : 'Guardar en BD'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-0.5 w-full bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-oliva-400 to-oliva-500 transition-all duration-500"
            style={{ width: `${totalFields > 0 ? (totalFilled / totalFields) * 100 : 0}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-24">

        <AccordionSection
          title="Datos de la visita"
          icon={<ClipboardList className="h-5 w-5" />}
          defaultOpen={true}
          filledCount={countFilledKeys(form as unknown as Record<string, unknown>, basicKeys)}
          totalCount={basicKeys.length}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Fecha de visita">
              <input type="date" value={form.fechaVisita} onChange={(e) => update('fechaVisita', e.target.value)} />
            </FormField>
            <FormField label="Asesor">
              <input type="text" value={form.asesor} onChange={(e) => update('asesor', e.target.value)} placeholder="Nombre del asesor" />
            </FormField>
            <FormField label="Dirección" className="sm:col-span-2">
              <input type="text" value={form.direccion} onChange={(e) => update('direccion', e.target.value)} placeholder="Dirección del inmueble" />
            </FormField>
            <FormField label="Propietarios">
              <input type="text" value={form.propietarios} onChange={(e) => update('propietarios', e.target.value)} placeholder="Nombre(s) del propietario" />
            </FormField>
            <FormField label="Oficina">
              <input type="text" value={form.oficina} onChange={(e) => update('oficina', e.target.value)} placeholder="Oficina" />
            </FormField>
            <FormField label="Zona">
              <input type="text" value={form.zona} onChange={(e) => update('zona', e.target.value)} placeholder="Zona" />
            </FormField>
            <FormField label="Teléfonos">
              <input type="tel" value={form.telefonos} onChange={(e) => update('telefonos', e.target.value)} placeholder="Número(s) de teléfono" />
            </FormField>
            <FormField label="Operación" className="sm:col-span-2">
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operacion"
                    checked={form.operacion === 'sell'}
                    onChange={() => update('operacion', 'sell')}
                    className="h-4 w-4 accent-oliva-500"
                  />
                  <span className="text-sm text-slate-700">Venta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operacion"
                    checked={form.operacion === 'rent'}
                    onChange={() => update('operacion', 'rent')}
                    className="h-4 w-4 accent-oliva-500"
                  />
                  <span className="text-sm text-slate-700">Alquiler</span>
                </label>
              </div>
            </FormField>
            <FormField label={form.operacion === 'rent' ? 'Razón de alquiler' : 'Razón de venta'} className="sm:col-span-2">
              <input type="text" value={form.razonVenta} onChange={(e) => update('razonVenta', e.target.value)} placeholder={form.operacion === 'rent' ? 'Motivo del alquiler' : 'Motivo de la venta'} />
            </FormField>
            <FormField label="¿Necesita comprar?">
              <Select
                value={form.necesitaComprar}
                onChange={(v) => update('necesitaComprar', v)}
                options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]}
              />
            </FormField>
            <FormField label="Características próxima compra">
              <input type="text" value={form.caracteristicasProximaCompra} onChange={(e) => update('caracteristicasProximaCompra', e.target.value)} placeholder="Descripción" />
            </FormField>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Edificio"
          icon={<Building2 className="h-5 w-5" />}
          filledCount={countFilledKeys(form as unknown as Record<string, unknown>, edificioKeys)}
          totalCount={edificioKeys.length}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Año de construcción">
              <input type="text" value={form.anoConstruccion} onChange={(e) => update('anoConstruccion', e.target.value)} placeholder="Ej: 1985" />
            </FormField>
            <FormField label="Tipo">
              <input type="text" value={form.tipo} onChange={(e) => update('tipo', e.target.value)} placeholder="Tipo de edificio" />
            </FormField>
            <FormField label="Plantas">
              <input type="text" value={form.plantas} onChange={(e) => update('plantas', e.target.value)} placeholder="Nº plantas" />
            </FormField>
            <FormField label="Fachada">
              <input type="text" value={form.fachada} onChange={(e) => update('fachada', e.target.value)} placeholder="Estado fachada" />
            </FormField>
            <FormField label="Calefacción">
              <input type="text" value={form.calefaccion} onChange={(e) => update('calefaccion', e.target.value)} placeholder="Tipo calefacción" />
            </FormField>
            <FormField label="Ascensor">
              <Select value={form.ascensor} onChange={(v) => update('ascensor', v)} options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]} />
            </FormField>
            <FormField label="Portería">
              <Select value={form.porteria} onChange={(v) => update('porteria', v)} options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]} />
            </FormField>
            <FormField label="Interfono">
              <Select value={form.interfono} onChange={(v) => update('interfono', v)} options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]} />
            </FormField>
            <FormField label="Piscina">
              <Select value={form.piscina} onChange={(v) => update('piscina', v)} options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]} />
            </FormField>
            <FormField label="Jardín comunitario">
              <Select value={form.jardinComunitario} onChange={(v) => update('jardinComunitario', v)} options={[{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }]} />
            </FormField>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Descripción del inmueble"
          icon={<Home className="h-5 w-5" />}
          filledCount={countFilledKeys(form as unknown as Record<string, unknown>, descripcionKeys)}
          totalCount={descripcionKeys.length}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Planta">
              <input type="text" value={form.planta} onChange={(e) => update('planta', e.target.value)} placeholder="Nº planta" />
            </FormField>
            <FormField label="Dormitorios">
              <input type="number" min="0" max="20" value={form.dormitorios} onChange={(e) => update('dormitorios', e.target.value)} placeholder="Nº dorm." />
            </FormField>
            <FormField label="Baños">
              <input type="number" min="0" max="20" value={form.banos} onChange={(e) => update('banos', e.target.value)} placeholder="Nº baños" />
            </FormField>
            <FormField label="Estado" className="col-span-2 sm:col-span-1">
              <Select
                value={form.estado}
                onChange={(v) => update('estado', v as ValoracionForm['estado'])}
                options={[
                  { value: 'libre', label: 'Libre' },
                  { value: 'ocupado', label: 'Ocupado' },
                  { value: 'vacio', label: 'Vacío' },
                  { value: 'amueblado', label: 'Amueblado' },
                ]}
              />
            </FormField>
            <FormField label="Gastos comunes" className="col-span-2 sm:col-span-1">
              <input type="text" value={form.gastosComunes} onChange={(e) => update('gastosComunes', e.target.value)} placeholder="€ / mes" />
            </FormField>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Terraza / Balcón">
              <input type="text" value={form.terrazaBalcon} onChange={(e) => update('terrazaBalcon', e.target.value)} placeholder="Descripción" />
            </FormField>
            <FormField label="Jardín / Patio">
              <input type="text" value={form.jardinPatio} onChange={(e) => update('jardinPatio', e.target.value)} placeholder="Descripción" />
            </FormField>
            <FormField label="Garaje">
              <input type="text" value={form.garaje} onChange={(e) => update('garaje', e.target.value)} placeholder="Descripción" />
            </FormField>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-4 py-2.5 transition-colors has-[:checked]:border-oliva-400 has-[:checked]:bg-oliva-50">
              <input type="checkbox" checked={form.exterior} onChange={(e) => update('exterior', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-oliva-500 focus:ring-oliva-400" />
              <span className="text-sm font-medium text-gray-700">Exterior</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-4 py-2.5 transition-colors has-[:checked]:border-oliva-400 has-[:checked]:bg-oliva-50">
              <input type="checkbox" checked={form.interior} onChange={(e) => update('interior', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-oliva-500 focus:ring-oliva-400" />
              <span className="text-sm font-medium text-gray-700">Interior</span>
            </label>
          </div>
          <div className="mt-4">
            <FormField label="Notas">
              <textarea value={form.notas} onChange={(e) => update('notas', e.target.value)} placeholder="Observaciones adicionales..." rows={3} />
            </FormField>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Titulación y cargas"
          icon={<FileText className="h-5 w-5" />}
          filledCount={countFilledKeys(form as unknown as Record<string, unknown>, titulacionKeys)}
          totalCount={titulacionKeys.length}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Expectativa cliente" className="sm:col-span-2">
              <input type="text" value={form.expectativaCliente} onChange={(e) => update('expectativaCliente', e.target.value)} placeholder="Precio esperado" />
            </FormField>
            <FormField label="Fecha de adquisición">
              <input type="text" value={form.fechaAdquisicion} onChange={(e) => update('fechaAdquisicion', e.target.value)} placeholder="Año o fecha" />
            </FormField>
            <FormField label="Valoración">
              <input type="text" value={form.valoracion} onChange={(e) => update('valoracion', e.target.value)} placeholder="Valor estimado" />
            </FormField>
            <FormField label="Hipoteca">
              <input type="text" value={form.hipoteca} onChange={(e) => update('hipoteca', e.target.value)} placeholder="Monto hipoteca" />
            </FormField>
            <FormField label="Banco">
              <input type="text" value={form.banco} onChange={(e) => update('banco', e.target.value)} placeholder="Entidad bancaria" />
            </FormField>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Origen de la propiedad</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-4 py-2.5 transition-colors has-[:checked]:border-oliva-400 has-[:checked]:bg-oliva-50">
                <input type="checkbox" checked={form.compra} onChange={(e) => update('compra', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-oliva-500 focus:ring-oliva-400" />
                <span className="text-sm font-medium text-gray-700">Compra</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-4 py-2.5 transition-colors has-[:checked]:border-oliva-400 has-[:checked]:bg-oliva-50">
                <input type="checkbox" checked={form.herencia} onChange={(e) => update('herencia', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-oliva-500 focus:ring-oliva-400" />
                <span className="text-sm font-medium text-gray-700">Herencia</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-4 py-2.5 transition-colors has-[:checked]:border-oliva-400 has-[:checked]:bg-oliva-50">
                <input type="checkbox" checked={form.divorcio} onChange={(e) => update('divorcio', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-oliva-500 focus:ring-oliva-400" />
                <span className="text-sm font-medium text-gray-700">Divorcio</span>
              </label>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="Medidas" icon={<Ruler className="h-5 w-5" />} filledCount={medidasFilledCount} totalCount={medidasTotalCount}>
          <p className="mb-3 text-xs text-gray-400">
            Ingresa las medidas en m².
            {numDorm === 0 && numBanos === 0 && (
              <span className="ml-1 text-oliva-600 font-medium">Completa dormitorios y baños en &quot;Descripción del inmueble&quot; para ver sus medidas aquí.</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="Recibidor">
              <input type="text" value={form.recibidor} onChange={(e) => update('recibidor', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Comedor">
              <input type="text" value={form.comedor} onChange={(e) => update('comedor', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Cocina">
              <input type="text" value={form.cocina} onChange={(e) => update('cocina', e.target.value)} placeholder="m²" />
            </FormField>
          </div>
          {numDorm > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Dormitorios ({numDorm})</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {form.dormMedidas.map((val, i) => (
                  <FormField key={`dorm-${i}`} label={`Dorm. ${i + 1}`}>
                    <input type="text" value={val} onChange={(e) => updateDormMedida(i, e.target.value)} placeholder="m²" />
                  </FormField>
                ))}
              </div>
            </div>
          )}
          {numBanos > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Baños ({numBanos})</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {form.banoMedidas.map((val, i) => (
                  <FormField key={`bano-${i}`} label={`Baño ${i + 1}`}>
                    <input type="text" value={val} onChange={(e) => updateBanoMedida(i, e.target.value)} placeholder="m²" />
                  </FormField>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="Aseo">
              <input type="text" value={form.aseo} onChange={(e) => update('aseo', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Terraza abierta">
              <input type="text" value={form.terrazaAbierta} onChange={(e) => update('terrazaAbierta', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Terraza cerrada">
              <input type="text" value={form.terrazaCerrada} onChange={(e) => update('terrazaCerrada', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Patio">
              <input type="text" value={form.patio} onChange={(e) => update('patio', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Pasillo dist.">
              <input type="text" value={form.pasilloDist} onChange={(e) => update('pasilloDist', e.target.value)} placeholder="m²" />
            </FormField>
            <FormField label="Galería">
              <input type="text" value={form.galeria} onChange={(e) => update('galeria', e.target.value)} placeholder="m²" />
            </FormField>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <FormField label="Totales útiles">
              <input type="text" value={form.totalesUtiles} onChange={(e) => update('totalesUtiles', e.target.value)} placeholder="m²" className="!border-oliva-300 !bg-oliva-50 font-semibold" />
            </FormField>
            <FormField label="Totales const.">
              <input type="text" value={form.totalesConst} onChange={(e) => update('totalesConst', e.target.value)} placeholder="m²" className="!border-oliva-300 !bg-oliva-50 font-semibold" />
            </FormField>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Fotografías"
          icon={<Camera className="h-5 w-5" />}
          filledCount={form.fotos.length}
          totalCount={Math.max(form.fotos.length, 1)}
        >
          <p className="mb-3 text-xs text-gray-400">
            Adjunta fotografías del inmueble desde la galería o usando la cámara del dispositivo.
          </p>
          <ImageUpload
            images={form.fotos}
            onChange={(fotos) => update('fotos', fotos)}
          />
        </AccordionSection>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShowSaveConfirm(true)}
            disabled={saveDbLoading}
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-oliva-500 to-oliva-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-oliva-200 transition-all hover:shadow-xl hover:shadow-oliva-300 active:scale-95 disabled:opacity-60"
          >
            {saveDbLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {route.editId ? 'Guardar Cambios' : 'Guardar Propiedad'}
          </button>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 sm:hidden">
        <button type="button" onClick={() => { setShowEmailModal(true); setSendEmailError(null); setSendEmailSuccess(false); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-600 text-white shadow-lg shadow-slate-300 transition-transform active:scale-90" title="Enviar por email">
          <Mail className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => void exportToPdf(form)} className="flex h-12 w-12 items-center justify-center rounded-full bg-oliva-500 text-white shadow-lg shadow-oliva-300 transition-transform active:scale-90" title="Exportar PDF">
          <FileText className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => exportToExcel(form)} className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-300 transition-transform active:scale-90" title="Exportar Excel">
          <FileSpreadsheet className="h-5 w-5" />
        </button>
      </div>

      {showNavConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNavConfirm(false); pendingHashRef.current = null; }} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Cambios sin guardar</h3>
            </div>
            <p className="mb-5 text-sm text-slate-600">
              Tienes cambios que no se han guardado. Si sales ahora, los perderás.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowNavConfirm(false); pendingHashRef.current = null; }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Quedarse
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNavConfirm(false);
                  cleanFormRef.current = JSON.stringify(form);
                  if (pendingHashRef.current) {
                    window.location.hash = pendingHashRef.current.replace(/^#/, '');
                    pendingHashRef.current = null;
                  }
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowResetConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Limpiar formulario</h3>
            </div>
            <p className="mb-5 text-sm text-slate-600">
              ¿Estás seguro de que quieres borrar todos los campos del formulario? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saveDbLoading && setShowSaveConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oliva-100">
                <Save className="h-5 w-5 text-oliva-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  {route.editId ? 'Guardar cambios' : 'Guardar nueva propiedad'}
                </h3>
                {route.editId && editInternalId && (
                  <p className="text-sm font-mono text-oliva-700">{editInternalId}</p>
                )}
              </div>
            </div>
            <p className="mb-5 text-sm text-slate-600">
              {route.editId
                ? `¿Confirmas que deseas guardar los cambios en la propiedad ${editInternalId || ''}?`
                : '¿Confirmas que deseas crear una nueva propiedad con los datos del formulario?'}
            </p>
            {saveDbMessage && (
              <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${saveDbMessage.startsWith('Guardado') || saveDbMessage.startsWith('Cambios') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {saveDbMessage}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowSaveConfirm(false); setSaveDbMessage(null); }}
                disabled={saveDbLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveToDb}
                disabled={saveDbLoading}
                className="flex-1 rounded-xl bg-oliva-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-oliva-600 disabled:opacity-60"
              >
                {saveDbLoading ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !sendEmailLoading && setShowEmailModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 pb-4">
              <h3 className="text-lg font-semibold text-slate-800">Enviar por email</h3>
              <button type="button" onClick={() => !sendEmailLoading && setShowEmailModal(false)} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">Se enviarán el informe en PDF y Excel a la dirección que indiques. Los datos también se guardarán en la base de datos si está configurada.</p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Email</label>
              <input
                type="email"
                value={emailToSend}
                onChange={(e) => { setEmailToSend(e.target.value); setSendEmailError(null); }}
                placeholder="ejemplo@email.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-oliva-400 focus:outline-none focus:ring-2 focus:ring-oliva-100"
                disabled={sendEmailLoading}
              />
            </div>
            {sendEmailError && <p className="mb-3 text-sm text-red-600">{sendEmailError}</p>}
            {sendEmailSuccess && <p className="mb-3 text-sm text-green-600">Informe enviado correctamente.</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => !sendEmailLoading && setShowEmailModal(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleSendByEmail} disabled={sendEmailLoading} className="flex-1 rounded-xl bg-oliva-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-oliva-600 disabled:opacity-60">
                {sendEmailLoading ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
