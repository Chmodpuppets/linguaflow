import { CEFRLevel, WritingRegister } from '../types';

// 共享分级写作题库：写作工坊（自由写作）与写作树（高阶开放任务）共用同一份源，
// 避免两套题库割裂。按 CEFR 等级分级，提示用母语给出，学习者用目标语言产出。
//
// 每道题带一个「语体（register）」维度：口语 / 中性 / 礼貌 / 正式 / 商务，
// 让学习者练习「用对的口气写」，而非写完即可。
export interface WritingTopic {
  text: string;
  register: WritingRegister;
}

export const TOPICS_BY_LEVEL: Record<CEFRLevel, WritingTopic[]> = {
  [CEFRLevel.A1]: [
    { text: '用目标语言做个自我介绍：你叫什么、是哪国人、做什么工作或学生。', register: 'casual' },
    { text: '描述你身边的一件物品：这是什么、什么颜色、是大还是小。', register: 'casual' },
    { text: '写写你今天做了什么（用过去时），至少两句。', register: 'casual' },
    { text: '说说你喜欢什么、不喜欢什么（用"喜欢/讨厌"句型）。', register: 'casual' },
    { text: '描述你房间里某样东西在哪里（用方位词）。', register: 'casual' },
  ],
  [CEFRLevel.A2]: [
    { text: '描述你一天的日常（从早到晚，至少四句）。', register: 'neutral' },
    { text: '写写你上个周末做了什么（用过去时）。', register: 'neutral' },
    { text: '比较两种食物或两个城市，说说你更喜欢哪个、为什么。', register: 'neutral' },
    { text: '写一段话邀请朋友周末一起做某事，说明时间地点。', register: 'polite' },
    { text: '你在餐厅，用目标语言点一餐并和服务员简单对话。', register: 'polite' },
  ],
  [CEFRLevel.B1]: [
    { text: '描述一次让你印象深刻的旅行：去了哪、做了什么、感受如何。', register: 'neutral' },
    { text: '谈谈你对某件事的看法（用"我认为"句型），并给出理由。', register: 'polite' },
    { text: '比较住在城市和乡下的优缺点。', register: 'neutral' },
    { text: '写一封信给朋友，讲讲你最近的计划和打算。', register: 'casual' },
    { text: '介绍一部你喜欢的电影或书，并说明推荐理由。', register: 'polite' },
  ],
  [CEFRLevel.B2]: [
    { text: '描述一段童年回忆，以及它对你的影响。', register: 'neutral' },
    { text: '谈谈你对社交媒体的看法：利与弊。', register: 'formal' },
    { text: '介绍一道你家乡的传统菜，并写明做法。', register: 'neutral' },
    { text: '就一个社会话题阐述你的观点，正反两面都要涉及。', register: 'formal' },
    { text: '写一封正式邮件，申请一个职位或项目。', register: 'business' },
  ],
  [CEFRLevel.C1]: [
    { text: '就一个争议性话题写一篇议论文，立场鲜明、论证充分。', register: 'formal' },
    { text: '描述一个复杂的技术或文化概念，让外行也能懂。', register: 'neutral' },
    { text: '写一篇评论文章，评析最近的一部作品或事件。', register: 'formal' },
    { text: '用目标语言写一篇短文，反思你学习这门语言的过程与心得。', register: 'neutral' },
  ],
  [CEFRLevel.C2]: [
    { text: '用目标语言创作一篇短篇散文或故事，注重文采与风格。', register: 'formal' },
    { text: '就一个抽象主题（如时间、自由）写一篇哲学思辨短文。', register: 'formal' },
    { text: '翻译并评析一段你母语的文学片段。', register: 'formal' },
  ],
};
