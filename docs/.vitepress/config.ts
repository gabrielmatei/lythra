import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the Lythra TextMate grammar from the VSCode extension
const lythraGrammar = JSON.parse(
  readFileSync(resolve(__dirname, '../../vscode-lythra/syntaxes/lythra.tmLanguage.json'), 'utf-8')
)

export default withMermaid(
  defineConfig({
    title: "Lythra",
    description: "Language Yielding Typed Heuristic Reasoning Automatically",
    markdown: {
      languages: [
        {
          ...lythraGrammar,
          name: 'lythra',
          scopeName: 'source.lythra',
          aliases: ['lth'],
        }
      ]
    },
    themeConfig: {
      logo: '/logo.png',
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/guide/introduction' },
        { text: 'Architecture', link: '/architecture/overview' },
        { text: 'Reference', link: '/reference/keywords' },
        { text: 'Examples', link: '/examples/' }
      ],
      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Language Basics', link: '/guide/basics' },
            { text: 'Control Flow', link: '/guide/control-flow' },
            { text: 'Functions', link: '/guide/functions' },
            { text: 'Vision Calls', link: '/guide/vision' },
            { text: 'Determinism Controls', link: '/guide/determinism' },
            { text: 'Pipelines', link: '/guide/pipelines' },
            { text: 'Built-in Functions', link: '/guide/builtins' },
            { text: 'Web Server', link: '/guide/web-server' },
            { text: 'Caching & Memory', link: '/guide/caching' },
            { text: 'Imports & Modules', link: '/guide/imports' },
            { text: 'Error Handling', link: '/guide/error-handling' },
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Lexer', link: '/architecture/lexer' },
            { text: 'Parser', link: '/architecture/parser' },
            { text: 'Interpreter', link: '/architecture/interpreter' },
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'CLI', link: '/reference/cli' },
            { text: 'Keywords', link: '/reference/keywords' },
            { text: 'Type System', link: '/reference/types' },
            { text: 'Configuration', link: '/reference/configuration' },
          ]
        },
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Email Classifier', link: '/examples/email-classifier' },
            { text: 'Content Pipeline', link: '/examples/content-pipeline' },
            { text: 'AI Web Server', link: '/examples/ai-server' },
            { text: 'CLI Chatbot', link: '/examples/chatbot' },
          ]
        }
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/gabrielmatei/lythra' }
      ],
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2026-present Gabriel Matei'
      }
    }
  })
)
