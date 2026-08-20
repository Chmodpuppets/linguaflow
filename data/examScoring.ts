import { TargetExam } from '../types';

// 考试评分卡维度配置：各考试的全维度条（维度 key / 中文标签 / 量纲上限）+ 估算等级/总分展示键。
// 供作文编辑器（CompositionEditor）与写作树引导写作（WritingTreeView）共用，避免两套渲染逻辑漂移。
export interface ExamDim {
  key: string;
  label: string;
  max: number;
}

export const EXAM_SCORECARD: Partial<
  Record<TargetExam, { dims: ExamDim[]; levelKey: string; levelLabel: string }>
> = {
  IELTS: {
    dims: [
      { key: 'taskResponse', label: '任务回应 TR', max: 9 },
      { key: 'coherenceCohesion', label: '连贯衔接 CC', max: 9 },
      { key: 'lexicalResource', label: '词汇资源 LR', max: 9 },
      { key: 'grammaticalRange', label: '语法广度 GRA', max: 9 },
    ],
    levelKey: 'overall',
    levelLabel: '总分 (9 分制)',
  },
  TOEFL: {
    dims: [
      { key: 'development', label: '展开 Development', max: 5 },
      { key: 'organization', label: '结构 Organization', max: 5 },
      { key: 'languageUse', label: '语言运用', max: 5 },
    ],
    levelKey: 'scaled',
    levelLabel: '换算分 (0-30)',
  },
  JLPT: {
    dims: [
      { key: 'vocabularyKanji', label: '文字・語彙', max: 100 },
      { key: 'grammar', label: '文法', max: 100 },
      { key: 'composition', label: '構成・表現', max: 100 },
    ],
    levelKey: 'estimatedLevel',
    levelLabel: '估算等级',
  },
  TOPIK: {
    dims: [
      { key: 'vocabGrammar', label: '词汇语法', max: 100 },
      { key: 'contentOrganization', label: '内容构成', max: 100 },
      { key: 'expression', label: '表达', max: 100 },
    ],
    levelKey: 'estimatedLevel',
    levelLabel: '估算等级',
  },
  DELE: {
    dims: [
      { key: 'grammar', label: '语法', max: 100 },
      { key: 'vocabulary', label: '词汇', max: 100 },
      { key: 'coherence', label: '连贯衔接', max: 100 },
      { key: 'taskAdequacy', label: '任务适配', max: 100 },
    ],
    levelKey: 'estimatedLevel',
    levelLabel: '估算等级',
  },
};
