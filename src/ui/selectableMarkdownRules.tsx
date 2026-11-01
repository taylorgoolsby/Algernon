// src/ui/selectableMarkdownRules.tsx
import React from 'react'
import { Text as RNText } from 'react-native'

/**
 * Render rules for react-native-markdown-display that make a whole message
 * ONE selectable <Text> tree.
 *
 * iOS can only select text inside a single native text view. The library's
 * default rules wrap paragraphs, headings and list items in <View>s, so a
 * selection can't extend past one paragraph. Here every block becomes a nested
 * <Text> and blocks are separated with newlines instead of View margins, so
 * the user can long-press and drag a selection across the entire message and
 * copy it.
 *
 * Rule signature: (node, children, parentNodes, styles, inheritedStyles),
 * where parentNodes[0] is the node's parent.
 */

// True if `node` is the last child of its parent.
const isLastChild = (node: any, parentNodes: any[]) => {
  const siblings = parentNodes?.[0]?.children
  return !siblings || siblings[siblings.length - 1] === node
}

// Separator after a block: nothing after the last one.
const after = (node: any, parentNodes: any[], separator: string) =>
  isLastChild(node, parentNodes) ? null : separator

const insideListItem = (parentNodes: any[]) =>
  parentNodes?.[0]?.type === 'list_item'

const heading = (level: number) => (
  node: any,
  children: any,
  parentNodes: any[],
  styles: any,
) => (
  <RNText key={node.key} style={styles[`heading${level}`]}>
    {children}
    {after(node, parentNodes, '\n\n')}
  </RNText>
)

const selectableMarkdownRules = {
  // The root: the only element that needs `selectable`.
  body: (node: any, children: any, parentNodes: any[], styles: any) => (
    <RNText key={node.key} selectable={true} style={styles.body}>
      {children}
    </RNText>
  ),

  paragraph: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key}>
      {children}
      {after(node, parentNodes, insideListItem(parentNodes) ? '\n' : '\n\n')}
    </RNText>
  ),

  textgroup: (node: any, children: any) => (
    <RNText key={node.key}>{children}</RNText>
  ),

  text: (
    node: any,
    children: any,
    parentNodes: any[],
    styles: any,
    inheritedStyles = {},
  ) => (
    <RNText key={node.key} style={[inheritedStyles, styles.text]}>
      {node.content}
    </RNText>
  ),

  heading1: heading(1),
  heading2: heading(2),
  heading3: heading(3),
  heading4: heading(4),
  heading5: heading(5),
  heading6: heading(6),

  bullet_list: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key}>
      {children}
      {insideListItem(parentNodes) ? null : after(node, parentNodes, '\n')}
    </RNText>
  ),

  ordered_list: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key}>
      {children}
      {insideListItem(parentNodes) ? null : after(node, parentNodes, '\n')}
    </RNText>
  ),

  list_item: (node: any, children: any, parentNodes: any[]) => {
    const ordered = parentNodes?.[0]?.type === 'ordered_list'
    // Indent nested lists.
    const depth = parentNodes.filter(p => p.type === 'list_item').length
    const marker = ordered ? `${(node.index ?? 0) + 1}. ` : '•  '
    return (
      <RNText key={node.key}>
        {'    '.repeat(depth)}
        {marker}
        {children}
        {after(node, parentNodes, '\n')}
      </RNText>
    )
  },

  blockquote: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key} style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
      {children}
      {after(node, parentNodes, '\n')}
    </RNText>
  ),

  code_block: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key} style={codeStyle}>
      {node.content.replace(/\n$/, '')}
      {after(node, parentNodes, '\n\n')}
    </RNText>
  ),

  fence: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key} style={codeStyle}>
      {node.content.replace(/\n$/, '')}
      {after(node, parentNodes, '\n\n')}
    </RNText>
  ),

  hr: (node: any, children: any, parentNodes: any[]) => (
    <RNText key={node.key} style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
      {'────────────'}
      {after(node, parentNodes, '\n\n')}
    </RNText>
  ),
}

const codeStyle = {
  fontFamily: 'Menlo',
  fontSize: 13,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
}

export default selectableMarkdownRules