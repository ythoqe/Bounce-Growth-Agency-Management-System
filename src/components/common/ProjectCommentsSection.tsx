import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, ShieldAlert, Lock, Globe, User, Clock } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { ProjectComment } from '../../types/communication';
import { addProjectComment, subscribeProjectComments } from '../../services/communication/commentService';
import { Button } from './Button';

interface ProjectCommentsSectionProps {
  projectId: string;
  projectName: string;
  clientId: string;
}

export function ProjectCommentsSection({ projectId, projectName, clientId }: ProjectCommentsSectionProps) {
  const { currentRole, currentUser, firebaseUser, isLiveAuth } = useAuth();
  const actorUid = (isLiveAuth ? firebaseUser?.uid : currentUser?.id) || 'usr_anonymous';
  const actorName = currentUser?.displayName || firebaseUser?.displayName || 'Specialist';
  const actorRole = currentRole as 'admin' | 'team' | 'client';

  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newContent, setNewContent] = useState('');
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const unsub = subscribeProjectComments(
      projectId,
      (items) => setComments(items),
      { uid: actorUid, role: actorRole, clientId },
      (err) => setError(err.message)
    );

    return () => unsub();
  }, [projectId, actorUid, actorRole, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await addProjectComment(
        {
          projectId,
          clientId,
          content: newContent.trim(),
          clientVisible: actorRole === 'client' ? true : !isInternalOnly,
        },
        {
          uid: actorUid,
          name: actorName,
          role: actorRole,
        }
      );
      setNewContent('');
    } catch (err: any) {
      setError(err?.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          Project Activity & Communications
        </h4>
        <span className="text-[11px] text-slate-500">{comments.length} message{comments.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <MessageSquare className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-600">No communication recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Start a strategy discussion or leave QA notes.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 rounded-xl border text-xs ${
                !comment.clientVisible
                  ? 'bg-amber-50/40 border-amber-200/80'
                  : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{comment.authorName}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                      comment.authorRole === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : comment.authorRole === 'team'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {comment.authorRole}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {!comment.clientVisible ? (
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <Lock className="w-3 h-3 text-amber-600" /> Agency Internal
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Globe className="w-3 h-3 text-slate-400" /> Client Visible
                    </span>
                  )}
                  <span>{new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-slate-100">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={
            actorRole === 'client'
              ? 'Send feedback or message to your Bounce Growth lead...'
              : 'Add note, status update, or question...'
          }
          rows={2}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          {actorRole !== 'client' ? (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternalOnly}
                onChange={(e) => setIsInternalOnly(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1 font-medium text-amber-800">
                <Lock className="w-3 h-3" /> Internal Team Note (Hidden from client)
              </span>
            </label>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-600" /> Visible to Bounce Growth Team
            </span>
          )}

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!newContent.trim() || isSubmitting}
            icon={<Send className="w-3 h-3" />}
            className="text-xs"
          >
            {isSubmitting ? 'Posting...' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}
