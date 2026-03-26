/**
 * 文本测试数据
 * 用于 TTS 性能测试
 */
import type { TextFixture } from '../metrics/types';

/**
 * 文本测试数据集合
 */
export const textFixtures: TextFixture[] = [
  // 短文本（1-20 字符）
  // {
  //   name: 'simple-greeting',
  //   text: '你好，欢迎！',
  //   category: 'short',
  // },
  //   {
  //     name: 'short-question',
  //     text: '今天天气怎么样？',
  //     category: 'short',
  //   },
  //   {
  //     name: 'short-command',
  //     text: '请打开客厅的灯。',
  //     category: 'short',
  //   },

  //   // 中等文本（50-200 字符）
  {
    name: 'intro-paragraph',
    text: '欢迎来到杭州！我是您的智能导游。杭州是一座有着两千多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。西湖、灵隐寺、龙井茶园，处处皆是风景。让我们一起开启这段美妙的杭州之旅吧！',
    category: 'medium',
  },
  //   {
  //     name: 'news-brief',
  //     text: '今日科技新闻：人工智能领域迎来重大突破。国内领先的人工智能公司发布了新一代大语言模型，在多项基准测试中取得优异成绩。该模型在自然语言理解、逻辑推理和代码生成等方面展现出强大能力，将为各行各业带来深远影响。',
  //     category: 'medium',
  //   },
  //   {
  //     name: 'product-intro',
  //     text: '这款智能音箱采用先进的语音识别技术，支持多种语言的实时翻译。内置高质量扬声器，提供沉浸式的音频体验。通过智能学习算法，它能理解您的使用习惯，提供个性化的服务推荐。简洁的外观设计，完美融入您的居家环境。',
  //     category: 'medium',
  //   },

  //   // 长文本（500-2000 字符）
  //   {
  //     name: 'article-long',
  //     text: `人工智能技术的发展历程可以追溯到二十世纪五十年代。当时，科学家们开始思考是否能够创造一种可以模拟人类智能的机器。这一想法催生了人工智能这一学科的诞生。

  // 经过几十年的发展，人工智能经历了多次高潮与低谷。从早期的符号主义，到后来的连接主义，再到今天的深度学习，每一次技术革新都推动着这个领域向前迈进。

  // 进入二十一世纪，随着计算能力的飞速提升和大数据时代的到来，深度学习技术取得了突破性进展。神经网络模型在图像识别、语音识别、自然语言处理等领域展现出惊人的能力。

  // 特别是近年来，大型语言模型的出现更是引发了新一轮的人工智能热潮。这些模型通过在海量数据上的训练，获得了强大的语言理解和生成能力，可以完成文本创作、代码生成、知识问答等多种任务。

  // 展望未来，人工智能技术将继续深入我们生活的方方面面。从智能家居到自动驾驶，从医疗诊断到金融分析，AI 将成为推动社会进步的重要力量。同时，我们也需要认真思考 AI 发展带来的伦理问题，确保技术发展造福人类。`,
  //     category: 'long',
  //   },
  //   {
  //     name: 'story-long',
  //     text: `从前有一座山，山上有一座古老的寺庙。寺庙里住着一位老和尚和一个小和尚。每天清晨，老和尚都会带着小和尚到山下的村庄化缘。

  // 有一天，小和尚问老和尚："师父，我们为什么要每天走这么远去化缘呢？"

  // 老和尚微笑着说："孩子，化缘不仅仅是为了得到食物，更是为了修行。每一次下山，我们都在学习如何放下自己的傲慢；每一次与村民交谈，我们都在学习如何慈悲待人。"

  // 小和尚似懂非懂地点点头。从那以后，他开始用心观察每一次化缘的过程。他发现，村民们虽然生活并不富裕，却总是慷慨地分享他们的食物。这份善良深深打动了小和尚。

  // 多年以后，小和尚长大成人，成为了寺庙的新住持。他始终记得师父的教导，带领僧人们修行，将寺庙建设成为了远近闻名的修行圣地。每当有人问起他修行的秘诀，他总是说："用心生活，善待每一个人。"`,
  //     category: 'long',
  //   },
];

/**
 * 按分类获取文本
 */
export function getTextsByCategory(category: 'short' | 'medium' | 'long'): TextFixture[] {
  return textFixtures.filter((t) => t.category === category);
}

/**
 * 获取所有短文本
 */
export function getShortTexts(): TextFixture[] {
  return getTextsByCategory('short');
}

/**
 * 获取所有中等文本
 */
export function getMediumTexts(): TextFixture[] {
  return getTextsByCategory('medium');
}

/**
 * 获取所有长文本
 */
export function getLongTexts(): TextFixture[] {
  return getTextsByCategory('long');
}
