/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, AlertCircle, Check, Briefcase, Building2, Tag } from 'lucide-react';
import { TargetProfile } from '../types';
import { checkDuplicateTarget } from '../services/db';

interface TargetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: TargetProfile[];
  activeTarget: TargetProfile | null;
  onSaveTarget: (target: TargetProfile) => Promise<void>;
  onDeleteTarget: (id: string) => Promise<void>;
  onSelectTarget: (target: TargetProfile) => void;
}

const POPULAR_INDUSTRIES = ['반도체', 'IT/인터넷', '자동차/모빌리티', '제조/장비', '배터리/화학', '금융/핀테크', '바이오/제약'];

export const TargetManagerModal: React.FC<TargetManagerModalProps> = ({
  isOpen,
  onClose,
  targets,
  activeTarget,
  onSaveTarget,
  onDeleteTarget,
  onSelectTarget,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  const [industryTags, setIndustryTags] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setCompanyName('');
    setJobRole('');
    setIndustryInput('');
    setIndustryTags([]);
    setDuplicateWarning(null);
    setError(null);
  };

  const handleStartEdit = (target: TargetProfile) => {
    setIsEditing(true);
    setEditingId(target.id);
    setCompanyName(target.companyName);
    setJobRole(target.jobRole);
    setIndustryTags([...target.industryTags]);
    setDuplicateWarning(null);
    setError(null);
  };

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !industryTags.includes(trimmed)) {
      setIndustryTags([...industryTags, trimmed]);
      setIndustryInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setIndustryTags(industryTags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);

    const comp = companyName.trim();
    const role = jobRole.trim();

    if (!comp) {
      setError('지원 기업명을 입력해 주세요.');
      return;
    }
    if (!role) {
      setError('지원 직무명을 입력해 주세요.');
      return;
    }

    // Check duplicate
    const isDup = await checkDuplicateTarget(comp, role, editingId || undefined);
    if (isDup) {
      setDuplicateWarning(
        `'${comp}' 기업의 '${role}' 직무 조합이 이미 등록되어 있습니다. 다른 직무이거나 수정을 원하시면 확인해 주세요.`
      );
      return;
    }

    const now = Date.now();
    const targetPayload: TargetProfile = {
      id: editingId || `target-${Date.now()}`,
      companyName: comp,
      jobRole: role,
      industryTags,
      createdAt: editingId ? targets.find((t) => t.id === editingId)?.createdAt || now : now,
      updatedAt: now,
    };

    await onSaveTarget(targetPayload);

    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-blue-400" />
              <span>관심 대상(기업·직무) 관리</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              기사 탐색과 맞춤 시사점 도출의 기준이 되는 관심 조합을 등록하고 관리합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target List */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              등록된 관심 대상 목록 ({targets.length}개)
            </h3>
            {targets.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-800/30 text-center">
                <p className="text-sm text-slate-400">아직 등록된 관심 대상이 없습니다.</p>
                <p className="text-xs text-slate-500 mt-1">아래 양식에서 목표 기업과 직무를 등록해 보세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {targets.map((t) => {
                  const isSelected = activeTarget?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-blue-500/80 bg-blue-950/30 ring-1 ring-blue-500/50'
                          : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-sm text-white">{t.companyName}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
                                현재 선택
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-300 font-medium mt-0.5">{t.jobRole}</div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartEdit(t)}
                            title="수정"
                            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTarget(t.id)}
                            title="삭제"
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {t.industryTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {t.industryTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-300 rounded-md"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isSelected && (
                        <button
                          onClick={() => {
                            onSelectTarget(t);
                          }}
                          className="mt-3 w-full py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-blue-600 rounded-lg transition"
                        >
                          분석 대상으로 선택
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="border-t border-slate-800 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              {isEditing ? '관심 대상 수정' : '새 관심 대상 등록'}
            </h3>

            {duplicateWarning && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    기업명 <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="예: 삼성전자, 현대자동차, 네이버"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    지원 직무명 <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="예: 반도체 공정설계, 배터리 개발, 백엔드"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Industry Tags */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  관심 산업 태그 <span className="text-slate-500">(선택)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_INDUSTRIES.map((ind) => (
                    <button
                      type="button"
                      key={ind}
                      onClick={() => handleAddTag(ind)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        industryTags.includes(ind)
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      +{ind}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="직접 태그 입력 후 추가 (엔터)"
                      value={industryInput}
                      onChange={(e) => setIndustryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(industryInput);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag(industryInput)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium"
                  >
                    추가
                  </button>
                </div>

                {industryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {industryTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? '저장하고 분석 기준에 적용' : '등록하고 분석 기준에 적용'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
