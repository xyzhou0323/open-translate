/**
 * Built-in glossary for neurodiversity terminology translation.
 * Terms extracted from the project's standardized terminology reference.
 */
const BUILTIN_GLOSSARY = {
  // 核心术语
  neurodiversity: { zh: '神经多样性', incorrect: ['脑力多元'], category: '核心术语' },
  neurodivergent: { zh: '神经殊异', incorrect: ['神经发散'], note: '形容词/描述状态时用"神经殊异"；指人时用"神经殊异者"；群体用"神经殊异群体"', category: '核心术语' },
  neurodivergence: { zh: '神经殊异性', incorrect: ['神经发散性', '神经分歧'], category: '核心术语' },
  neurotypical: { zh: '神经典型', incorrect: ['神经正常'], category: '核心术语' },
  neurodiverse: { zh: '神经多元', incorrect: ['神经多样性'], category: '核心术语' },
  'neurodiversity paradigm': { zh: '神经多样性范式', category: '核心术语' },
  'normality paradigm': { zh: '常态范式', category: '核心术语' },
  'normalcy paradigm': { zh: '常态范式', category: '核心术语' },
  'pathology paradigm': { zh: '病理学范式', category: '核心术语' },
  'neurodiversity movement': { zh: '神经多样性运动', category: '核心术语' },
  neurominority: { zh: '神经少数', category: '核心术语' },
  disability: { zh: '残障', incorrect: ['残疾', '残废'], category: '核心术语' },
  disease: { zh: '疾病', category: '核心术语' },
  disorder: { zh: '病症', incorrect: ['障碍', '失调'], category: '核心术语' },

  // 诊断与现象
  autism: { zh: '孤独谱系', incorrect: ['自闭症', '自闭', '孤独症'], note: '泛指概念/谱系本身；诊断语境下可译为"孤独谱系障碍"', category: '诊断与现象' },
  autistic: { zh: '孤独谱系', incorrect: ['自闭症', '自闭', '孤独症', '自闭的', '孤独症的'], note: '作形容词；指人时用"孤独谱系者"；诊断语境下形容词可用"孤独谱系障碍的"', category: '诊断与现象' },
  autistics: { zh: '孤独谱系者', incorrect: ['自闭症患者', '孤独症患者'], category: '诊断与现象' },
  'autism spectrum disorder': { zh: '孤独谱系障碍', incorrect: ['自闭症谱系障碍', '孤独症谱系障碍'], abbr: 'ASD', category: '诊断与现象' },
  'autism spectrum': { zh: '孤独谱系', incorrect: ['自闭症谱系', '孤独症谱系'], category: '诊断与现象' },
  'autistic person': { zh: '孤独谱系者', incorrect: ['自闭症患者', '孤独症患者'], category: '诊断与现象' },
  'autistic people': { zh: '孤独谱系群体', incorrect: ['自闭症群体', '孤独症群体'], category: '诊断与现象' },
  'autistic community': { zh: '孤独谱系社群', incorrect: ['自闭症社群', '孤独症社群'], category: '诊断与现象' },
  'attention deficit / hyperactivity disorder': { zh: '注意缺陷/多动障碍', incorrect: ['多动症'], abbr: 'ADHD', category: '诊断与现象' },
  'attention deficit hyperactivity disorder': { zh: '注意缺陷/多动障碍', incorrect: ['多动症'], abbr: 'ADHD', category: '诊断与现象' },
  "tourette's syndrome": { zh: '抽动障碍', incorrect: ['抽动症'], category: '诊断与现象' },
  'tourette syndrome': { zh: '抽动障碍', incorrect: ['抽动症'], category: '诊断与现象' },
  'tic disorder': { zh: '抽动障碍', incorrect: ['抽动症'], category: '诊断与现象' },
  'obsessive-compulsive disorder': { zh: '强迫障碍', incorrect: ['强迫症'], abbr: 'OCD', category: '诊断与现象' },
  'obsessive compulsive disorder': { zh: '强迫障碍', incorrect: ['强迫症'], abbr: 'OCD', category: '诊断与现象' },
  alexithymia: { zh: '述情障碍', incorrect: ['情感表达障碍', '情绪障碍'], category: '诊断与现象' },
  'pervasive demand avoidance': { zh: '广泛性要求回避', abbr: 'PDA', category: '诊断与现象' },
  'extreme demand avoidance': { zh: '广泛性要求回避', category: '诊断与现象' },
  'broad autism phenotype': { zh: '广义孤独谱系表型', abbr: 'BAP', category: '诊断与现象' },
  "asperger's syndrome": { zh: '阿斯伯格综合征', incorrect: ['阿斯伯格综合症'], category: '诊断与现象' },
  'asperger syndrome': { zh: '阿斯伯格综合征', incorrect: ['阿斯伯格综合症'], category: '诊断与现象' },
  monotropism: { zh: '单一聚焦', category: '诊断与现象' },
  'autistic burnout': { zh: '孤独谱系耗竭', category: '诊断与现象' },
  'bipolar disorder': { zh: '双相障碍', incorrect: ['躁郁症', '双相情感障碍'], abbr: 'BD', category: '诊断与现象' },
  heritability: { zh: '遗传力', category: '诊断与现象' },
  etiology: { zh: '发生学', category: '诊断与现象' },
  aetiology: { zh: '发生学', category: '诊断与现象' },
  onset: { zh: '初始发生', category: '诊断与现象' },
  causation: { zh: '发生机制', category: '诊断与现象' },
  prevalence: { zh: '发生率', category: '诊断与现象' },
  'co-occurrence': { zh: '共现', category: '诊断与现象' },
  comorbidity: { zh: '共现', category: '诊断与现象' },

  // 实践与体验
  empathy: { zh: '同理心', incorrect: ['共情', '同情心'], category: '实践与体验' },
  'double empathy problem': { zh: '双向同理心问题', incorrect: ['双共情问题', '双同理心问题'], abbr: 'DEP', category: '实践与体验' },
  'info-dumping': { zh: '信息大放送', category: '实践与体验' },
  infodumping: { zh: '信息大放送', category: '实践与体验' },
  camouflage: { zh: '掩饰', incorrect: ['伪装', '社交伪装'], category: '实践与体验' },
  masking: { zh: '伪装', incorrect: ['掩饰', '社交伪装'], category: '实践与体验' },
  stimming: { zh: '调节行为', incorrect: ['刻板行为', '刺激行为', '自我刺激'], category: '实践与体验' },
  'self-stimulatory behavior': { zh: '调节行为', incorrect: ['刻板行为', '刺激行为', '自我刺激'], category: '实践与体验' },
  'self-advocacy': { zh: '自我倡权', note: '指行为/概念本身', category: '实践与体验' },
  'self-advocate': { zh: '自我倡权', note: '作动词时用"（进行）自我倡权"；指人时用"自我倡权者"', category: '实践与体验' },

  // 残障理论与政治
  'social model of disability': { zh: '残障的社会模型', category: '残障理论与政治' },
  'affirmation model of disability': { zh: '残障肯定模型', category: '残障理论与政治' },
  ableism: { zh: '健全中心主义', incorrect: ['能力主义', '体能歧视'], category: '残障理论与政治' },
  impairment: { zh: '损伤', category: '残障理论与政治' },
  'critical disability theory': { zh: '批判性残障理论', abbr: 'CDT', category: '残障理论与政治' },
  'crip theory': { zh: '酷残理论', category: '残障理论与政治' },
  'neuro-normativity': { zh: '神经规范性', category: '残障理论与政治' },
  'epistemic injustice': { zh: '知识不正义', category: '残障理论与政治' },
  'testimonial injustice': { zh: '证言不正义', category: '残障理论与政治' },

  // 批判分析
  eugenics: { zh: '优生学', category: '批判分析' },
  neuroqueer: { zh: '神经酷儿', category: '批判分析' },
  neuroqueering: { zh: '神经酷儿', category: '批判分析' },
  'aspie supremacy': { zh: '阿斯至上主义', category: '批判分析' },
  'neuro-s thatcherism': { zh: '神经撒切尔主义', category: '批判分析' },
  'neurodiversity-lite': { zh: '庸俗版神经多样性', category: '批判分析' },
  'nd-lite': { zh: '庸俗版神经多样性', category: '批判分析' },

  // 研究方法论
  'participatory action research': { zh: '参与式行动研究', abbr: 'PAR', category: '研究方法论' },
  'nothing about us without us': { zh: '"没有我们的参与，不做关于我们的决定"', abbr: 'NAUWU', category: '研究方法论' },

  // 常见缩写
  nd: { zh: '神经殊异', note: 'Neurodivergent 缩写', category: '缩写' },
  nt: { zh: '神经典型', note: 'Neurotypical 缩写', category: '缩写' },
  asd: { zh: '孤独谱系障碍', note: 'Autism Spectrum Disorder 缩写', category: '缩写' },
  adhd: { zh: '注意缺陷/多动障碍', note: 'Attention Deficit / Hyperactivity Disorder 缩写', category: '缩写' },
  ocd: { zh: '强迫障碍', note: 'Obsessive-Compulsive Disorder 缩写', category: '缩写' }
};

