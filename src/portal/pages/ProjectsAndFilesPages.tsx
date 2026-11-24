import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Send,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  FolderOpen,
  FileText,
  RotateCcw,
  X,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest, triggerSignedFileDownload, uploadPortalFile } from '../portalApi';
import { usePortalRouter } from '../PortalRouter';
import {
  formatPortalDate,
  formatPortalDateTime,
  formatStatusLabel,
  statusToneClass,
} from '../portalTypes';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PortalProjectsPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New project brief fields
  const [title, setTitle] = useState('');
  const [serviceName, setServiceName] = useState('Multimedia Production');
  const [orderId, setOrderId] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('');
  const [brandRequirements, setBrandRequirements] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [deliverableRequirements, setDeliverableRequirements] = useState('');
  const [requestedDeadline, setRequestedDeadline] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        portalRequest<{ projects: any[] }>('/projects'),
        portalRequest<{ orders: any[] }>('/orders'),
      ]);
      setProjects(pRes.projects || []);
      setOrders(oRes.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await portalRequest<{ project: any }>('/projects', {
        method: 'POST',
        body: {
          title,
          serviceName,
          orderId: orderId || undefined,
          description,
          objectives,
          preferredStyle,
          brandRequirements,
          targetAudience,
          deliverableRequirements,
          requestedDeadline,
        },
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      navigate(`/portal/projects/${res.project.id}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to submit project brief.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout
      title="My Projects"
      subtitle="Track every production stage from order confirmation to final deliverable approval."
    >
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Submit Project Brief</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading project workspaces...
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center space-y-3">
          <FolderKanban className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-sm font-semibold text-[#0F1D36]">No project workspaces yet</p>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Submit a project brief here or complete a service order to open a dedicated 10-stage production workspace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/portal/projects/${p.id}`)}
              className="bg-white border border-[#E6E2D8] hover:border-[#0F4C3A] rounded-xl p-5 text-left transition-colors space-y-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-[#64748B]">{p.referenceNumber}</p>
                  <h3 className="text-base font-semibold text-[#0F1D36] mt-0.5">{p.title}</h3>
                  <p className="text-xs text-[#475569]">{p.serviceName}</p>
                </div>
                <span className={`text-xs ${statusToneClass(p.currentStage)}`}>
                  {formatStatusLabel(p.currentStage)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#64748B]">
                  <span>Production Progress</span>
                  <span className="font-mono font-semibold text-[#0F1D36]">{p.progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#EFECE5] overflow-hidden">
                  <div
                    className="h-full bg-[#0F4C3A] transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, p.progressPercent || 10))}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                <span>Coordinator: {p.assignedCoordinator}</span>
                <span>
                  Revisions: {p.revisionsUsed}/{p.revisionLimit}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Submit Project Brief Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateProject}
            className="bg-white border border-[#E6E2D8] rounded-xl max-w-2xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0F1D36]">Submit Project Brief</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-[#64748B] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Project Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Service Type</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Linked Order (Optional)</label>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                >
                  <option value="">Standalone Project Brief</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.items[0]?.productName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Target Deadline</label>
                <input
                  type="date"
                  value={requestedDeadline}
                  onChange={(e) => setRequestedDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Project Description *</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Objectives</label>
                <input
                  type="text"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Preferred Visual Style</label>
                <input
                  type="text"
                  value={preferredStyle}
                  onChange={(e) => setPreferredStyle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Deliverable Specs</label>
                <input
                  type="text"
                  value={deliverableRequirements}
                  onChange={(e) => setDeliverableRequirements(e.target.value)}
                  placeholder="e.g. 4K MP4 + 9:16 social cut"
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Brand Guidelines / Notes</label>
              <input
                type="text"
                value={brandRequirements}
                onChange={(e) => setBrandRequirements(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Creating Workspace...' : 'Create Project Workspace'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// PROJECT WORKSPACE DETAIL (10-STAGE TIMELINE, DISCUSSIONS, DELIVERABLES, REVISIONS)
// =========================================================================

export const PortalProjectDetailPage: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { navigate } = usePortalRouter();
  const [detail, setDetail] = useState<{
    project: any;
    milestones: any[];
    messages: any[];
    attachments: any[];
    deliverables: any[];
    revisions: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Messaging
  const [msgText, setMsgText] = useState('');
  const [msgAttachments, setMsgAttachments] = useState<Array<{ id: string; fileName: string }>>([]);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Revisions
  const [revDesc, setRevDesc] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await portalRequest<any>(`/projects/${encodeURIComponent(projectId)}`);
        setDetail(res);
      } catch (err: any) {
        if (!silent) setError(err?.message || 'Unable to load project workspace.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadDetail(false);
    const interval = window.setInterval(() => {
      void loadDetail(true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadDetail]);

  const handleUploadProjectFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    forMessage = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const res = await uploadPortalFile(file, {
        projectId,
        category: forMessage ? 'message_attachment' : 'reference',
      });
      if (forMessage) {
        setMsgAttachments((prev) => [...prev, { id: res.file.id, fileName: res.file.fileName }]);
      } else {
        setNotice(`Uploaded ${res.file.fileName} securely.`);
        await loadDetail(true);
      }
    } catch (err: any) {
      setError(err?.message || 'File upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() && msgAttachments.length === 0) return;
    setSendingMsg(true);
    setError('');
    try {
      await portalRequest(`/projects/${encodeURIComponent(projectId)}/messages`, {
        method: 'POST',
        body: {
          body: msgText.trim(),
          attachmentIds: msgAttachments.map((a) => a.id),
        },
      });
      setMsgText('');
      setMsgAttachments([]);
      await loadDetail(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRev(true);
    setError('');
    setNotice('');
    try {
      await portalRequest(`/projects/${encodeURIComponent(projectId)}/revisions`, {
        method: 'POST',
        body: { description: revDesc.trim() },
      });
      setRevDesc('');
      setNotice('Revision request recorded and sent to the production team.');
      await loadDetail(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to submit revision request.');
    } finally {
      setSubmittingRev(false);
    }
  };

  const handleApproveDeliverable = async (deliverableId: string) => {
    setError('');
    try {
      await portalRequest(
        `/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/approve`,
        { method: 'POST', body: { note: 'Approved via Client Portal' } }
      );
      setNotice('Deliverable marked as approved.');
      await loadDetail(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to approve deliverable.');
    }
  };

  const project = detail?.project;

  return (
    <PortalLayout
      title={project ? project.title : 'Project Workspace'}
      subtitle={
        project
          ? `${project.referenceNumber} · ${project.serviceName} · Coordinator: ${project.assignedCoordinator}`
          : 'Production progress, team discussions, deliverables, and revision history.'
      }
    >
      <button
        type="button"
        onClick={() => navigate('/portal/projects')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F1D36] cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Projects</span>
      </button>

      {error && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {loading || !project ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading project workspace...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 10-Stage Visual Progress Timeline */}
          <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#0F1D36]">10-Stage Production Progress</h2>
                <p className="text-xs text-[#64748B]">
                  Team: {project.assignedTeam} · Target Deadline: {project.requestedDeadline || 'Per package turnaround'}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-[#0F4C3A]">{project.progressPercent}%</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(detail?.milestones || []).map((ms: any) => (
                <div
                  key={ms.id}
                  className={`p-2.5 rounded-lg border text-[11px] ${
                    ms.status === 'completed'
                      ? 'bg-[#F4F9F7] border-[#0F4C3A]/35 text-[#0F1D36] font-semibold'
                      : ms.status === 'in_progress'
                      ? 'bg-[#FFFBEB] border-[#B8923A] text-[#0F1D36] font-semibold'
                      : 'bg-[#FAF8F4] border-[#E6E2D8] text-[#64748B]'
                  }`}
                >
                  <span className="font-mono text-[10px] block text-[#94A3B8]">
                    Stage {ms.sortOrder} · {formatStatusLabel(ms.status)}
                  </span>
                  {ms.title}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Discussions Thread */}
            <div className="lg:col-span-2 bg-white border border-[#E6E2D8] rounded-xl flex flex-col">
              <div className="px-5 py-4 border-b border-[#E6E2D8] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Project Discussions</h3>
                <span className="text-[11px] text-[#64748B]">Auto-syncs every 10s</span>
              </div>
              <div className="p-5 space-y-3 max-h-[420px] overflow-y-auto flex-1">
                {detail?.messages?.length ? (
                  detail.messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border text-xs ${
                        m.senderRole === 'client'
                          ? 'bg-[#F4F9F7] border-[#C6E1D7] ml-6'
                          : 'bg-[#FAF8F4] border-[#E6E2D8] mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-[#0F1D36]">{m.senderName}</span>
                        <span className="font-mono text-[10px] text-[#64748B]">
                          {formatPortalDateTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-[#334155] whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#64748B] text-center py-6">
                    Start a thread with your assigned production coordinator below.
                  </p>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#E6E2D8] space-y-2.5">
                {msgAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {msgAttachments.map((a) => (
                      <span
                        key={a.id}
                        className="px-2 py-1 rounded bg-[#FAF8F4] border border-[#E6E2D8] text-[#0F1D36]"
                      >
                        {a.fileName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Write a message to your project team..."
                    className="flex-1 px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                  />
                  <label className="px-3 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer inline-flex items-center">
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleUploadProjectFile(e, true)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sendingMsg}
                    className="px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Brief, Deliverables, Revisions, Files */}
            <div className="space-y-5">
              {/* Deliverables */}
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Deliverables</h3>
                {detail?.deliverables?.length ? (
                  <div className="space-y-2.5">
                    {detail.deliverables.map((d: any) => (
                      <div key={d.id} className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[#0F1D36]">
                              {d.title} (v{d.version})
                            </p>
                            <p className={`text-[11px] ${statusToneClass(d.status)}`}>
                              {formatStatusLabel(d.status)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => triggerSignedFileDownload(d.fileId)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                          {d.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleApproveDeliverable(d.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1D36] hover:underline cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B]">
                    Completed production outputs will appear here for signed download and client sign-off.
                  </p>
                )}
              </div>

              {/* Revision Requests */}
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F1D36]">Revision Requests</h3>
                  <span className="font-mono text-xs text-[#0F1D36]">
                    {project.revisionsUsed} / {project.revisionLimit} used
                  </span>
                </div>
                {project.revisionsUsed >= project.revisionLimit ? (
                  <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315]">
                    Included revision quota reached ({project.revisionLimit}/{project.revisionLimit}). Additional revisions require explicit scope approval; credits are never deducted silently.
                  </div>
                ) : (
                  <form onSubmit={handleRequestRevision} className="space-y-2">
                    <textarea
                      rows={2}
                      required
                      value={revDesc}
                      onChange={(e) => setRevDesc(e.target.value)}
                      placeholder="Specify timestamps, copy updates, or visual adjustments..."
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={submittingRev}
                      className="w-full py-2 px-3 rounded-lg border border-[#0F1D36] text-xs font-semibold text-[#0F1D36] hover:bg-[#0F1D36] hover:text-white transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{submittingRev ? 'Submitting...' : 'Submit Revision Request'}</span>
                    </button>
                  </form>
                )}
                {detail?.revisions?.length ? (
                  <ul className="space-y-2 pt-2 border-t border-[#E6E2D8]">
                    {detail.revisions.map((r: any) => (
                      <li key={r.id} className="text-xs">
                        <div className="flex justify-between">
                          <span className="font-mono font-semibold text-[#0F1D36]">{r.revisionNumber}</span>
                          <span className={statusToneClass(r.status)}>{formatStatusLabel(r.status)}</span>
                        </div>
                        <p className="text-[#475569] mt-0.5">{r.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* Project Files */}
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F1D36]">Project Files</h3>
                  <label className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer">
                    + Upload
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleUploadProjectFile(e, false)}
                    />
                  </label>
                </div>
                {detail?.attachments?.length ? (
                  <ul className="space-y-2">
                    {detail.attachments.map((f: any) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#E6E2D8] last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#0F1D36] truncate">{f.fileName}</p>
                          <p className="text-[11px] text-[#64748B]">
                            v{f.version} · {formatBytes(f.sizeBytes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerSignedFileDownload(f.id)}
                          className="text-[#0F4C3A] hover:underline shrink-0 cursor-pointer"
                        >
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#64748B]">No files attached to this project yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// UNIFIED PROJECT DISCUSSIONS INBOX
// =========================================================================

export const PortalMessagesPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    portalRequest<{ messages: any[] }>('/messages')
      .then((res) => {
        if (active) setMessages(res.messages || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalLayout
      title="Project Discussions"
      subtitle="All direct messages across your active and completed project workspaces."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading discussions...</div>
        ) : messages.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <MessageSquare className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">No project messages yet</p>
            <button
              type="button"
              onClick={() => navigate('/portal/projects')}
              className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
            >
              Open My Projects
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E2D8]">
            {messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/portal/projects/${m.projectId}`)}
                className="w-full p-4 hover:bg-[#FAF8F4] text-left flex items-start justify-between gap-4 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-[#64748B]">
                    {m.projectReference} · {m.projectTitle}
                  </p>
                  <p className="text-sm font-semibold text-[#0F1D36] mt-0.5">{m.senderName}</p>
                  <p className="text-xs text-[#475569] mt-1 line-clamp-2">{m.body}</p>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8] shrink-0">
                  {formatPortalDateTime(m.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

// =========================================================================
// SECURE FILE CENTER
// =========================================================================

export const PortalFilesPage: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadFiles = useCallback(async (projectFilter?: string) => {
    setLoading(true);
    try {
      const qs = projectFilter ? `?projectId=${encodeURIComponent(projectFilter)}` : '';
      const [fRes, pRes] = await Promise.all([
        portalRequest<{ files: any[] }>(`/files${qs}`),
        portalRequest<{ projects: any[] }>('/projects'),
      ]);
      setFiles(fRes.files || []);
      setProjects(pRes.projects || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles(selectedProjectId || undefined);
  }, [loadFiles, selectedProjectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const res = await uploadPortalFile(file, {
        projectId: selectedProjectId || undefined,
        category: 'reference',
      });
      setNotice(`Uploaded "${res.file.fileName}" (v${res.file.version}) to private storage.`);
      await loadFiles(selectedProjectId || undefined);
    } catch (err: any) {
      setError(err?.message || 'File upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <PortalLayout
      title="My Files & Deliverables"
      subtitle="Private encrypted file center. Downloads use time-limited HMAC-signed links scoped exclusively to your account."
    >
      {error && (
        <div className="mb-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
      )}
      {notice && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E6E2D8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg text-[#0F1D36]"
            >
              <option value="">All Projects &amp; General Files</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.referenceNumber} — {p.title}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[#64748B] hidden sm:inline">
              Allowed: JPG, PNG, WEBP, MP4, MOV, PDF, DOCX, XLSX, PPTX, ZIP (max 15 MB)
            </span>
          </div>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload Private File'}</span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FolderOpen className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">No files stored yet</p>
            <p className="text-xs text-[#64748B]">Upload brand assets, creative briefs, or download completed deliverables here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-xs text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-medium">File Name</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Version</th>
                  <th className="py-3 px-4 font-medium">Size</th>
                  <th className="py-3 px-4 font-medium">Uploaded</th>
                  <th className="py-3 px-4 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2D8]">
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="py-3 px-4 text-xs font-semibold text-[#0F1D36] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0F4C3A] shrink-0" />
                      <span className="truncate max-w-xs">{f.fileName}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#475569]">{formatStatusLabel(f.category)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#64748B]">v{f.version}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#64748B]">{formatBytes(f.sizeBytes)}</td>
                    <td className="py-3 px-4 text-xs text-[#64748B]">{formatPortalDate(f.uploadedAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => triggerSignedFileDownload(f.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Signed Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
