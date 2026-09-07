'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Si ya hay sesión iniciada, no debería poder ver el login (evita bugs con botón atrás/adelante)
    if (localStorage.getItem('token')) {
      router.replace('/');
    }
  }, [router]);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch('http://127.0.0.1:8000/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        
        if (!res.ok) throw new Error('Credenciales incorrectas. (¿Ya te registraste?)');
        
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        router.replace('/');
      } else {
        const res = await fetch('http://127.0.0.1:8000/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) throw new Error('Error al registrar, el email podría estar en uso');
        
        setIsLogin(true);
        setError('¡Registro exitoso! Ahora puedes iniciar sesión.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 bg-white/5 p-10 rounded-3xl shadow-2xl w-full max-w-md backdrop-blur-xl border border-white/10 transition-all duration-500">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 mb-6 shadow-lg shadow-indigo-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-white">
            {isLogin ? 'Bienvenido de nuevo' : 'Crea tu Cuenta'}
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {isLogin ? 'Ingresa tus credenciales para continuar' : 'Únete a Mini ChatGPT Pro hoy mismo'}
          </p>
        </div>

        {error && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-3 transition-all ${error.includes('exitoso') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Correo Electrónico</label>
            <div className="relative group">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 pl-11 text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-300" 
                required
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Contraseña</label>
            <div className="relative group">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 pl-11 text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-300" 
                required
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold py-3 px-4 rounded-xl mt-4 transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
          </button>
        </form>
        
        <p className="mt-8 text-center text-sm text-gray-400">
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }} 
            className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline transition-colors focus:outline-none"
          >
            {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
