import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Files, File, Folder } from 'fumadocs-ui/components/files';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Mermaid } from '@/components/mermaid';

const allowedSlugs = new Set(["index","quickstart","audio-format-performance","doubao/tts-guide","doubao/asr-guide","glm/tts-guide","glm/文字转语音","glm/asr-guide","qwen/tts-guide","qwen/asr-guide","qwen/realtime-tts-guide"]);

function isAllowed(slug: string[] | undefined): boolean {
  if (allowedSlugs.size === 0) return true;
  const key = slug ? slug.join('/') : 'index';
  return allowedSlugs.has(key);
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!isAllowed(slug)) {
    notFound();
  }

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, Steps, Step, Tabs, Tab, Files, File, Folder, Accordion, Accordions, TypeTable, Mermaid }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  let params = source.generateParams();
  params = params.filter((p: { slug: string[] }) => isAllowed(p.slug));
  if (!params.some((p: { slug: string[] }) => p.slug.length === 0)) {
    params.unshift({ ...params[0], slug: [] });
  }
  return params;
}
