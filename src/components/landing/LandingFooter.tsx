"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Box } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="py-12 bg-slate-950 border-t border-slate-800 px-4 text-slate-400 text-xs">
      <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Box className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-sm">Spartan 3D Print OS</span>
        </div>

        <div className="flex items-center gap-6">
          <Link to="/login" className="hover:text-white transition-colors">Entrar</Link>
          <Link to="/register" className="hover:text-white transition-colors">Criar Conta</Link>
          <a href="#calculadora" className="hover:text-white transition-colors">Calculadora</a>
          <a href="#precos" className="hover:text-white transition-colors">Planos</a>
        </div>

        <p className="text-slate-400">© 2025 Spartan 3D Print. Desenvolvido para makers e indústrias 3D.</p>
      </div>
    </footer>
  );
};