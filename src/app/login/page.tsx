'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ShieldAlert, Check, Loader2, ArrowRight } from 'lucide-react';
import { getPartnerHomePath } from '@/lib/partners';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (data.user.partnerId) {
        window.location.href = getPartnerHomePath(data.user.partnerId);
      } else {
        window.location.href = '/marketing';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/register" className={styles.headerButton}>
          Register <ArrowRight size={14} />
        </Link>
      </div>

      {/* Background Mesh Gradients */}
      <div className={styles.bgWrapper}>
        <div className={styles.meshPink} />
        <div className={styles.meshBlue} />
        <div className={styles.meshPurple} />
      </div>

      <div className={styles.contentWrapper}>
        {/* Left Sidebar Layout mimicking the image */}
        <div className={styles.leftSidebar}>
          <div className={styles.sidebarTitle}>ForYou Analytics</div>
          
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.stepIconDone}`}>
              <Check size={14} />
            </div>
            System Check
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.stepIconActive}`}>
              <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />
            </div>
            <span style={{ color: '#3b82f6' }}>Authentication</span>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.stepIconPending}`}>3</div>
            <span style={{ color: '#94a3b8' }}>Access Workspace</span>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h1 className={styles.mainTitle}>Sign in to your account</h1>
            <p className={styles.mainSubtitle}>Please enter your credentials to access the dashboard</p>

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

            <form onSubmit={handleLogin} autoComplete="nope">
              {/* Fake inputs to trick Chrome password manager */}
              <input style={{ display: 'none' }} type="text" name="fakename" />
              <input style={{ display: 'none' }} type="email" name="fakeusernameremembered" />
              <input style={{ display: 'none' }} type="password" name="fakepasswordremembered" />
              
              <div className={styles.formCard}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Email address</label>
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

                <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
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
              </div>

              <button 
                type="submit" 
                className={styles.button}
                disabled={loading}
              >
                {loading ? 'Signing In...' : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
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
