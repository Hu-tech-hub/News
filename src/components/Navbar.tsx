/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Newspaper, BookmarkCheck, Search, Database, Plus, ChevronDown, CheckCircle2 } from 'lucide-react';
import { TargetProfile } from '../types';

interface NavbarProps {
  activeTab: 'search' | 'analysis' | 'bookmarks';
  onTabChange: (tab: 'search' | 'analysis' | 'bookmarks') => void;
  targets: TargetProfile[];
  activeTarget: TargetProfile | null;
  onSelectTarget: (target: TargetProfile) => void;
  onOpenTargetManager: () => void;
  onOpenBackupModal: () => void;
  bookmarkCount: number;
  hasAnalysis: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  targets,
  activeTarget,
  onSelectTarget,
  onOpenTargetManager,
  onOpenBackupModal,
  bookmarkCount,
  hasAnalysis,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white whitespace-nowrap">취업 뉴스 노트</span>
                <span className="text-[10px] sm:text-[11px] font-medium px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                  개인용
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">지원 기업·직무 맞춤 근거 기반 뉴스 분석</p>
            </div>
          </div>

          {/* Target Selector Dropdown */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="relative group">
              {activeTarget ? (
                <div className="flex items-center bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-lg p-1 sm:p-1.5 pl-2.5 sm:pl-3 transition-colors">
                  <div className="flex flex-col text-left pr-1.5 cursor-pointer max-w-[100px] sm:max-w-[180px]" onClick={onOpenTargetManager}>
                    <span className="text-[9px] uppercase font-semibold text-blue-400">분석 대상</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {activeTarget.companyName} · {activeTarget.jobRole}
                    </span>
                  </div>
                  <button
                    onClick={onOpenTargetManager}
                    title="관심 대상 관리"
                    className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenTargetManager}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">관심 대상 등록</span>
                  <span className="sm:hidden">대상 등록</span>
                </button>
              )}
            </div>

            {/* Backup / Restore Button */}
            <button
              onClick={onOpenBackupModal}
              title="데이터 백업 및 복원"
              className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">백업/복원</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-t border-slate-800/80 -mb-px overflow-x-auto py-1">
          <button
            onClick={() => onTabChange('search')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>뉴스 찾기</span>
          </button>

          <button
            onClick={() => onTabChange('analysis')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>분석 결과</span>
            {hasAnalysis && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            )}
          </button>

          <button
            onClick={() => onTabChange('bookmarks')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'bookmarks'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>내 북마크</span>
            {bookmarkCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-xs rounded-full bg-blue-500/30 text-blue-300 font-semibold">
                {bookmarkCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
