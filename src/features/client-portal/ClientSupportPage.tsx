import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import {
  MessageSquare,
  Mail,
  Phone,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { SupportTicket, SupportTicketPriority } from '../../types/communication';
import {
  subscribeSupportTickets,
  createSupportTicket,
} from '../../services/support/supportService';
import { formatDate } from '../../utils/formatters';

export function ClientSupportPage() {
  const { currentUser, isLiveAuth, firebaseUser, currentRole } = useAuth();
  const clientId = currentUser?.clientId || 'client_apex_01';
  const clientName = currentUser?.displayName || 'Apex Retail BD';
  const actor = {
    uid: (isLiveAuth ? firebaseUser?.uid : currentUser?.id) || 'usr_client_dhaka',
    email: (isLiveAuth ? firebaseUser?.email : currentUser?.email) || 'ceo@apexretailbd.com',
    role: currentRole as 'admin' | 'team' | 'client',
    name: currentUser?.displayName || firebaseUser?.displayName || 'Client Representative',
    clientId,
  };

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeSupportTickets(
      { clientId },
      (items) => {
        setTickets(items);
        setLoading(false);
      },
      { uid: actor.uid, role: 'client', clientId },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, actor.uid]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await createSupportTicket(
        {
          clientId,
          clientName,
          subject: subject.trim(),
          description: description.trim(),
          priority,
        },
        actor
      );

      setSubject('');
      setDescription('');
      setPriority('medium');
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit support request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 flex items-center gap-1"><Clock className="w-3 h-3" /> In Progress</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Open</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Communications"
        description="Submit ad revision requests, report tracking anomalies, or schedule a strategy sync with your dedicated Bounce Growth account team."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsModalOpen(true)}
          >
            New Support Request
          </Button>
        }
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Support Inquiries & Action Threads"
              subtitle={`Live inquiries linked to ${clientName} (Total: ${tickets.length})`}
            />

            {loading ? (
              <LoadingState message="Loading support inquiries..." />
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-6 h-6 text-slate-400" />}
                title="No open support conversations"
                description="Have a question about conversion tracking or campaign scaling? Start a thread here."
                actionLabel="Create Request"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-xs">{ticket.subject}</h4>
                        <p className="text-[11px] text-slate-400">
                          Submitted on {formatDate(ticket.createdAt)} by {ticket.createdByName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {ticket.description}
                    </p>

                    {ticket.resolutionNotes && (
                      <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-xs space-y-1">
                        <span className="font-semibold text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Bounce Growth Specialist Resolution Notes:
                        </span>
                        <p className="text-emerald-800 whitespace-pre-wrap">{ticket.resolutionNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Your Dedicated Team"
              subtitle="Bounce Growth Tracking Lead"
            />
            <div className="p-4 space-y-3 text-xs text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Lead Specialist: Tanvir Rahman</p>
                <p className="text-[11px] text-slate-500">Tracking Engineer & Meta Media Buyer</p>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>tanvir@bouncegrowth.com</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>+880 1712-000000 (Dhaka HQ)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* New Support Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit New Support Request"
        description="Report a tracking anomaly, request an ad budget adjustment, or submit a technical inquiry."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Input
            label="Inquiry Subject"
            placeholder="e.g. Meta CAPI event matching score dropped below 8.0"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <Select
            label="Urgency & Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
            options={[
              { value: 'urgent', label: 'Urgent (Affecting Live Ad Spend)' },
              { value: 'high', label: 'High Priority' },
              { value: 'medium', label: 'Standard / Medium' },
              { value: 'low', label: 'Low / General Question' },
            ]}
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide exact URLs, order numbers, screenshots descriptions, or conversion tag errors..."
              rows={4}
              required
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
