
'use client';

import React, { useEffect, useState } from 'react';
import styles from './sidebar.module.css';
import { X, User, MessageSquare, Info, Building2, UserCircle, Image as ImageIcon, MessageCircle } from 'lucide-react';

interface FullLeadProps {
  leadId: number;
  onClose: () => void;
  users: Record<number, string>;
}

export default function LeadSidebar({ leadId, onClose, users }: FullLeadProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wazzupIframeUrl, setWazzupIframeUrl] = useState<string | null>(null);
  const [wazzupIframeLoading, setWazzupIframeLoading] = useState(false);
  const [wazzupIframeError, setWazzupIframeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'wazzup'>('details');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/partners/klykov/leads/' + leadId);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setErrorMsg(json.error || 'Неизвестная ошибка');
      }
    } catch (err: any) {
      console.error('Failed to fetch lead details', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMe = async () => {
    try {
      setUpdating(true);
      const res = await fetch('/api/partners/klykov/leads/' + leadId + '/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsible_user_id: data.lead.responsible_user_id })
      });
      const json = await res.json();
      if (json.success) {
        await fetchDetail(); // Refresh to show pending task
      } else {
        alert('Ошибка при создании задачи: ' + json.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [leadId]);

  const hasPendingUpdate = data?.tasks?.some((t: any) => 
    t.text.includes('Обновить подрядчика') || t.text.includes('Оновити підрядника')
  );

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCFValue = (cf: any) => {
    if (!cf || !cf.values) return '-';
    return cf.values.map((v: any) => v.value).join(', ');
  };

  const isImageUrl = (url: string) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  };

  const isWhatsAppNote = (note: any) => {
    const type = String(note?.note_type || '').toLowerCase();
    if (type === 'attachment') return false;
    const text = String(note?.params?.text || note?.params?.body || '').toLowerCase();
    const service = String(note?.params?.service || '').toLowerCase();
    const source = String(note?.params?.source || '').toLowerCase();
    const channel = String(note?.params?.channel || '').toLowerCase();

    const waRegex = /(whatsapp|wazzup|wa\.me|ватсап|вотсап)/i;
    const knownChatTypes = ['message_cashier', 'incoming_chat_message', 'outgoing_chat_message'];

    if (knownChatTypes.includes(type)) return true;
    if (waRegex.test(service) || waRegex.test(source) || waRegex.test(channel) || waRegex.test(text)) return true;

    // service_message is noisy (e.g. Google Drive), include only if WA markers exist
    if (type === 'service_message') {
      return waRegex.test(`${service} ${text} ${source} ${channel}`);
    }

    return false;
  };

  const whatsappNotes = (data?.history || []).filter(isWhatsAppNote);
  const whatsappTalks = data?.whatsappTalks || [];
  const whatsappEvents = data?.whatsappEvents || [];

  const getLeadPhone = () => {
    const contacts = data?.contacts || [];
    for (const contact of contacts) {
      for (const cf of contact?.custom_fields_values || []) {
        const fieldCode = String(cf?.field_code || '').toUpperCase();
        const fieldName = String(cf?.field_name || '').toLowerCase();
        if (fieldCode === 'PHONE' || fieldName.includes('телефон') || fieldName.includes('phone')) {
          const raw = String(cf?.values?.[0]?.value || '');
          const normalized = raw.replace(/\D/g, '');
          if (normalized) return normalized;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const loadWazzupIframe = async () => {
      if (!data || activeTab !== 'wazzup') return;
      if (wazzupIframeUrl || wazzupIframeLoading) return;

      const phone = getLeadPhone();
      if (!phone) {
        setWazzupIframeError('Не знайдено номер телефону у контакті');
        return;
      }

      try {
        setWazzupIframeLoading(true);
        setWazzupIframeError(null);

        const res = await fetch('/api/wazzup/iframe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, userId: data?.lead?.responsible_user_id || 'dashboard-user' })
        });

        const json = await res.json();
        if (!res.ok || !json?.url) {
          setWazzupIframeError(json?.error || 'Не вдалося отримати URL чату Wazzup');
          return;
        }

        setWazzupIframeUrl(json.url);
      } catch (err: any) {
        setWazzupIframeError(err?.message || 'Помилка завантаження Wazzup iframe');
      } finally {
        setWazzupIframeLoading(false);
      }
    };

    loadWazzupIframe();
  }, [activeTab, data, wazzupIframeLoading, wazzupIframeUrl]);

  if (!leadId) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.leadId}>#{leadId}</span>
            <span className={styles.leadName}>{loading ? 'Загрузка...' : data?.lead?.name || 'Лид'}</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            {!loading && data && (
               <button 
                 className={hasPendingUpdate ? styles.updateBtnPending : styles.updateBtn}
                 onClick={handleUpdateMe}
                 disabled={updating || hasPendingUpdate}
               >
                 {updating ? 'Создание...' : (hasPendingUpdate ? 'Запрос в работе' : 'Update me')}
               </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={styles.tabList}>
          <div 
            className={activeTab === 'details' ? styles.tab + ' ' + styles.tabActive : styles.tab}
            onClick={() => setActiveTab('details')}
          >
            <Info size={14} style={{marginRight: 6, display: 'inline', verticalAlign: 'middle'}} />
            Детали
          </div>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.skeletonContainer}>
                <div className={styles.skeletonSection} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div style={{marginTop: 20}} className={styles.skeletonSection} />
                <div className={styles.skeletonCard} />
                <div className={styles.skeletonCard} />
              </div>
            </div>
          ) : errorMsg ? (
            <div className={styles.loading} style={{color: 'red', flexDirection: 'column', gap: 10, padding: 20}}>
                <strong>Ошибка амоCRM:</strong>
                <div style={{fontSize: '12px', opacity: 0.8}}>{errorMsg}</div>
            </div>
          ) : !data ? (
            <div className={styles.loading}>Данные отсутствуют</div>
          ) : (
            <div className={styles.tabs}>
              {activeTab === 'details' && (
                <div className={styles.tabPanel}>
                  
                  {/* LEAD CORE FIELDS */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Основная информация</div>
                    <div className={styles.fieldsGrid}>
                      <Field label="Ответственный" value={users[data.lead.responsible_user_id] || 'Неизвестно'} />
                      <Field label="Бюджет" value={new Intl.NumberFormat('ru-RU').format(data.lead.price) + ' AED'} />
                      <Field label="Создан" value={formatDate(data.lead.created_at)} />
                      {data.lead.custom_fields_values?.map((cf: any) => (
                        <Field key={cf.field_id} label={cf.field_name} value={getCFValue(cf)} />
                      ))}
                    </div>
                  </div>

                  {/* CONTACTS */}
                  {data.contacts?.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>Контакты</div>
                      {data.contacts.map((contact: any) => (
                        <div key={contact.id} className={styles.fieldsGrid} style={{marginTop: 8, padding: 12, background: 'var(--row-hover)', borderRadius: 8}}>
                          <div style={{fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
                            <UserCircle size={16} /> {contact.name}
                          </div>
                          {contact.custom_fields_values?.map((cf: any) => (
                            <Field key={cf.field_id} label={cf.field_name} value={getCFValue(cf)} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* COMPANIES */}
                  {data.companies?.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>Компании</div>
                      {data.companies.map((company: any) => (
                        <div key={company.id} className={styles.fieldsGrid} style={{marginTop: 8, padding: 12, border: '1px solid var(--line-soft)', borderRadius: 8}}>
                          <div style={{fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
                            <Building2 size={16} /> {company.name}
                          </div>
                          {company.custom_fields_values?.map((cf: any) => (
                            <Field key={cf.field_id} label={cf.field_name} value={getCFValue(cf)} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string, value: any }) {
  if (!value || value === '-') return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );
}
