
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
      const res = await fetch('/api/partners/facebook/leads/' + leadId);
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
      const res = await fetch('/api/partners/facebook/leads/' + leadId + '/task', {
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
          <div 
            className={activeTab === 'history' ? styles.tab + ' ' + styles.tabActive : styles.tab}
            onClick={() => setActiveTab('history')}
          >
            <MessageSquare size={14} style={{marginRight: 6, display: 'inline', verticalAlign: 'middle'}} />
            История
          </div>
          <div 
            className={activeTab === 'wazzup' ? styles.tab + ' ' + styles.tabActive : styles.tab}
            onClick={() => setActiveTab('wazzup')}
          >
            <MessageCircle size={14} style={{marginRight: 6, display: 'inline', verticalAlign: 'middle', color: '#25D366'}} />
            WhatsApp
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

              {activeTab === 'history' && (
                <div className={styles.tabPanel}>
                  <div className={styles.history}>
                    {data.history?.length === 0 ? (
                      <div className={styles.system}>История пуста</div>
                    ) : (
                      data.history.map((note: any) => {
                        const isSystem = note.note_type !== 'common' && note.note_type !== 'message_cashier';
                        const text = note.params?.text || note.params?.body || '';
                        
                        // Try to find image in files with more aggressive matching
                        let imageUrl = null;
                        
                        // 1. Check if it's a file note with direct ID/UUID
                        if (note.params?.file_uuid || note.params?.version_uuid || (note.note_type === 'file' && note.params?.id)) {
                           const uuid = note.params?.file_uuid || note.params?.version_uuid || note.params?.id;
                           imageUrl = '/api/partners/facebook/files/' + uuid;
                        }

                        // 2. Try to match by filename in text if data.files has contents
                        if (!imageUrl && data.files?.length > 0) {
                          const screenKeywords = ['снимок', 'photo', 'файл', 'image', '.png', '.jpg', 'экран', 'img_'];
                          const containsKeyword = screenKeywords.some(key => text.toLowerCase().includes(key));
                          
                          if (containsKeyword) {
                            const matchedFile = data.files.find((f: any) => {
                               const baseName = f.name.split('.')[0].toLowerCase();
                               const cleanText = text.toLowerCase();
                               return cleanText.includes(baseName) || cleanText.includes(f.name.toLowerCase());
                            });
                            
                            if (matchedFile) {
                               imageUrl = '/api/partners/facebook/files/' + matchedFile.id;
                            }
                          }
                        }

                        // 3. Fallback for direct URLs in notes
                        if (!imageUrl && note.params?.url && isImageUrl(note.params.url)) {
                          imageUrl = note.params.url;
                        }

                        return (
                          <div key={note.id} className={!isSystem || imageUrl ? styles.historyItem : styles.system}>
                            {!isSystem || imageUrl ? (
                              <React.Fragment>
                                <div className={styles.avatar}>
                                  {isSystem || imageUrl ? <ImageIcon size={16} /> : <User size={16} />}
                                </div>
                                <div className={styles.message}>
                                  <div className={styles.messageHeader}>
                                    <span className={styles.author}>
                                      {imageUrl ? 'Изображение' : (isSystem ? 'Файл / Событие' : (users[note.responsible_user_id] || 'Система'))}
                                    </span>
                                    <span className={styles.time}>{formatDate(note.created_at)}</span>
                                  </div>
                                  
                                  {text && !imageUrl && <div className={styles.text}>{text}</div>}
                                  
                                  {/* Action button if it looks like a file but no preview yet */}
                                  {!imageUrl && (text.includes('Снимок') || text.includes('PHOTO') || note.note_type === 'file') && (
                                    <div style={{marginTop: 8}}>
                                      <button 
                                        onClick={() => {
                                          // Try a desperate search
                                          const base = text.split('«').pop()?.split('»')[0] || text;
                                          const f = data.files?.find((file: any) => file.name.includes(base.trim()) || base.includes(file.name.split('.')[0]));
                                          if (f) window.open('/api/partners/facebook/files/' + f.id, '_blank');
                                          else alert('Файл не найден в базе данных этого лида. Проверьте вкладку "Детали".');
                                        }}
                                        style={{padding: '4px 12px', fontSize: '11px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer'}}
                                      >
                                        Открыть оригинал файла
                                      </button>
                                    </div>
                                  )}

                                  {imageUrl && (
                                    <div style={{marginTop: 8}}>
                                      {text && <div className={styles.text} style={{marginBottom: 8, fontSize: '11px', color: 'var(--muted)'}}>{text}</div>}
                                      <img 
                                        src={imageUrl} 
                                        alt="Attachment" 
                                        style={{maxWidth: '100%', borderRadius: 8, border: '1px solid var(--line)', maxHeight: '400px', objectFit: 'contain', cursor: 'zoom-in'}} 
                                        onClick={() => window.open(imageUrl, '_blank')}
                                        onError={(e) => {
                                          console.error('Image load error:', imageUrl);
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </React.Fragment>
                            ) : (
                              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
                                <div>{(text || 'Системное событие') + ' - ' + formatDate(note.created_at)}</div>
                                {(text.includes('Снимок') || text.includes('PHOTO')) && (
                                   <button 
                                     onClick={() => {
                                        const base = text.split('«').pop()?.split('»')[0] || text;
                                        const f = data.files?.find((file: any) => file.name.includes(base.trim()));
                                        if (f) window.open('/api/partners/facebook/files/' + f.id, '_blank');
                                        else alert('Файл не найден. Попробуйте обновить страницу.');
                                     }}
                                     style={{padding: '2px 8px', fontSize: '10px', background: 'none', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--muted)', cursor: 'pointer'}}
                                   >
                                     Попробовать открыть фото
                                   </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }).reverse()
                    )}
                    {/* Debug info */}
                    <div style={{fontSize: '9px', color: 'var(--muted)', marginTop: 20, textAlign: 'center', opacity: 0.5}}>
                      Debug: {data.files?.length || 0} files loaded for this lead.
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wazzup' && (
                <div className={styles.tabPanel}>
                  <div className={styles.history}>
                    {wazzupIframeLoading && (
                      <div className={styles.system}>Завантаження Wazzup чату...</div>
                    )}

                    {wazzupIframeError && (
                      <div className={styles.system}>{wazzupIframeError}</div>
                    )}

                    {wazzupIframeUrl && (
                      <div style={{ marginBottom: 12 }}>
                        <iframe
                          src={wazzupIframeUrl}
                          title="Wazzup Chat"
                          style={{ width: '100%', height: '520px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}
                          allow="clipboard-read; clipboard-write"
                        />
                      </div>
                    )}

                    {whatsappNotes.length > 0 && (
                      whatsappNotes.map((note: any) => {
                        const text = note.params?.text || note.params?.body || '';

                        return (
                          <div key={note.id} className={styles.historyItem}>
                            <React.Fragment>
                              <div className={styles.avatar}>
                                <MessageCircle size={16} />
                              </div>
                              <div className={styles.message}>
                                <div className={styles.messageHeader}>
                                  <span className={styles.author}>WhatsApp</span>
                                  <span className={styles.time}>{formatDate(note.created_at)}</span>
                                </div>
                                {text ? <div className={styles.text}>{text}</div> : <div className={styles.system}>Порожнє сервісне повідомлення</div>}
                              </div>
                            </React.Fragment>
                          </div>
                        );
                      }).reverse()
                    )}

                    {whatsappEvents.length > 0 && (
                      whatsappEvents.map((ev: any) => {
                        const evType = String(ev.type || '').toLowerCase();
                        const isIncoming = evType.includes('incoming');
                        return (
                          <div key={ev.id} className={styles.historyItem}>
                            <React.Fragment>
                              <div className={styles.avatar}>
                                <MessageCircle size={16} />
                              </div>
                              <div className={styles.message}>
                                <div className={styles.messageHeader}>
                                  <span className={styles.author}>{isIncoming ? 'WhatsApp • Вхідне' : 'WhatsApp • Вихідне'}</span>
                                  <span className={styles.time}>{formatDate(ev.created_at)}</span>
                                </div>
                                <div className={styles.text}>Подія чату зафіксована в AMO, але текст повідомлення недоступний через API scope.</div>
                              </div>
                            </React.Fragment>
                          </div>
                        );
                      }).reverse()
                    )}

                    {whatsappTalks.length > 0 && (
                      <div style={{marginTop: 8}}>
                        {whatsappTalks.map((talk: any) => (
                          <div key={talk.talk_id} className={styles.historyItem}>
                            <React.Fragment>
                              <div className={styles.avatar}>
                                <MessageCircle size={16} />
                              </div>
                              <div className={styles.message}>
                                <div className={styles.messageHeader}>
                                  <span className={styles.author}>WhatsApp бесіда #{talk.talk_id}</span>
                                  <span className={styles.time}>{formatDate(talk.updated_at)}</span>
                                </div>
                                <div className={styles.text}>Джерело: {talk.origin || 'n/a'}. Статус: {talk.status || 'n/a'}.</div>
                              </div>
                            </React.Fragment>
                          </div>
                        ))}
                      </div>
                    )}

                    {whatsappNotes.length === 0 && whatsappEvents.length === 0 && whatsappTalks.length === 0 && !wazzupIframeUrl && !wazzupIframeLoading && (
                      <div className={styles.system}>WhatsApp повідомлень не знайдено</div>
                    )}
                  </div>
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
