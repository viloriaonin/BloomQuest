import React, { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, Download, FileQuestion, FolderArchive, Trash2 } from "lucide-react";
import { usePopup } from "../../components/PopupProvider";

const API_URL = "/api";

const RecycleBin = () => {
  const { showAlert, showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/recycle-bin`);
      if (!response.ok) throw new Error("Could not load recycle bin items.");
      const data = await response.json();
      setItems([
        ...(Array.isArray(data.subjects) ? data.subjects : []).map((item) => ({ ...item, itemType: "subject" })),
        ...(Array.isArray(data.questions) ? data.questions : []).map((item) => ({ ...item, itemType: "question" })),
        ...(Array.isArray(data.downloads) ? data.downloads : []).map((item) => ({ ...item, itemType: "download" })),
      ]);
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const itemKey = (item) => `${item.itemType}:${item.id}`;
  const groups = useMemo(() => items.reduce((result, item) => {
    const name = item.itemType === "subject" ? item.name : item.itemType === "download" ? "Downloaded files" : item.subject_name || "Unassigned subject";
    if (!result[name]) result[name] = { subject: null, questions: [], downloads: [] };
    if (item.itemType === "subject") result[name].subject = item;
    if (item.itemType === "question") result[name].questions.push(item);
    if (item.itemType === "download") result[name].downloads.push(item);
    return result;
  }, {}), [items]);

  const restore = async (item) => {
    const confirmed = await showConfirm(`Restore this ${item.itemType} to active content?`, "Restore Item");
    if (!confirmed) return;
    const response = await fetch(`${API_URL}/recycle-bin/${item.itemType}s/${item.id}/restore`, { method: "POST" });
    if (!response.ok) return showAlert("Could not restore this item.", "Restore Error");
    setItems((current) => current.filter((entry) => itemKey(entry) !== itemKey(item)));
  };

  const permanentlyDeleteSelected = async () => {
    const selected = items.filter((item) => selectedIds.includes(itemKey(item)));
    if (!selected.length) return;
    const confirmed = await showConfirm(`Permanently delete ${selected.length} selected item${selected.length === 1 ? "" : "s"}? This cannot be undone.`, "Delete Archived Items");
    if (!confirmed) return;
    const results = await Promise.all(selected.map((item) => fetch(`${API_URL}/recycle-bin/${item.itemType}s/${item.id}`, { method: "DELETE" })));
    const deleted = selected.filter((_, index) => results[index].ok).map(itemKey);
    if (deleted.length !== selected.length) await showAlert("Some items could not be deleted.", "Delete Error");
    setItems((current) => current.filter((item) => !deleted.includes(itemKey(item))));
    setSelectedIds((current) => current.filter((id) => !deleted.includes(id)));
  };

  const toggle = (item, checked) => setSelectedIds((current) => checked ? [...current, itemKey(item)] : current.filter((id) => id !== itemKey(item)));

  return (
    <div className="space-y-4 page-transition">
      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><FolderArchive size={17} className="text-[#C4485A]" /><h2>Recycle Bin</h2></div><p className="bq-admin-muted mt-1">Restore deleted subjects, questions, and downloaded files, or remove them permanently.</p></div>
          <button type="button" onClick={loadItems} className="bq-admin-action"><ArchiveRestore size={14} /> Refresh</button>
        </div>
      </section>
      {error && <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="bq-admin-panel bq-admin-muted">Loading recycle bin...</div> : !items.length ? <div className="bq-admin-panel bq-admin-muted py-8 text-center">Recycle Bin is empty.</div> : <>
        {selectedIds.length > 0 && <div className="flex items-center justify-between gap-3 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3"><span className="text-sm font-semibold text-red-200">{selectedIds.length} item{selectedIds.length === 1 ? "" : "s"} selected</span><button type="button" onClick={permanentlyDeleteSelected} className="bq-admin-action border-red-700 text-red-200 hover:bg-red-950"><Trash2 size={14} /> Delete permanently</button></div>}
        {Object.entries(groups).map(([name, group]) => <section key={name} className="bq-admin-panel"><div className="mb-4 flex items-center gap-2"><FolderArchive size={16} className="text-[#C4485A]" /><h2>{name}</h2></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.subject && <RecycleCard item={group.subject} checked={selectedIds.includes(itemKey(group.subject))} onToggle={toggle} onRestore={restore} />}{group.questions.map((item) => <RecycleCard key={itemKey(item)} item={item} checked={selectedIds.includes(itemKey(item))} onToggle={toggle} onRestore={restore} />)}{group.downloads.map((item) => <RecycleCard key={itemKey(item)} item={item} checked={selectedIds.includes(itemKey(item))} onToggle={toggle} onRestore={restore} />)}</div></section>)}
      </>}
    </div>
  );
};

const RecycleCard = ({ item, checked, onToggle, onRestore }) => {
  const isDownload = item.itemType === "download";
  const title = item.itemType === "subject" ? item.name : isDownload ? item.filename || item.action || "Downloaded file" : item.question;
  const detail = item.itemType === "subject" ? item.code || "No course code" : isDownload ? item.details || "Downloaded file" : `${item.subject_name || "Unassigned subject"} · ${item.bloom_level || "Unclassified"}`;
  const Icon = item.itemType === "subject" ? FolderArchive : isDownload ? Download : FileQuestion;
  return <article className="bq-admin-metric flex flex-col justify-between gap-4"><div className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={(event) => onToggle(item, event.target.checked)} aria-label={`Select ${title}`} className="mt-1 h-4 w-4 accent-[#C4485A]" /><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C4485A]/10 text-[#C4485A]"><Icon size={17} /></span><div className="min-w-0"><p className="font-medium text-[#ECEDEF] break-words">{title}</p><p className="bq-admin-muted mt-1 break-words text-sm">{detail}</p></div></div><button type="button" onClick={() => onRestore(item)} className="bq-secondary-button self-start px-2 py-1 text-xs"><ArchiveRestore size={13} /> Restore</button></article>;
};

export default RecycleBin;
