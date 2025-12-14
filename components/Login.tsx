
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CopyIcon from './icons/CopyIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import TermsModal from './TermsModal';
import ManualModal from './ManualModal';
import InfoCircleIcon from './icons/InfoCircleIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import { isFirebaseConfigured } from '../services/firebase';

interface LoginProps {
  t: any;
}

const Login: React.FC<LoginProps> = ({ t }) => {
  const { signInWithGoogle, loginAsDemo, loginWithEmail, registerWithEmail, resetPassword, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);

  // Email/Pass State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    // Detect if we are in a dev environment (localhost or generic preview domains)
    const hostname = window.location.hostname;
    const href = window.location.href;
    
    const isLocal = 
      // @ts-ignore
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' ||
      hostname.includes('webcontainer') || 
      hostname.includes('usercontent.goog') || // Covers IDX, Cloud Shell, etc.
      hostname.includes('idx.google') ||
      hostname.includes('preview') ||
      href.startsWith('blob:') || // Blob URLs are definitely previews
      hostname.endsWith('.app') || // Catch-all for some preview apps, safer to show than hide in dev
      hostname.includes('ngrok');

    setIsDevEnvironment(isLocal);
  }, []);

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured) {
        setError("Firebase no está configurado (Falta VITE_FIREBASE_API_KEY). Por favor usa el Modo Demo.");
        return;
    }

    setError(null);
    setUnauthorizedDomain(null);
    setFullUrl(null);
    
    try {
      await signInWithGoogle();
    } catch (e: any) {
      handleAuthError(e);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMsg(null);
      
      if (!email) {
          setError(t.login_email_label + " required.");
          return;
      }

      if (isResettingPassword) {
          try {
              await resetPassword(email);
              setSuccessMsg("Correo de recuperación enviado. Revisa tu bandeja de entrada.");
              setIsResettingPassword(false);
          } catch (err: any) {
              handleAuthError(err);
          }
          return;
      }
      
      if (!password) {
          setError(t.login_error_invalid_credential);
          return;
      }
      
      if (isRegistering && !name) {
          setError("Please enter your name.");
          return;
      }

      try {
          if (isRegistering) {
              await registerWithEmail(email, password, name, institution);
          } else {
              await loginWithEmail(email, password);
          }
      } catch (err: any) {
          handleAuthError(err);
      }
  };

  const handleAuthError = (e: any) => {
      console.error("Login Error Details:", e);
      
      const errorCode = e?.code || '';
      const errorMessage = e?.message || '';
      const errorString = String(e);

      // Check for 'auth/api-key-not-valid' (Missing/Invalid Config)
      const isInvalidApiKey = 
        errorCode === 'auth/api-key-not-valid' ||
        errorMessage.includes('api-key-not-valid') ||
        errorString.includes('api-key-not-valid') ||
        errorMessage.includes('please-pass-a-valid-api-key');

      if (isInvalidApiKey) {
          setError("Error de Configuración: La API Key de Firebase no es válida o falta. \n\nPor favor, verifica que la variable de entorno 'VITE_FIREBASE_API_KEY' esté configurada correctamente en tu panel de hosting. \n\nMientras tanto, puedes usar el 'Modo Demo'.");
          return;
      }

      // Check for unauthorized domain error variants
      const isUnauthorizedDomain = 
        errorCode === 'auth/unauthorized-domain' || 
        errorMessage.includes('unauthorized-domain') ||
        errorString.includes('unauthorized-domain') ||
        errorMessage.includes('unauthorized domain');

      if (isUnauthorizedDomain) {
        let domain = window.location.hostname;
        const currentHref = window.location.href;

        // 1. Handle Blob URLs specifically (Common in Cloud Shell / IDX Previews)
        if (window.location.protocol === 'blob:' || currentHref.startsWith('blob:')) {
            // Extract domain from blob:https://domain.com/uuid
            const blobMatch = currentHref.match(/blob:https?:\/\/([^/]+)/);
            if (blobMatch && blobMatch[1]) {
                domain = blobMatch[1];
            }
        }

        // 2. Try to extract from error message if hostname is still empty or localhost
        // Error msg format: "auth/unauthorized-domain (domain.com)"
        if (!domain || domain === 'localhost' || domain === '') {
            const match = errorMessage.match(/\(([^)]+)\)/);
            if (match && match[1] && match[1].includes('.')) {
                domain = match[1];
            }
        }

        // 3. Fallback to standard parsing if still empty
        if (!domain) {
             try {
                const url = new URL(currentHref);
                if (url.protocol !== 'blob:') {
                    domain = url.hostname;
                }
            } catch (err) {}
        }
        
        setUnauthorizedDomain(domain || 'No detectado automáticamente');
        setFullUrl(currentHref); // Save full URL for display
        return; 
      }
      
      // Friendly Error Mapping
      if (errorCode === 'auth/popup-closed-by-user') {
        setError(t.login_error_popup_closed);
        return;
      }
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
          setError(t.login_error_invalid_credential);
          return;
      }
      if (errorCode === 'auth/user-not-found') {
          setError(t.login_error_user_not_found);
          return;
      }
      if (errorCode === 'auth/email-already-in-use') {
          setError(t.login_error_email_in_use);
          return;
      }
      if (errorCode === 'auth/weak-password') {
          setError(t.login_error_weak_password);
          return;
      }

      // Show specific error info in generic message to help debugging if none matched
      setError(`${t.login_error_generic} \n(${errorMessage})`);
  };

  const handleDemoLogin = async () => {
      setError(null);
      try {
          await loginAsDemo();
      } catch (e) {
          console.error("Demo login error", e);
          setError("Error entering demo mode.");
      }
  };

  const copyDomain = () => {
    if (unauthorizedDomain && unauthorizedDomain !== 'No detectado automáticamente') {
      navigator.clipboard.writeText(unauthorizedDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
            <SparklesIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
          {t.appName}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          {t.login_subtitle}
        </p>

        {unauthorizedDomain ? (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg text-left">
             <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 flex items-center mb-2">
                <InfoCircleIcon className="h-5 w-5 mr-2" />
                {t.login_domain_config_title}
             </h3>
             <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
               {t.login_domain_config_desc}
             </p>
             
             <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
               <div>
                 <p className="font-semibold mb-1">{t.login_domain_step_1}</p>
                 <button 
                  onClick={copyDomain}
                  className="flex items-center justify-center w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 font-mono text-xs hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                 >
                   <span className="truncate mr-2 font-bold">{unauthorizedDomain}</span>
                   {copied ? <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" /> : <CopyIcon className="h-4 w-4 flex-shrink-0" />}
                 </button>
               </div>
               
               {fullUrl && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500">
                      URL del entorno detectada (Blob):
                    </p>
                    <p className="font-mono text-[10px] break-all bg-slate-100 dark:bg-slate-800 p-1 rounded mt-1">
                      {fullUrl}
                    </p>
                  </div>
               )}

               <p>{t.login_domain_step_2}</p>
               <p>{t.login_domain_step_3}</p>
             </div>
             
             <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700/50 text-center flex flex-col gap-2">
               <button 
                onClick={handleGoogleLogin} 
                className="w-full text-xs font-semibold bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
               >
                 Listo, Reintentar Login
               </button>
               
               <button
                    onClick={handleDemoLogin}
                    className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded shadow-sm bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <UserGroupIcon className="h-3 w-3 mr-2" />
                    O entrar en {t.login_demo_button}
                </button>
             </div>
          </div>
        ) : (
          <>
            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-start text-left break-words overflow-hidden">
                    <AlertTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="break-words w-full whitespace-pre-wrap">{error}</span>
                </div>
            )}
            
            {successMsg && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-start text-left">
                    <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                </div>
            )}

            {!isResettingPassword && (
                <button
                onClick={handleGoogleLogin}
                disabled={loading || !isFirebaseConfigured}
                className={`w-full flex items-center justify-center px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-white transition-all duration-200 mb-4 ${!isFirebaseConfigured ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
                >
                {loading ? (
                    <svg className="animate-spin h-5 w-5 mr-3 text-slate-700 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5 mr-3" />
                )}
                <span className="font-medium">
                    {isFirebaseConfigured ? t.login_button_google : "Login Google Deshabilitado (Falta API Key)"}
                </span>
                </button>
            )}
            
            {!isResettingPassword && (
                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {t.login_separator_or}
                    </span>
                    </div>
                </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-4 text-left">
                {isRegistering && !isResettingPassword && (
                    <>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t.login_name_label}
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={isRegistering}
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="institution" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t.login_institution_label}
                            </label>
                            <input
                                type="text"
                                id="institution"
                                value={institution}
                                onChange={(e) => setInstitution(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                    </>
                )}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t.login_email_label}
                    </label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
                {!isResettingPassword && (
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t.login_password_label}
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                )}
                
                <button
                    type="submit"
                    disabled={loading || !isFirebaseConfigured}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${!isFirebaseConfigured ? 'bg-teal-800 opacity-50 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500'}`}
                >
                    {loading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        isResettingPassword ? "Enviar correo de recuperación" : (isRegistering ? t.login_button_register : t.login_button_signin)
                    )}
                </button>
            </form>

            <div className="flex flex-col space-y-2 mb-6 text-center">
                {!isResettingPassword ? (
                    <>
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                        >
                            {isRegistering ? t.login_switch_to_login : t.login_switch_to_register}
                        </button>
                        <button
                            onClick={() => { setIsResettingPassword(true); setError(null); }}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline focus:outline-none"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => { setIsResettingPassword(false); setError(null); }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                    >
                        Volver al inicio de sesión
                    </button>
                )}
            </div>
            
            {/* Show Demo button if in Dev Env OR if there was an auth error (fallback) OR if firebase is missing */}
            {(isDevEnvironment || error || !isFirebaseConfigured) && !isResettingPassword && (
              <>
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">O para pruebas</span>
                  </div>
                </div>

                <button
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                    <UserGroupIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">{t.login_demo_button}</span>
                </button>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {t.login_demo_note}
                </p>
              </>
            )}
          </>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col space-y-3 text-xs text-slate-500 dark:text-slate-500">
            <button 
                onClick={() => setIsManualOpen(true)}
                className="flex items-center justify-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
                <DocumentTextIcon className="h-4 w-4 mr-1" />
                {t.manual_button_title}
            </button>
            
            <p>
                Al continuar, aceptas nuestros{' '}
                <button 
                    onClick={() => setIsTermsOpen(true)}
                    className="underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                    {t.terms_and_conditions}
                </button>
            </p>
        </div>
      </div>
      
      {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} t={t} />}
      {isManualOpen && <ManualModal onClose={() => setIsManualOpen(false)} />}
    </div>
  );
};

export default Login;
