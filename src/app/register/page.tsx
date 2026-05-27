'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, ShieldAlert, Check, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import styles from './register.module.css';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repassword, setRepassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== repassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Simulated API call delay for registration request
      await new Promise(r => setTimeout(r, 1200));
      
      // Registration complete, show success screen
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/login" className={styles.headerButton}>
          Sign in <ArrowRight size={14} />
        </Link>
      </div>

      {/* Background Mesh Gradients */}
      <div className={styles.bgWrapper}>
        <div className={styles.meshPink} />
        <div className={styles.meshBlue} />
        <div className={styles.meshPurple} />
      </div>

      <div className={styles.contentWrapper}>
        {/* Left Sidebar */}
        <div className={styles.leftSidebar}>
          <div className={styles.sidebarTitle}>ForYou Analytics</div>
          
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${isSuccess ? styles.stepIconDone : styles.stepIconActive}`}>
              {isSuccess ? <Check size={14} /> : <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />}
            </div>
            <span style={{ color: isSuccess ? '#0f172a' : '#3b82f6' }}>Create Account</span>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${isSuccess ? styles.stepIconActive : styles.stepIconPending}`}>
              {isSuccess ? <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} /> : '2'}
            </div>
            <span style={{ color: isSuccess ? '#3b82f6' : '#94a3b8' }}>Admin Approval</span>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.stepIconPending}`}>3</div>
            <span style={{ color: '#94a3b8' }}>Access Workspace</span>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <h1 className={styles.mainTitle}>Create your account</h1>
                <p className={styles.mainSubtitle}>Sign up to request access to the dashboard</p>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={styles.error}
                    >
                      <ShieldAlert size={16} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleRegister} autoComplete="nope">
                  {/* Fake inputs to trick Chrome password manager and address autofill */}
                  <input style={{ display: 'none' }} type="text" name="fakename" />
                  <input style={{ display: 'none' }} type="email" name="fakeusernameremembered" />
                  <input style={{ display: 'none' }} type="password" name="fakepasswordremembered" />
                  
                  <div className={styles.formCard}>
                    <div className={styles.inputGroup}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <label className={styles.label}>First Name</label>
                          <div style={{ position: 'relative' }}>
                            <User 
                              size={18} 
                              style={{ 
                                position: 'absolute', 
                                left: '14px', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: '#94a3b8' 
                              }} 
                            />
                            <input 
                              type="text" 
                              className={styles.input}
                              style={{ paddingLeft: '42px' }}
                              placeholder="John"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              required
                              autoComplete="nope"
                              name="firstName-field"
                            />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className={styles.label}>Last Name</label>
                          <div style={{ position: 'relative' }}>
                            <User 
                              size={18} 
                              style={{ 
                                position: 'absolute', 
                                left: '14px', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: '#94a3b8' 
                              }} 
                            />
                            <input 
                              type="text" 
                              className={styles.input}
                              style={{ paddingLeft: '42px' }}
                              placeholder="Doe"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              required
                              autoComplete="nope"
                              name="lastName-field"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Email</label>
                      <div style={{ position: 'relative' }}>
                        <Mail 
                          size={18} 
                          style={{ 
                            position: 'absolute', 
                            left: '14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            color: '#94a3b8' 
                          }} 
                        />
                        <input 
                          type="email" 
                          className={styles.input}
                          style={{ paddingLeft: '42px' }}
                          placeholder="admin@foryou.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="nope"
                          name="email-field"
                        />
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock 
                          size={18} 
                          style={{ 
                            position: 'absolute', 
                            left: '14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            color: '#94a3b8' 
                          }} 
                        />
                        <input 
                          type="password" 
                          className={styles.input}
                          style={{ paddingLeft: '42px' }}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          name="new-password-field"
                        />
                      </div>
                    </div>

                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                      <label className={styles.label}>Re-enter</label>
                      <div style={{ position: 'relative' }}>
                        <Lock 
                          size={18} 
                          style={{ 
                            position: 'absolute', 
                            left: '14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            color: '#94a3b8' 
                          }} 
                        />
                        <input 
                          type="password" 
                          className={styles.input}
                          style={{ paddingLeft: '42px' }}
                          placeholder="••••••••"
                          value={repassword}
                          onChange={(e) => setRepassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          name="confirm-password-field"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className={styles.button}
                    disabled={loading}
                    style={{ width: '140px' }}
                  >
                    {loading ? 'Sending...' : (
                      <>
                        Register <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}
              >
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  margin: '0 auto 24px auto', color: '#16a34a' 
                }}>
                  <CheckCircle2 size={32} />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
                  Request Sent Successfully!
                </h2>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                  Your request has been sent to the admin. Once they approve your registration, you will be granted access.
                </p>
                
                <Link href="/login" style={{ 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: '#0f172a', color: 'white', padding: '12px 24px', borderRadius: '8px',
                  textDecoration: 'none', fontWeight: 500, fontSize: '14px', transition: 'all 0.2s ease'
                }}>
                  Return to Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
