import { useMemo } from 'react'
import './MarkdownContent.css'

/**
 * Simple Markdown renderer for AI responses with code block support
 */
const MarkdownContent = ({ content }) => {
  const renderContent = useMemo(() => {
    if (!content) return null

    // Parse markdown with code blocks, bold, italic, lists, etc.
    const parts = []
    let currentIndex = 0
    
    // Regex to match code blocks: ```language\ncode\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g
    
    let match
    const codeBlocks = []
    
    // First, extract all code blocks
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        index: match.index,
        length: match[0].length,
        language: match[1] || 'text',
        code: match[2].trim()
      })
    }
    
    // If no code blocks, render as paragraphs with inline formatting
    if (codeBlocks.length === 0) {
      return renderSimpleMarkdown(content)
    }
    
    // Render content with code blocks
    let lastIndex = 0
    const elements = []
    
    codeBlocks.forEach((block, idx) => {
      // Add text before code block
      if (block.index > lastIndex) {
        const textBefore = content.substring(lastIndex, block.index)
        if (textBefore.trim()) {
          elements.push(
            <div key={`text-${idx}`} className="markdown-text">
              {renderSimpleMarkdown(textBefore)}
            </div>
          )
        }
      }
      
      // Add code block
      elements.push(
        <div key={`code-${idx}`} className="markdown-code-block">
          <div className="markdown-code-header">
            <span className="markdown-code-language">{block.language}</span>
            <button
              className="markdown-code-copy"
              onClick={() => copyCode(block.code)}
              title="Copy code"
            >
              Copy
            </button>
          </div>
          <pre>
            <code className={`language-${block.language}`}>
              {block.code}
            </code>
          </pre>
        </div>
      )
      
      lastIndex = block.index + block.length
    })
    
    // Add remaining text
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex)
      if (textAfter.trim()) {
        elements.push(
          <div key="text-final" className="markdown-text">
            {renderSimpleMarkdown(textAfter)}
          </div>
        )
      }
    }
    
    return <div className="markdown-content">{elements}</div>
  }, [content])
  
  return renderContent
}

// Helper to render simple markdown (bold, italic, inline code, lists)
function renderSimpleMarkdown(text) {
  if (!text) return null
  
  const lines = text.split('\n')
  const elements = []
  
  lines.forEach((line, idx) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${idx}`} />)
      return
    }
    
    // Check for list items
    if (line.match(/^[\d]+\.\s/)) {
      // Numbered list
      const content = line.replace(/^[\d]+\.\s/, '')
      elements.push(
        <div key={idx} className="markdown-list-item markdown-list-ordered">
          <span className="markdown-list-marker">•</span>
          {formatInlineMarkdown(content)}
        </div>
      )
    } else if (line.match(/^[-*]\s/)) {
      // Bullet list
      const content = line.replace(/^[-*]\s/, '')
      elements.push(
        <div key={idx} className="markdown-list-item">
          <span className="markdown-list-marker">•</span>
          {formatInlineMarkdown(content)}
        </div>
      )
    } else if (line.match(/^#{1,6}\s/)) {
      // Headings
      const level = line.match(/^(#{1,6})\s/)[1].length
      const content = line.replace(/^#{1,6}\s/, '')
      elements.push(
        <div key={idx} className={`markdown-heading markdown-h${level}`}>
          {formatInlineMarkdown(content)}
        </div>
      )
    } else {
      // Regular paragraph
      elements.push(
        <div key={idx} className="markdown-paragraph">
          {formatInlineMarkdown(line)}
        </div>
      )
    }
  })
  
  return elements
}

// Format inline markdown (bold, italic, inline code)
function formatInlineMarkdown(text) {
  const parts = []
  let currentPos = 0
  
  // Match inline code first
  const inlineCodeRegex = /`([^`]+)`/g
  const boldRegex = /\*\*([^*]+)\*\*/g
  const italicRegex = /\*([^*]+)\*/g
  
  const allMatches = []
  
  let match
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    allMatches.push({ type: 'code', index: match.index, length: match[0].length, content: match[1] })
  }
  
  inlineCodeRegex.lastIndex = 0
  
  while ((match = boldRegex.exec(text)) !== null) {
    allMatches.push({ type: 'bold', index: match.index, length: match[0].length, content: match[1] })
  }
  
  boldRegex.lastIndex = 0
  
  while ((match = italicRegex.exec(text)) !== null) {
    // Make sure it's not part of bold
    if (!text.substring(match.index - 1, match.index + match[0].length + 1).match(/\*\*.*\*\*/)) {
      allMatches.push({ type: 'italic', index: match.index, length: match[0].length, content: match[1] })
    }
  }
  
  if (allMatches.length === 0) {
    return text
  }
  
  // Sort by index
  allMatches.sort((a, b) => a.index - b.index)
  
  let lastIndex = 0
  allMatches.forEach((m, idx) => {
    // Add text before match
    if (m.index > lastIndex) {
      parts.push(text.substring(lastIndex, m.index))
    }
    
    // Add formatted match
    if (m.type === 'code') {
      parts.push(<code key={`inline-${idx}`} className="markdown-inline-code">{m.content}</code>)
    } else if (m.type === 'bold') {
      parts.push(<strong key={`bold-${idx}`}>{m.content}</strong>)
    } else if (m.type === 'italic') {
      parts.push(<em key={`italic-${idx}`}>{m.content}</em>)
    }
    
    lastIndex = m.index + m.length
  })
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? parts : text
}

// Copy code to clipboard
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    // Could add a toast notification here
    console.log('Code copied to clipboard')
  }).catch(err => {
    console.error('Failed to copy code:', err)
  })
}

export default MarkdownContent
