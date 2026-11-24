import { useEffect, useState } from 'react';
import { Crown, Shield, ArrowRight, Eye, EyeOff, Lock, Mail, User, Loader2, CheckCircle2, AlertCircle, KeyRound, Check } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Logo } from '@/components/Logo';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const APP_ICON = 'https://play-lh.googleusercontent.com/vvjbsFDeRiEOQ7IJ_9dNkGCMtK6qVfWkrTYHTc9f9LXupObXSAvFmAJTuhFyv477y43sHXrkwFgtXSDxs_9MYu4=s192-rw';

export function LoginPage() {
  const { supabaseSignIn, supabaseSignUp, supabaseResetPassword, supabaseUpdatePassword, recoveryMode } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (recoveryMode) setMode('reset');
  }, [recoveryMode]);

  const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#22c55e'];
    return { score, label: labels[score], color: colors[score] };
  };

  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await supabaseSignIn(email, password);
      if (error) setError(error);
    } else if (mode === 'reset') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      const { error } = await supabaseUpdatePassword(password);
      if (error) setError(error);
      else {
        setSuccess('Your password has been updated. You can now sign in.');
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
      }
    } else if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Enter your email address.');
        setLoading(false);
        return;
      }
      const { error } = await supabaseResetPassword(email);
      if (error) {
        setError(error);
      } else {
        setSuccess('Password recovery email sent. Check your inbox for instructions.');
        setMode('signin');
      }
    } else {
      if (handle.trim().length < 3) {
        setError('Handle must be at least 3 characters.');
        setLoading(false);
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (!acceptTerms) {
        setError('You must accept the Terms and Conditions.');
        setLoading(false);
        return;
      }
      const { error } = await supabaseSignUp(email, password, handle.trim(), displayName.trim() || handle.trim());
      if (error) {
        setError(error);
      } else {
        setSuccess('Account created successfully! You can now sign in.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    }
    setLoading(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-grid-dark bg-grid-32 opacity-40" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gold-500/5 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-gold-500/10 p-12 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-radial-gold" />
          <div className="relative">
            <Logo size="lg" />
            <div className="mt-6 flex items-center gap-3">
              <img
                src={APP_ICON}
                alt="LIVE RUSSIA Mobile"
                className="h-14 w-14 rounded-xl border border-gold-500/30 object-cover"
                loading="lazy"
              />
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wide text-white">Live Russia Mobile</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-ink-300">Open World RPG</p>
              </div>
            </div>
          </div>

          <div className="relative space-y-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold-400">Est. 2023 · Community Portal</p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[1.05] tracking-tight text-white">
                One Community.
                <br />
                <span className="gold-text">One Identity.</span>
                <br />
                One Platform.
              </h1>
              <p className="mt-5 max-w-md text-balance text-ink-200">
                The premium digital command centre for LIVE RUSSIA GAMING — members, staff, verification, loans,
                Discord presence and community operations in one place.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { k: '1,284', v: 'Members' },
                { k: '1,097', v: 'Verified' },
                { k: '19', v: 'Staff' },
              ].map((s) => (
                <div key={s.v} className="rounded-xl border border-white/5 bg-ink-900/50 p-4 transition-transform hover:scale-[1.02]">
                  <p className="font-display text-2xl font-bold text-gold-300">{s.k}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-300">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-6 text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-gold-500" /> Verified members only
            </span>
            <span className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-gold-500" /> Command-led
            </span>
          </div>
        </div>

        {/* Right auth panel */}
        <div className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md animate-fade-up">
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo size="md" />
            </div>

            <div className="panel relative overflow-hidden p-7 sm:p-9">
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

              <div className="mb-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400">
                  {mode === 'signin' ? 'Secure Access' : mode === 'signup' ? 'Join the Community' : mode === 'reset' ? 'Choose a New Password' : 'Password Recovery'}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-white">
                  {mode === 'signin' ? 'Enter the Portal' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Set New Password' : 'Reset Password'}
                </h2>
                <p className="mt-1 text-sm text-ink-300">
                  {mode === 'signin'
                    ? 'Sign in to access your community dashboard.'
                    : mode === 'signup'
                    ? 'Join the LIVE RUSSIA GAMING community.'
                    : mode === 'reset'
                    ? 'Create a new password for your account.'
                    : 'Enter your email to receive a recovery link.'}
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 animate-fade-up">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300 animate-fade-up">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                  <p>{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="label" htmlFor="handle">Community Handle</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <input id="handle" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="NikitaVolkov" className="input-field pl-9" required minLength={3} />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="displayName">Display Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nikita Volkov" className="input-field pl-9" />
                      </div>
                    </div>
                  </>
                )}

                {mode !== 'reset' && (
                  <div>
                    <label className="label" htmlFor="email">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="commander@liverussia.gg" className="input-field pl-9" required />
                    </div>
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div>
                    <label className="label" htmlFor="password">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-field px-9" required minLength={mode === 'signup' ? 8 : 1} />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white">
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {(mode === 'signup' || mode === 'reset') && password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: strength.color }}>
                            {strength.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(mode === 'signup' || mode === 'reset') && (
                  <div>
                    <label className="label" htmlFor="confirmPassword">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field px-9"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {confirmPassword.length > 0 && (
                        <span className="absolute right-9 top-1/2 -translate-y-1/2">
                          {password === confirmPassword ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <label className="flex items-start gap-2.5 text-xs text-ink-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded border-white/10 bg-ink-900 text-gold-500 focus:ring-gold-500/30"
                    />
                    <span>I accept the <span className="font-semibold text-gold-400">Terms and Conditions</span> and the community code of conduct.</span>
                  </label>
                )}

                {mode === 'signin' && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-ink-300">
                      <input type="checkbox" className="rounded border-white/10 bg-ink-900 text-gold-500 focus:ring-gold-500/30" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => switchMode('forgot')} className="font-semibold text-gold-400 hover:text-gold-300">
                      Forgot?
                    </button>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === 'signin' ? 'Signing in...' : mode === 'signup' ? 'Creating account...' : mode === 'reset' ? 'Updating password...' : 'Sending email...'}
                    </>
                  ) : (
                    <>
                      {mode === 'signin' ? 'Sign In to Portal' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Update Password' : 'Send Recovery Email'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-ink-300">
                {mode === 'signin' ? (
                  <>
                    New to the community?{' '}
                    <button onClick={() => switchMode('signup')} className="font-semibold text-gold-400 hover:text-gold-300">Create an account</button>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button onClick={() => switchMode('signin')} className="font-semibold text-gold-400 hover:text-gold-300">Sign in</button>
                  </>
                ) : mode === 'reset' ? (
                  <>
                    Need a new recovery link?{' '}
                    <button onClick={() => switchMode('forgot')} className="font-semibold text-gold-400 hover:text-gold-300">Request one</button>
                  </>
                ) : (
                  <>
                    Remember your password?{' '}
                    <button onClick={() => switchMode('signin')} className="font-semibold text-gold-400 hover:text-gold-300">Sign in</button>
                  </>
                )}
              </div>



              {mode === 'forgot' && (
                <div className="mt-6 flex items-start gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-xs text-gold-200/80">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                  <p>
                    Enter the email associated with your account. You will receive a secure link to reset your password.
                  </p>
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-ink-400">
              By signing in you agree to the community code of conduct.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
