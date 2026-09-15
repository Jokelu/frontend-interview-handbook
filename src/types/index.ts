/**
 * 全站数据结构定义
 * ------------------------------------------------------------------
 * 所有面试题内容都被约束成下面两个接口，好处是：
 * 1. 新增一道题只要往对应分类的 items 数组里加一个对象，类型会自动校验；
 * 2. 页面渲染层只依赖接口，不依赖具体内容，新增技术栈零成本。
 */

/** 题目难度分级 */
export type Level = '基础' | '进阶' | '高级' | '手写题' | '场景题'

/** 出现频率：1 星=偶尔问，2 星=较常问，3 星=必问 */
export type Freq = 1 | 2 | 3

/** 一道面试题 */
export interface Question {
  /** 全局唯一 id，同时作为路由参数，例如 'js-closure' */
  id: string
  /** 题目标题，例如 '闭包是什么，为什么会导致内存泄漏' */
  title: string
  /** 难度 */
  level: Level
  /** 面试出现频率 */
  freq: Freq
  /** 关键词标签，用于搜索与展示 */
  tags: string[]
  /** 面试官原话（第一人称提问） */
  ask: string
  /** 【核心】口语化回答：直接能在面试里说出口的话，markdown 格式 */
  oral: string
  /** 核心要点：回答时必须踩到的采分点 */
  points: string[]
  /** 【核心】真实示例：markdown 源码，包含可运行的代码与逐行注释 */
  example: string
  /** 【核心】实现过程：从思路到落地的分步骤说明 */
  steps: string[]
  /** 面试官常见的追问 / 容易踩的坑 */
  followups?: string[]
  /** 延伸阅读（可选，写清关键词即可） */
  refs?: string[]
}

/** 一个技术栈分类 */
export interface Category {
  /** 分类 id，用于路由，例如 'javascript' */
  id: string
  /** 中文名，例如 'JavaScript' */
  name: string
  /** 侧边栏辅助说明 */
  en: string
  /** lucide 图标名，见 components/CategoryIcon.vue 的映射表 */
  icon: string
  /** 主题色，用于侧边栏色块与标签 */
  color: string
  /** 一句话介绍 */
  desc: string
  /** 该分类下的所有题目 */
  items: Question[]
}

/** 搜索结果项 */
export interface SearchHit {
  question: Question
  category: Category
}
