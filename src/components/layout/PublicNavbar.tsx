"use client";

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, ArrowRight, Menu, X, Sparkles, Cpu, Layers, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdmin } from '@/lib/permissions';

export const PublicNavbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 text-white transition-all">
      <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Box className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
                Spartan 3D
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                PRINT OS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block -mt-1">
              Gestão de Print Farm, Estoque & Calculadora de Custos
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a href="#calculadora" className="hover:text-white transition-colors flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            Calculadora 3D
          </a>
          <a href="#recursos" className="hover:text-white transition-colors flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Print Farm & Estoque
          </a>
          <a href="#precos" className="hover:text-white transition-colors">
            Planos Spartan
          </a>
          <a href="#depoimentos" className="hover:text-white transition-colors">
            Casos de Sucesso
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button
              onClick={() => navigate(user.role === 'admin' ? '/admin' : '/cliente')}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-full font-semibold shadow-md shadow-indigo-600/30 text-sm px-5"
            >
              Acessar Painel ({canAccessAdmin(user) ? 'SPARTAN BUSINESS' : 'Meu Estúdio 3D'})
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800 text-sm">
                  Entrar
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-500 hover:opacity-90 text-white rounded-full font-bold px-5 text-sm shadow-lg shadow-indigo-600/25">
                  Testar 14 Dias Grátis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-6 py-5 space-y-4">
          <div className="flex flex-col gap-3 text-base font-medium text-slate-200">
            <a href="#calculadora" onClick={() => setMobileOpen(false)}>Calculadora de Impressão</a>
            <a href="#recursos" onClick={() => setMobileOpen(false)}>Recursos de Print Farm</a>
            <a href="#precos" onClick={() => setMobileOpen(false)}>Planos e Preços</a>
            <a href="#depoimentos" onClick={() => setMobileOpen(false)}>Depoimentos de Makers</a>
          </div>
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full justify-center border-slate-700 text-white">
                Fazer Login
              </Button>
            </Link>
            <Link to="/register" onClick={() => setMobileOpen(false)}>
              <Button className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                Testar 14 Dias Grátis
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
