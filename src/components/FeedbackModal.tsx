'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import styles from './FeedbackModal.module.css';

export type FeedbackContext = {
  type: 'table' | 'scorecard';
  title: string;
  page: string;
  date: string;
};

type FeedbackModalProps = {
  context: FeedbackContext;
  onClose: () => void;
};

export function FeedbackModal({ context, onClose }: FeedbackModalProps) {
  const [ticketType, setTicketType] = useState<'Fix' | 'New Functions'>('Fix');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_name: context.page,
          component_name: context.title,
          date_context: context.date,
          ticket_type: ticketType,
          description,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <div className={styles.header}>
          <h2>Submit Developer Feedback</h2>
          <p>Please describe what needs to be fixed or added.</p>
        </div>

        {success ? (
          <div className={styles.successMessage}>
            <CheckIcon />
            <p>Feedback submitted successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.contextInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Component:</span>
                <span className={styles.value}>{context.title}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Page:</span>
                <span className={styles.value}>{context.page}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Date Context:</span>
                <span className={styles.value}>{context.date}</span>
              </div>
            </div>

            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeBtn} ${ticketType === 'Fix' ? styles.active : ''}`}
                onClick={() => setTicketType('Fix')}
              >
                Fix
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${ticketType === 'New Functions' ? styles.active : ''}`}
                onClick={() => setTicketType('New Functions')}
              >
                New Functions
              </button>
            </div>

            <div className={styles.inputGroup}>
              <textarea
                className={styles.textarea}
                placeholder="Describe the issue or new feature..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting || !description.trim()}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

export function FeedbackIconTrigger({ context }: { context: FeedbackContext }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(true);
        }} 
        className={styles.triggerBtn}
        title="Leave feedback for developers"
      >
        <div className={styles.triggerIcon} />
      </button>
      {isOpen && <FeedbackModal context={context} onClose={() => setIsOpen(false)} />}
    </>
  );
}
