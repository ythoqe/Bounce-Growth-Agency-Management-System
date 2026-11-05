import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Deliverable, DeliverableVersion } from '../../types/deliverable';
import { Task } from '../../types/task';
import {
  createDeliverable,
  submitDeliverableRevision,
  reviewDeliverable,
  getDeliverableVersions,
} from '../../services/deliverables/deliverableService';
import { useAuth } from '../../features/auth/AuthContext';
import { ExternalLink, CheckCircle2, AlertCircle, XCircle, History, Clock } from 'lucide-react';

interface DeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  existingDeliverable?: Deliverable | null;
  mode: 'submit' | 'review' | 'revision';
  onSuccess?: () => void;
}

export function DeliverableModal({
  isOpen,
  onClose,
  task,
  existingDeliverable,
  mode,
  onSuccess,
}: DeliverableModalProps) {
  const { currentRole, currentUser, firebaseUser, isLiveAuth } = useAuth();
  const actorUid = (isLiveAuth ? firebaseUser?.uid : currentUser?.id) || 'usr_actor';
  const actorName = currentUser?.displayName || firebaseUser?.displayName || 'Specialist';
  const actorRole = currentRole as 'admin' | 'team' | 'client';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'revision_requested' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [versions, setVersions] = useState<DeliverableVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingDeliverable) {
      setTitle(existingDeliverable.title || '');
      setDescription(existingDeliverable.description || '');
      setExternalUrl(existingDeliverable.externalUrl || '');

      setLoadingVersions(true);
      getDeliverableVersions(existingDeliverable.id)
        .then((v) => setVersions(v))
        .catch(() => {})
        .finally(() => setLoadingVersions(false));
    } else if (task) {
      setTitle(`Deliverable: ${task.title}`);
      setDescription('');
      setExternalUrl('');
      setVersions([]);
    }
    setError(null);
  }, [task, existingDeliverable, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'submit' && task) {
        await createDeliverable(
          {
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            projectName: task.projectName,
            clientId: task.clientId,
            clientName: task.clientName,
            title,
            description,
            externalUrl: externalUrl.trim() || undefined,
            status: 'submitted',
          },
          { uid: actorUid, role: actorRole, name: actorName }
        );
      } else if (mode === 'revision' && existingDeliverable) {
        await submitDeliverableRevision(
          existingDeliverable.id,
          {
            title,
            description,
            externalUrl: externalUrl.trim() || undefined,
          },
          { uid: actorUid, role: actorRole, name: actorName }
        );
      } else if (mode === 'review' && existingDeliverable) {
        if (reviewDecision === 'revision_requested' && (!reviewNotes || reviewNotes.trim().length < 5)) {
          throw new Error('Please provide a written revision reason (at least 5 characters).');
        }
        await reviewDeliverable(
          existingDeliverable.id,
          {
            decision: reviewDecision,
            reviewNotes: reviewNotes.trim(),
          },
          { uid: actorUid, role: actorRole, name: actorName }
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'review'
          ? 'Client Review: Deliverable Sign-off'
          : mode === 'revision'
          ? `Submit Deliverable Revision (v${(existingDeliverable?.version || 1) + 1})`
          : 'Submit Task Deliverable for Review'
      }
      description={
        mode === 'review'
          ? 'Review the findings or verification dashboard provided by Bounce Growth.'
          : 'Provide milestone details, findings, or verified external dashboard URLs (Looker Studio, GTM Preview, etc.).'
      }
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode !== 'review' ? (
          <>
            <Input
              label="Deliverable Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GA4 Server-Side E-Commerce Purchase Event Verification"
              required
            />

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Detailed Summary & Scope Findings <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe setup details, test event results, deduplication event_id proof, or Tag Manager container notes..."
                rows={4}
                required
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <Input
              label="External Verification / Dashboard URL (Optional)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://lookerstudio.google.com/... or https://tagmanager.google.com/..."
              helperText="Cloud Storage file uploads are disabled on Starter Tier. Provide validated external dashboards or preview links."
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">{existingDeliverable?.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                  Version {existingDeliverable?.version}
                </span>
              </div>
              <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{existingDeliverable?.description}</p>
              {existingDeliverable?.externalUrl && (
                <div className="pt-2">
                  <a
                    href={existingDeliverable.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open External Verification Resource
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-900">Your Sign-off Decision</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewDecision('approved')}
                  className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    reviewDecision === 'approved'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Approve Deliverable
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('revision_requested')}
                  className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    reviewDecision === 'revision_requested'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Request Revision
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('rejected')}
                  className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    reviewDecision === 'rejected'
                      ? 'bg-red-50 border-red-500 text-red-800 ring-1 ring-red-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  Reject
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Review Feedback / Reason {reviewDecision === 'revision_requested' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewDecision === 'revision_requested'
                    ? 'State clearly what changes or additional tracking checks are required...'
                    : 'Optional note for Bounce Growth specialists...'
                }
                rows={3}
                required={reviewDecision === 'revision_requested'}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>
        )}

        {/* Version History */}
        {versions.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <h5 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Submission Version History ({versions.length})
            </h5>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {versions.map((ver) => (
                <div key={ver.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Version {ver.versionNumber}: {ver.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(ver.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 line-clamp-1">{ver.description}</p>
                  {ver.reviewNotes && (
                    <p className="text-amber-700 font-medium">Feedback: {ver.reviewNotes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Processing...'
              : mode === 'review'
              ? 'Submit Review Decision'
              : mode === 'revision'
              ? 'Submit New Version'
              : 'Submit Deliverable'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
