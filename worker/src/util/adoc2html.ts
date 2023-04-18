import asciidoctor from '@asciidoctor/core';
import type { Converter, AbstractNode, ProcessorOptions } from '@asciidoctor/core';
import type * as AdocTypes from '@asciidoctor/core';

const AsciiDoctor = asciidoctor();

type NodeType = 'document' | 'embedded' | 'outline' | 'section' | 'admonition' | 'audio' | 'colist' |
  'dlist' | 'example' | 'floating-title' | 'image' | 'listing' | 'literal' | 'stem' | 'olist' | 'open' |
  'page_break' | 'paragraph' | 'preamble' | 'quote' | 'thematic_break' | 'sidebar' | 'table' | 'toc' |
  'ulist' | 'verse' | 'video' | 'inline_anchor' | 'inline_break' | 'inline_button' | 'inline_callout' |
  'inline_footnote' | 'inline_image' | 'inline_indexterm' | 'inline_kbd' | 'inline_menu' | 'inline_quoted';

export interface NodeTypeMap {
  document: AdocTypes.Document;
  embedded: AdocTypes.AbstractBlock;
  outline: AdocTypes.AbstractBlock;
  section: AdocTypes.Section;
  admonition: AdocTypes.Table;
  audio: AdocTypes.AbstractBlock;
  colist: AdocTypes.List;
  dlist: AdocTypes.List;
  olist: AdocTypes.List;
  ulist: AdocTypes.List;
  list_item: AdocTypes.ListItem;
  inline_anchor: AdocTypes.Inline;
  inline_quoted: AdocTypes.Inline;
  table: AdocTypes.Table;
  example: AdocTypes.AbstractBlock;
  paragraph: AdocTypes.AbstractBlock;
  floating_title: AdocTypes.AbstractBlock;
  thematic_break: AdocTypes.AbstractNode;

  [key: string]: AdocTypes.AbstractNode;
}

export interface Options extends ProcessorOptions {
  backend?: 'franklin' | 'html5' | string;
}

class FranklinConverter implements Converter {
  baseConverter: Converter;
  // TODO: make node type -> node interface map
  templates: { [K in keyof NodeTypeMap]?: (node: NodeTypeMap[K]) => string };
  sectionDepth = 0;
  inSection = false;
  doc: AdocTypes.Document;

  constructor() {
    this.baseConverter = new AsciiDoctor.Html5Converter();
    this.templates = {
      // TODO: complete templates
      paragraph: (node) => {
        // console.log('paragraph: ', node.getContent());
        return `<p>${node.getContent()}</p>`;
      },
      inline_anchor: (node) => {
        // console.debug('process inline_anchor');
        let url = node.getTarget();
        if (url && url.endsWith('.html')) {
          url = url.slice(0, -'.html'.length);
        }
        return `<a href="${url}">${node.getText()}</a>`;
      },
      'floating-title': (node) => {
        console.debug('floating title: ', node);
        return `todo`;
      },
      embedded: (node) => {
        return node.getContent();
      },
      thematic_break: (_node) => {
        return '<hr>';
      },
      section: (node) => {
        console.debug('section context, id: ', node.getContext(), node.getId(), node.getTitle(), node.getLevel());
        // console.log('section node: ', node);

        const level = node.getLevel();
        const tag = `h${level + 1}`
        const blocks = node.getBlocks();
        console.log('section blocks: ', blocks.length);
        // const closers = new Array(level - 1).fill('</div>').join('');

        const closer = this.closeSection();
        this.sectionDepth += 1;
        // console.log('closer: ', closer);

        const content = `<${tag}>${node.getTitle()}</${tag}>
        ${blocks.map(block => this.convert(block)).join('')}`;
        // console.log('section content: ', content);

        const wrapper = `${closer}<div>${content}${closer ? '' : '</div>'}`;

        this.sectionDepth -= 1;
        return wrapper;
      },
      admonition: (node) => {
        const style = node.getStyle() || '';
        console.debug('process admonition: ', node);

        let title = (node.getTitle() || '').trim();
        if (title) {
          title = `<h6>${title}</h6>`;
        }

        return `
          <div class="admonition ${style.toLowerCase()}">
            <div>
              ${title}
              ${node.getContent()}
            </div>
          </div>`;
      },
      inline_quoted: (node) => {
        // console.debug('process inline_quoted');
        const content = node.getText();
        const tag = node.getType() === 'strong' ? 'strong' : undefined;
        if (!tag) {
          console.warn('[inline_quoted] unhandled node: ', node);
        }
        return tag ? `<${tag}>${content}</${tag}>` : content;
      },
      ulist: (node) => {
        const blocks = node.getBlocks();
        console.debug('process ulist: ', blocks.length, blocks);

        const content = blocks.map(block => this.convert(block)).join('');
        console.debug('ulist content: ', content);
        return content ? `<ul>${content}</ul>` : '';
      },
      olist: (node) => {
        const blocks = node.getBlocks();
        console.debug('process olist: ', blocks.length, blocks);

        const content = blocks.map(block => this.convert(block)).join('');
        console.debug('olist content: ', content);
        return content ? `<ol>${content}</ol>` : '';
      },
      list_item: (node) => {
        // const blocks = node.getBlocks();
        const content = this.hrefsToLinks(node.getContent());
        if (content) {
          return content.startsWith('<ul>') ? content : `<li>${content}</li>`;
        }

        const text = node.getText();
        console.log('node text: ', text);
        // TODO: handle xrefs
        return text ? `<li>${this.hrefsToLinks(text)}</li>` : '';
      }
    }
  }

  iconsEnabled(): boolean {
    return this.doc.getAttribute('icons');
  }

  hrefsToLinks(text: string) {
    return text.replace(/(https?:\/\/.*\S)/g, `<a href=$1>$1</a>`);
  }

  closeSection() {
    if (this.sectionDepth) {
      return new Array(this.sectionDepth).fill(`</div>`).join('');
    }
    return '';
  }

  convert(node: AbstractNode, transform?: string, opts?: any) {
    // console.log('converting node...');
    const name = transform || node.getNodeName();
    console.log(`convert node: transform=${transform} name=${name} type=${(node as any).type}`);

    this.doc = node.getDocument();

    const template = this.templates[name];
    if (template) {
      return template(node);
    }

    console.log('handling node with base template...', name);
    const defaultContent = this.baseConverter.convert(node, transform, opts);
    console.log('handled node with base template: ', name, node, defaultContent);
    return defaultContent;
  }
}

// if (!AsciiDoctor.ConverterFactory.getRegistry()['franklin']) {
AsciiDoctor.ConverterFactory.register(new FranklinConverter(), ['franklin']);
// }

const adoc2html = (
  content: string,
  options: Options = {}
): string => {
  const { backend = 'franklin', ...opts } = options;
  const html = AsciiDoctor.convert(content, { ...opts, backend }) as string;

  return /* html */`
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="/scripts/scripts.js" type="module"></script>
      <link rel="stylesheet" href="/styles/styles.css">
      <link rel="icon" href="data:,">
    </head>
    
    <body>
      <header></header>
      <main>
        ${html}
      </main>
      <footer></footer>
    </body>
  </html>`;
}

export default adoc2html;