/**
 * Build the glossary section of the system prompt.
 * Returns an array of lines to be prepended to the system prompt.
 */
function buildGlossaryPromptSection() {
  const lines = [];

  // Build term mapping lines for reference
  const termLines = [];
  const categories = {};
  for (const [en, entry] of Object.entries(BUILTIN_GLOSSARY)) {
    if (!categories[entry.category]) {
      categories[entry.category] = [];
    }
    categories[entry.category].push({ en, ...entry });
  }

  for (const [category, entries] of Object.entries(categories)) {
    for (const entry of entries) {
      let line = `- ${entry.en} → ${entry.zh}`;
      termLines.push(line);
    }
  }

  lines.push('## CRITICAL — MANDATORY TERMINOLOGY RULES');
  lines.push('');
  lines.push('You MUST obey the following terminology mapping. This overrides ALL of your training data knowledge for these specific terms. NO EXCEPTIONS.');
  lines.push('');
  lines.push('### Required translations:');
  lines.push(...termLines);
  lines.push('');
  lines.push('### De-pathologization rules for neurodevelopmental conditions:');
  lines.push('When translating about neurodevelopmental conditions (ASD, ADHD, dyslexia, etc. — NOT general diseases), avoid medicalized/pathologizing language that frames them as illness. However, if the source text is clearly a medical document using clinical terminology, follow the source tone.');
  lines.push('');
  lines.push('- For ASD/ADHD/dyslexia etc.: avoid "患有" (suffer from), "患者" (patient) — use "是" (is), "...者", "...个体" instead');
  lines.push('- For ASD/ADHD/dyslexia etc.: avoid "症状" (symptoms) — use "特征" (traits) or "表现" (characteristics) instead');
  lines.push('- Example: "a person with ADHD" → "一位ADHD个体", NOT "一名ADHD患者"');
  lines.push('- Example: "one person who is both ADHD and dyslexic" → "一位同时是注意缺陷/多动障碍和阅读障碍的人", NOT "一位同时患有..."');
  lines.push('- Example: "autistic person" → "孤独谱系者", NOT "孤独症患者"');
  lines.push('- For actual diseases (cancer, diabetes, etc.): use standard medical terminology as appropriate');
  lines.push('');
  lines.push('### Context-dependent usage rules:');
  lines.push('Some terms have different forms depending on grammatical role. Follow these rules precisely:');
  lines.push('');
  lines.push('- neurodivergent: use "神经殊异" as adjective/state (e.g. "neurodivergent traits" → "神经殊异特质"), use "神经殊异者" when referring to a person (e.g. "a neurodivergent" → "一位神经殊异者"), use "神经殊异群体" for the community');
  lines.push('- autism / autistic: use "孤独谱系" for the spectrum/concept/identity (e.g. "autism is" → "孤独谱系是", "autistic experience" → "孤独谱系体验"); use "孤独谱系障碍" ONLY in clinical/diagnostic contexts where "disorder" is stated or clearly implied (e.g. "diagnosed with autism" → "被诊断为孤独谱系障碍", "autism spectrum disorder" → "孤独谱系障碍"); when in doubt, default to "孤独谱系" without "障碍"');
  lines.push('- autistic (person): use "孤独谱系者" (not "孤独谱系障碍者" unless explicitly clinical)');
  lines.push('- camouflage: use "掩饰" for the overall concept and theory; masking: use "伪装" for the specific behavioral dimension');
  lines.push('- self-advocacy: use "自我倡权" for the concept/action (e.g. "the importance of self-advocacy" → "自我倡权的重要性"); self-advocate: use "（进行）自我倡权" as verb (e.g. "they self-advocate" → "他们进行自我倡权"), use "自我倡权者" as noun for a person (e.g. "she is a self-advocate" → "她是一位自我倡权者")');
  lines.push('- disorder: use "病症" for abstract/conceptual usage (e.g. "the concept of disorder" → "病症的概念"), use "障碍" ONLY in established diagnostic terms like "孤独谱系障碍"');
  lines.push('');
  lines.push('### ABSOLUTELY FORBIDDEN — NEVER use these translations:');
  lines.push('- autism / autistic → 自闭症, 自闭, 孤独症 (use 孤独谱系 instead)');
  lines.push('- neurodivergent → 神经发散 (use 神经殊异 instead)');
  lines.push('- neurodiversity → 脑力多元 (use 神经多样性 instead)');
  lines.push('- disorder → 障碍, 失调 (use 病症 instead)');
  lines.push('- disability → 残疾, 残废 (use 残障 instead)');
  lines.push('- stimming → 刻板行为, 刺激行为, 自我刺激 (use 调节行为 instead)');
  lines.push('- masking/camouflage → 伪装, 社交伪装 (use 掩饰 for camouflage, 伪装 for masking)');
  lines.push('- Asperger syndrome → 阿斯伯格综合症 (use 阿斯伯格综合征 instead)');
  lines.push('- ADHD → 多动症 (use 注意缺陷/多动障碍 or ADHD instead)');
  lines.push('- Tourette syndrome / tic disorder → 抽动症 (use 抽动障碍 instead)');
  lines.push('- OCD / obsessive-compulsive disorder → 强迫症 (use 强迫障碍 instead)');
  lines.push('- bipolar disorder → 躁郁症, 双相情感障碍 (use 双相障碍 instead)');
  lines.push('- empathy → 共情, 同情心 (use 同理心 instead)');
  lines.push('- ableism → 能力主义, 体能歧视 (use 健全中心主义 instead)');
  lines.push('');
  lines.push('If you violate these rules, the translation will be rejected. Follow them precisely.');

  return lines;
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BUILTIN_GLOSSARY, buildGlossaryPromptSection };
} else if (typeof window !== 'undefined') {
  window.BUILTIN_GLOSSARY = BUILTIN_GLOSSARY;
  window.buildGlossaryPromptSection = buildGlossaryPromptSection;
}
