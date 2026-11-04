/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, AlertCircle, Cpu, Globe, PlayCircle } from 'lucide-react';
import { SystemStatusResponse } from '../services/api';

interface SystemStatusBarProps {
  status: SystemStatusResponse | null;
  onLoadDemoData: () => Promise<void>;
  hasData: boolean;
}

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ status, onLoadDemoData, hasData }) => {
  return (
    <div className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 py-2 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Gemini Status */}
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.geminiConfigured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-300">
              Gemini 3.8 Flash: {status?.geminiConfigured ? '연동 완료' : 'API 키 미설정 (Secrets 패널 필요)'}
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline">•</span>

          {/* ADK Orchestrator Status */}
          <div className="flex items-center space-x-1 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>오케스트레이션: @google/adk v2.4.0 (실제 워크플로 노드 가동)</span>
          </div>

          <span className="text-slate-700 hidden sm:inline">•</span>

          {/* Storage */}
          <div className="flex items-center space-x-1 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>로컬 IndexedDB v1 (서버 무저장 원칙)</span>
          </div>
        </div>

        {/* Demo Mode Trigger */}
        {!hasData && (
          <button
            onClick={onLoadDemoData}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 hover:underline font-semibold"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>체험용 관심 대상 및 검증 샘플 기사 불러오기</span>
          </button>
        )}
      </div>
    </div>
  );
};
