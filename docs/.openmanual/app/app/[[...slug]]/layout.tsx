import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';

const sidebarConfig = [
  {
    "group": "入门",
    "collapsed": false,
    "pages": [
      {
        "slug": "index"
      },
      {
        "slug": "quickstart"
      },
      {
        "slug": "audio-format-performance"
      }
    ]
  },
  {
    "group": "豆包",
    "collapsed": false,
    "pages": [
      {
        "slug": "doubao/tts-guide"
      },
      {
        "slug": "doubao/asr-guide"
      }
    ]
  },
  {
    "group": "智谱 GLM",
    "collapsed": false,
    "pages": [
      {
        "slug": "glm/tts-guide"
      },
      {
        "slug": "glm/文字转语音"
      },
      {
        "slug": "glm/asr-guide"
      }
    ]
  },
  {
    "group": "通义千问",
    "collapsed": false,
    "pages": [
      {
        "slug": "qwen/tts-guide"
      },
      {
        "slug": "qwen/asr-guide"
      },
      {
        "slug": "qwen/realtime-tts-guide"
      }
    ]
  }
] as const;

function slugToUrl(slug: string): string {
  return slug === 'index' ? '/' : `/${slug}`;
}

function restructureTree(tree: PageTree.Root): PageTree.Root {
  const consumed = new Set<number>();
  const newChildren: PageTree.Node[] = [];

  for (const group of sidebarConfig) {
    const isRootGroup = group.pages.every((p) => !p.slug.includes('/'));

    if (isRootGroup) {
      const folderChildren: PageTree.Node[] = [];
      for (const page of group.pages) {
        const url = slugToUrl(page.slug);
        const idx = (tree.children ?? []).findIndex(
          (c, i) => !consumed.has(i) && c.type === 'page' && c.url === url
        );
        if (idx >= 0) {
          folderChildren.push(tree.children![idx]);
          consumed.add(idx);
        }
      }
      if (folderChildren.length > 0) {
        newChildren.push({
          type: 'folder',
          name: group.group,
          defaultOpen: group.collapsed !== true,
          children: folderChildren,
        });
      }
    } else {
      const dirPrefix = group.pages.find((p) => p.slug.includes('/'))?.slug.split('/')[0];
      if (dirPrefix) {
        const idx = (tree.children ?? []).findIndex(
          (child, i) =>
            !consumed.has(i) &&
            child.type === 'folder' &&
            child.children?.some(
              (c) => c.type === 'page' && c.url?.startsWith(`/${dirPrefix}/`)
            )
        );
        if (idx >= 0) {
          consumed.add(idx);
          newChildren.push({
            ...(tree.children![idx] as PageTree.Folder),
            name: group.group,
            defaultOpen: group.collapsed !== true,
          });
        }
      }
    }
  }

  for (let i = 0; i < (tree.children ?? []).length; i++) {
    if (!consumed.has(i)) {
      newChildren.push(tree.children![i]);
    }
  }

  return { ...tree, children: newChildren };
}

const docsOptions = {
  ...baseOptions(),
  tree: restructureTree(source.getPageTree()),
    github: 'https://github.com/shenjingnan/univoice',
  footer: { children: 'MIT 2026 © Univoice.' },
};

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...docsOptions}>
      {children}
    </DocsLayout>
  );
}
